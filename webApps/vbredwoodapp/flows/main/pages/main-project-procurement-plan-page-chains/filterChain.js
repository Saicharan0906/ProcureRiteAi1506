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
      let keyword = '';
      // matches a row value against a selected filter value (handles SelectSingle scalar
      // AND SelectMultiple arrays from $in)
      const matches = (rowVal, sel) => Array.isArray(sel) ? sel.indexOf(rowVal) !== -1 : rowVal === sel;
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
        }
      };
      collect($page.variables.filterCriterion);

      const pn = selected.projectNumber || '';

      if (pn !== $page.variables.lastProjectNumber) {
        if (pn) {
          let header = {
            projectNumber: pn, projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null
          };
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
          $page.variables.planHeader = header;

          const [orgList, buyerList, lineList] = await Promise.all([
            header.businessUnit ? fetchAll(context, 'PDSCBUDetails/getPDSCGetOrgbyBU', { P_BU_NAME: header.businessUnit }, 'organization_name') : Promise.resolve([]),
            header.businessUnit ? fetchAll(context, 'PDSCBUDetails/getPDSCBuyerDetails', { P_BU_NAME: header.businessUnit, P_USERNAME: user }, 'buyer_name') : Promise.resolve([]),
            fetchAll(context, 'PDSCBUDetails/getPDSCPlanDetails', { P_PROJECT_NUMBER: pn, P_USERNAME: user }, 'plan_id')
          ]);
          $page.variables.projectOrgArray = opts(orgList, 'organization_name');
          $page.variables.buyerArray = opts(buyerList, 'buyer_name');
          $page.variables.planLinesAllArray = lineList;
        } else {
          $page.variables.planHeader = {
            projectNumber: '', projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null
          };
          $page.variables.planLinesAllArray = [];
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
