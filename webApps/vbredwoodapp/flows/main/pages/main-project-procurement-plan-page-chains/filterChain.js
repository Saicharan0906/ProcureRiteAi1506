/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /** Fetch ALL rows from an ORDS GET, paging past the 25-row default until hasMore=false.
   *  De-dupes by keyField; stops if a page adds nothing new (guards an offset-ignoring handler). */
  async function fetchAll(context, endpoint, uriParams, keyField) {
    const PAGE = 500;
    const all = [];
    const seen = Object.create(null);
    let offset = 0;
    for (let guard = 0; guard < 100; guard++) {
      let body = null;
      try {
        const r = await Actions.callRest(context, { endpoint, uriParams: Object.assign({}, uriParams, { limit: PAGE, offset }) });
        body = r && r.body;
      } catch (e) { break; }
      const items = (body && Array.isArray(body.items)) ? body.items : [];
      let added = 0;
      for (let i = 0; i < items.length; i++) {
        const k = keyField ? String(items[i][keyField]) : JSON.stringify(items[i]);
        if (!seen[k]) { seen[k] = 1; all.push(items[i]); added++; }
      }
      if (items.length === 0 || added === 0 || body.hasMore !== true) break;
      offset += items.length;
    }
    return all;
  }

  /**
   * oj-sp-smart-search filter-criterion-changed handler — ORDS-backed.
   * On Project Number change: load the project header (getPDSCGetProjectByBU), narrow the
   * Org + Buyer LOVs to that BU, and fetch ALL plan lines (paged). Other chips + keyword
   * refine the loaded rows client-side. Re-fetch happens only when the project changes.
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      const opts = (arr, field) => {
        const seen = Object.create(null);
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      // collect applied filters + keyword
      const selected = {};
      const dateRange = {};
      let keyword = '';
      // matches a row value against a selected filter value (handles SelectSingle scalar
      // AND SelectMultiple arrays from $in)
      const matches = (rowVal, sel) => Array.isArray(sel) ? sel.indexOf(rowVal) !== -1 : rowVal === sel;
      const RANGE_FROM = { '$ge': 1, '$gte': 1 };
      const RANGE_TO = { '$le': 1, '$lte': 1 };
      const setRange = (attr, key, val) => { if (!attr) return; (dateRange[attr] = dateRange[attr] || {})[key] = val; };
      const collect = (c) => {
        if (!c) return;
        if (c.text && c.matchBy === 'phrase') { keyword = c.text; return; }
        if (Array.isArray(c.criteria)) { c.criteria.forEach(collect); return; }
        // $eq = SelectSingle, $in = SelectMultiple; both arrive flat (attribute) or nested (value{field})
        if (c.op === '$eq' || c.op === '$in') {
          if (c.attribute) { selected[c.attribute] = c.value; }
          else if (c.value && typeof c.value === 'object') {
            const k = Object.keys(c.value)[0];
            if (k) selected[k] = c.value[k];
          }
        // DateRange emits >=/<= bounds (flat attribute or nested value{field}); $between carries both.
        } else if (RANGE_FROM[c.op] || RANGE_TO[c.op]) {
          const attr = c.attribute || (c.value && typeof c.value === 'object' && Object.keys(c.value)[0]);
          const val = c.attribute ? c.value : (c.value && c.value[attr]);
          setRange(attr, RANGE_FROM[c.op] ? 'from' : 'to', val);
        } else if (c.op === '$between' && c.attribute) {
          if (Array.isArray(c.value)) { setRange(c.attribute, 'from', c.value[0]); setRange(c.attribute, 'to', c.value[1]); }
          else if (c.value && typeof c.value === 'object') { setRange(c.attribute, 'from', c.value.min || c.value.start); setRange(c.attribute, 'to', c.value.max || c.value.end); }
        }
      };
      collect($page.variables.filterCriterion);

      // Parse a date that may be ISO (YYYY-MM-DD / ...T...) or ORDS DD-MM-YYYY -> epoch ms (null if unparseable).
      const dateMs = (v) => {
        if (!v) return null;
        const s = String(v).split('T')[0];
        const p = s.split('-');
        let d;
        if (p.length === 3 && p[0].length === 4) d = new Date(+p[0], +p[1] - 1, +p[2]);
        else if (p.length === 3) d = new Date(+p[2], +p[1] - 1, +p[0]);
        else d = new Date(s);
        return isNaN(d.getTime()) ? null : d.getTime();
      };

      const pn = selected.projectNumber || '';

      if (pn !== $page.variables.lastProjectNumber) {
        if (pn) {
          let header = {
            projectNumber: pn, projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null, buId: null
          };
          let fusionHdr = false;
          // Project header from the Fusion projects record (BU + owning org + dates + ProjectId).
          try {
            const fr = await Actions.callRest(context, {
              endpoint: 'FusionFSCM/getProjects',
              uriParams: { limit: 1, onlyData: true, q: "ProjectNumber='" + pn + "'",
                fields: 'ProjectId,ProjectNumber,ProjectName,BusinessUnitName,OwningOrganizationName,ProjectStartDate,ProjectEndDate,ProjectStatus,ProjectManagerName' }
            });
            const p = (fr && fr.body && Array.isArray(fr.body.items)) ? fr.body.items[0] : null;
            if (p) {
              header = {
                projectNumber: p.ProjectNumber != null ? p.ProjectNumber : pn,
                projectName: p.ProjectName || '',
                businessUnit: p.BusinessUnitName || '',
                projectOrg: p.OwningOrganizationName || '',
                startDate: p.ProjectStartDate || '',
                finishDate: p.ProjectEndDate || '',
                status: p.ProjectStatus || '',
                projectManager: p.ProjectManagerName || '',
                projectId: p.ProjectId != null ? p.ProjectId : null,
                buId: null
              };
              fusionHdr = true;
            }
          } catch (e) { /* fall back to ORDS header below */ }

          if (!fusionHdr) {
            try {
              const hdr = await Actions.callRest(context, {
                endpoint: 'PDSCBUDetails/getPDSCGetProjectByBU',
                uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 500 }
              });
              const h = items(hdr)[0];
              if (h) {
                header = {
                  projectNumber: h.project_number != null ? h.project_number : pn,
                  projectName: h.project_name || '',
                  businessUnit: h.bu_name || '',
                  projectOrg: h.organization_name || '',
                  startDate: h.project_start_date || '',
                  finishDate: h.project_end_date || '',
                  status: h.project_status_code || '',
                  projectManager: h.attribute1 || '',
                  projectId: h.project_id != null ? h.project_id : null,
                  buId: h.org_id != null ? h.org_id : null
                };
              }
            } catch (e) { /* header best-effort */ }
          }
          $page.variables.planHeader = header;

          // Org options: project's owning org (Fusion) or BU orgs (ORDS fallback). Buyer + plan
          // lines stay on ORDS (plan lines are ProcureRite's own data).
          const [orgList, buyerList, lineList] = await Promise.all([
            (!fusionHdr && header.businessUnit) ? fetchAll(context, 'PDSCBUDetails/getPDSCGetOrgbyBU', { P_BU_NAME: header.businessUnit }, 'organization_name') : Promise.resolve([]),
            header.businessUnit ? fetchAll(context, 'PDSCBUDetails/getPDSCBuyerDetails', { P_BU_NAME: header.businessUnit, P_USERNAME: user }, 'buyer_name') : Promise.resolve([]),
            fetchAll(context, 'PDSCBUDetails/getPDSCPlanDetails', { P_PROJECT_NUMBER: pn, P_USERNAME: user }, 'plan_id')
          ]);
          if (fusionHdr && header.projectOrg) $page.variables.projectOrgArray = [{ value: header.projectOrg, label: header.projectOrg }];
          else $page.variables.projectOrgArray = opts(orgList, 'organization_name');
          // A project has exactly one BU -> narrow the Business Unit filter to that single value
          // (instead of the full all-BU list loaded at page enter).
          if (header.businessUnit) $page.variables.businessUnitArray = [{ value: header.businessUnit, label: header.businessUnit }];
          $page.variables.buyerArray = opts(buyerList, 'buyer_name');
          $page.variables.planLinesAllArray = lineList;

          // Task LOV (for the Add/Edit drawer) loaded HERE on project-select, using the
          // freshly captured Fusion ProjectId -> projects/{ProjectId}/child/Tasks. The ORDS
          // task cache is stale/BU-gated for current Fusion projects, so Fusion is the real
          // source; ORDS getPDSCGetTaskByProject is the fallback.
          let taskRows = [];
          if (header.projectId) {
            try {
              const tr = await Actions.callRest(context, { endpoint: 'FusionFSCM/getProjectTasks', uriParams: { ProjectId: header.projectId, limit: 1000, onlyData: true, fields: 'TaskId,TaskNumber,TaskName' } });
              const tit = items(tr);
              if (tit.length) taskRows = tit.map((t) => ({ task_id: t.TaskId, task_number: t.TaskNumber, task_name: t.TaskName }));
            } catch (e) { /* ORDS fallback below */ }
          }
          if (!taskRows.length) {
            try { taskRows = items(await Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetTaskByProject', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 1000 } })); } catch (e) { taskRows = []; }
          }
          $page.variables.taskArray = taskRows;
        } else {
          $page.variables.planHeader = {
            projectNumber: '', projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null
          };
          $page.variables.planLinesAllArray = [];
          $page.variables.taskArray = [];
        }
        $page.variables.lastProjectNumber = pn;
      }

      // quick-filter chip counts (computed off the full project set, like the Redwood seeded chips)
      const allRows = $page.variables.planLinesAllArray || [];
      $page.variables.chipDraftCount = allRows.filter((r) => r.status === 'Draft').length;
      $page.variables.chipReadyCount = allRows.filter((r) => r.status === 'Ready for Procurement').length;
      $page.variables.chipCriticalCount = allRows.filter((r) => r.critical_flag === 'Yes').length;

      // client-side refine of the loaded project rows
      let rows = [...allRows];
      if (selected.businessUnit != null) rows = rows.filter((r) => matches(r.business_unit, selected.businessUnit));
      if (selected.itemCategory != null) rows = rows.filter((r) => matches(r.item_category, selected.itemCategory));
      if (selected.buyer != null) rows = rows.filter((r) => matches(r.buyer, selected.buyer));
      if (selected.status != null) rows = rows.filter((r) => matches(r.status, selected.status));
      if (selected.critical != null) rows = rows.filter((r) => matches(r.critical_flag, selected.critical));
      // Requested Delivery Date range (only narrows when the user applies the date filter).
      const dr = dateRange.requested_delivery_date;
      if (dr && (dr.from || dr.to)) {
        const from = dateMs(dr.from);
        const to = dateMs(dr.to);
        rows = rows.filter((r) => {
          const t = dateMs(r.requested_delivery_date);
          if (t == null) return false;
          if (from != null && t < from) return false;
          if (to != null && t > to) return false;
          return true;
        });
      }
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['item_number', 'item_desc', 'task_name', 'supplier'];
        rows = rows.filter((item) => words.some((w) => KW.some((f) => item[f] && String(item[f]).toLowerCase().includes(w))));
      }

      // active quick-filter chip (applied on top of the smart-search filters)
      const chip = $page.variables.activeQuickChipId;
      if (chip === 'draft') rows = rows.filter((r) => r.status === 'Draft');
      else if (chip === 'ready') rows = rows.filter((r) => r.status === 'Ready for Procurement');
      else if (chip === 'critical') rows = rows.filter((r) => r.critical_flag === 'Yes');

      $page.variables.planLinesArray = rows;
    }
  }

  return FilterChain;
});
