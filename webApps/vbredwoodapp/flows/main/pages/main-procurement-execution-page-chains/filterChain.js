/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

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
   * Smart-search filter change. On Project Number change: project header (BU + owning Org +
   * ProjectId) from the Fusion projects record (ORDS getPDSCGetProjectByBU fallback), narrow
   * the BU filter, then load execution lines from ORDS getPDSCExecuteDetails. Other filters +
   * keyword refine the loaded rows client-side. Mirrors the Project Procurement Plan page.
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
      const matches = (rowVal, sel) => Array.isArray(sel) ? sel.indexOf(rowVal) !== -1 : rowVal === sel;

      const selected = {};
      let keyword = '';
      const collect = (c) => {
        if (!c) return;
        if (c.text && c.matchBy === 'phrase') { keyword = c.text; return; }
        if (Array.isArray(c.criteria)) { c.criteria.forEach(collect); return; }
        if (c.op === '$eq' || c.op === '$in') {
          if (c.attribute) { selected[c.attribute] = c.value; }
          else if (c.value && typeof c.value === 'object') {
            const k = Object.keys(c.value)[0]; if (k) selected[k] = c.value[k];
          }
        }
      };
      collect($page.variables.filterCriterion);

      const pn = selected.projectNumber || '';

      if (pn !== $page.variables.lastProjectNumber) {
        if (pn) {
          let header = { projectNumber: pn, projectName: '', businessUnit: '', projectOrg: '', status: '', projectManager: '', projectId: null, buId: null, orgId: null };
          let fusionHdr = false;
          try {
            const fr = await Actions.callRest(context, {
              endpoint: 'FusionFSCM/getProjects',
              uriParams: { limit: 1, onlyData: true, q: "ProjectNumber='" + pn + "'",
                fields: 'ProjectId,ProjectNumber,ProjectName,BusinessUnitName,OwningOrganizationName,OwningOrganizationId,ProjectStatus,ProjectManagerName' }
            });
            const p = (fr && fr.body && Array.isArray(fr.body.items)) ? fr.body.items[0] : null;
            if (p) {
              header = {
                projectNumber: p.ProjectNumber != null ? p.ProjectNumber : pn,
                projectName: p.ProjectName || '', businessUnit: p.BusinessUnitName || '',
                projectOrg: p.OwningOrganizationName || '', status: p.ProjectStatus || '',
                projectManager: p.ProjectManagerName || '', projectId: p.ProjectId != null ? p.ProjectId : null, buId: null,
                orgId: p.OwningOrganizationId != null ? p.OwningOrganizationId : null
              };
              fusionHdr = true;
            }
          } catch (e) { /* ORDS fallback below */ }

          if (!fusionHdr) {
            try {
              const hdr = await Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetProjectByBU', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 500 } });
              const h = items(hdr)[0];
              if (h) {
                header = {
                  projectNumber: h.project_number != null ? h.project_number : pn,
                  projectName: h.project_name || '', businessUnit: h.bu_name || '',
                  projectOrg: h.organization_name || '', status: h.project_status_code || '',
                  projectManager: h.attribute1 || '', projectId: h.project_id != null ? h.project_id : null, buId: h.org_id != null ? h.org_id : null,
                  orgId: h.org_id != null ? h.org_id : null
                };
              }
            } catch (e) { /* best-effort */ }
          }
          $page.variables.planHeader = header;
          if (header.businessUnit) $page.variables.businessUnitArray = [{ value: header.businessUnit, label: header.businessUnit }];
          if (header.projectOrg) $page.variables.projectOrgArray = [{ value: header.projectOrg, label: header.projectOrg }];

          // Execution lines from ORDS (BU-access scoped via P_USERNAME).
          const exec = await fetchAll(context, 'PDSCBUDetails/getPDSCExecuteDetails', { P_PROJECT_NUMBER: pn, P_USERNAME: user }, 'execute_id');
          $page.variables.execLinesAllArray = exec;
        } else {
          $page.variables.planHeader = { projectNumber: '', projectName: '', businessUnit: '', projectOrg: '', status: '', projectManager: '', projectId: null, buId: null, orgId: null };
          $page.variables.execLinesAllArray = [];
        }
        $page.variables.lastProjectNumber = pn;
      }

      // client-side refine of the loaded rows
      let rows = [...($page.variables.execLinesAllArray || [])];
      if (selected.businessUnit != null) rows = rows.filter((r) => matches(r.business_unit_name, selected.businessUnit));
      if (selected.itemCategory != null) rows = rows.filter((r) => matches(r.item_category, selected.itemCategory));
      if (selected.critical != null) rows = rows.filter((r) => matches(r.critical_flag, selected.critical));
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['item_number', 'item_desc', 'purchase_requisition', 'purchase_order', 'negotiation'];
        rows = rows.filter((item) => words.some((w) => KW.some((f) => item[f] && String(item[f]).toLowerCase().includes(w))));
      }
      $page.variables.execLinesArray = rows;
    }
  }

  return FilterChain;
});
