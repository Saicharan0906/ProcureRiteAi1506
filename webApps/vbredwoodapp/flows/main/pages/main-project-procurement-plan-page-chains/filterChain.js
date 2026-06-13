/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * oj-sp-smart-search filter-criterion-changed handler — ORDS-backed.
   *
   * On Project Number change (the primary cascade key):
   *   1. getPDSCGetProjectByBU(P_PROJECT_NUMBER) -> fill the project header
   *      (name, BU, org, dates, status, manager, projectId)
   *   2. getPDSCGetOrgbyBU(P_BU_NAME) + getPDSCBuyerDetails(P_BU_NAME) -> narrow the
   *      Project Organization & Buyer filter LOVs to the selected project's BU
   *   3. getPDSCPlanDetails(P_PROJECT_NUMBER) -> the plan lines (planLinesAllArray)
   *
   * Every fire (including when only the other chips / keyword change) then refines the
   * already-loaded project rows CLIENT-SIDE by Business Unit, Item Category, Buyer,
   * Status, Critical and the free-text keyword -> planLinesArray (the table data).
   * Re-fetch happens only when the Project Number actually changes.
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      const opts = (arr, field) => {
        const seen = {};
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      // ---- collect applied filters + keyword from the smart-search criterion ----
      const selected = {};
      let keyword = '';
      const collect = (c) => {
        if (!c) return;
        if (c.text && c.matchBy === 'phrase') { keyword = c.text; return; }
        if (Array.isArray(c.criteria)) { c.criteria.forEach(collect); return; }
        if (c.op === '$eq') {
          if (c.attribute) { selected[c.attribute] = c.value; }
          else if (c.value && typeof c.value === 'object') {
            const k = Object.keys(c.value)[0];
            if (k) selected[k] = c.value[k];
          }
        }
      };
      collect($page.variables.filterCriterion);

      const pn = selected.projectNumber || '';

      // ---- cascade + plan-line fetch only when the project actually changes ----
      if (pn !== $page.variables.lastProjectNumber) {
        if (pn) {
          let header = {
            projectNumber: pn, projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null
          };
          try {
            const hdr = await Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/getPDSCGetProjectByBU',
              uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user }
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
                projectId: h.project_id != null ? h.project_id : null
              };
            }
          } catch (e) { /* header best-effort */ }
          $page.variables.planHeader = header;

          // narrow Project Org + Buyer LOVs to this project's BU + fetch plan lines
          // (high limit so ORDS pagination doesn't truncate the LOVs / grid at 25 rows)
          const LIMIT = 5000;
          const [orgRes, buyerRes, linesRes] = await Promise.allSettled([
            header.businessUnit ? Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/getPDSCGetOrgbyBU', uriParams: { P_BU_NAME: header.businessUnit, limit: LIMIT }
            }) : Promise.resolve(null),
            header.businessUnit ? Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/getPDSCBuyerDetails', uriParams: { P_BU_NAME: header.businessUnit, P_USERNAME: user, limit: LIMIT }
            }) : Promise.resolve(null),
            Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/getPDSCPlanDetails', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: LIMIT }
            })
          ]);

          if (orgRes.status === 'fulfilled' && orgRes.value) {
            $page.variables.projectOrgArray = opts(items(orgRes.value), 'organization_name');
          }
          if (buyerRes.status === 'fulfilled' && buyerRes.value) {
            $page.variables.buyerArray = opts(items(buyerRes.value), 'buyer_name');
          }
          $page.variables.planLinesAllArray = (linesRes.status === 'fulfilled') ? items(linesRes.value) : [];
        } else {
          $page.variables.planHeader = {
            projectNumber: '', projectName: '', businessUnit: '', projectOrg: '',
            startDate: '', finishDate: '', status: '', projectManager: '', projectId: null
          };
          $page.variables.planLinesAllArray = [];
        }
        $page.variables.lastProjectNumber = pn;
      }

      // ---- client-side refine of the loaded project rows ----
      let rows = [...($page.variables.planLinesAllArray || [])];
      if (selected.businessUnit) rows = rows.filter((r) => r.business_unit === selected.businessUnit);
      if (selected.itemCategory) rows = rows.filter((r) => r.item_category === selected.itemCategory);
      if (selected.buyer) rows = rows.filter((r) => r.buyer === selected.buyer);
      if (selected.status) rows = rows.filter((r) => r.status === selected.status);
      if (selected.critical) rows = rows.filter((r) => r.critical_flag === selected.critical);
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['item_number', 'item_desc', 'task_name', 'supplier'];
        rows = rows.filter((item) => words.some((w) => KW.some((f) => item[f] && String(item[f]).toLowerCase().includes(w))));
      }

      $page.variables.planLinesArray = rows;
    }
  }

  return FilterChain;
});
