/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * oj-sp-smart-search filter-criterion-changed handler (PATH B, client-side mock).
   *
   * Cascade: when Project Number is applied, auto-fill Project Name + Start/Finish/
   * Status/Manager in the header, and for Business Unit / Project Organization:
   *   - if the project has exactly ONE value, auto-fill & auto-apply it
   *   - if it has MANY, narrow that filter's list so the user picks a valid one
   * Then filter the plan lines by the effective filters + keyword.
   *
   * When wired to ORDS, replace with getPDSCGetProjectByBU (cascade) +
   * getPDSCPlanDetails (server-side lines).
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $page } = context;

      if (!$page.variables.planLinesAllArray || !$page.variables.planLinesAllArray.length) {
        $page.variables.planLinesAllArray = [...$page.variables.planLinesArray];
      }
      const all = $page.variables.planLinesAllArray;

      // ---- collect applied filters + keyword ----
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

      // ---- cascade on Project Number change ----
      const pn = selected.projectNumber || '';
      if (pn !== $page.variables.lastProjectNumber) {
        const meta = ($page.variables.projectMeta || {})[pn];
        if (pn && meta) {
          $page.variables.planHeader = {
            projectName: meta.projectName,
            businessUnit: (meta.businessUnits && meta.businessUnits.length === 1) ? meta.businessUnits[0] : '',
            projectOrg: (meta.orgs && meta.orgs.length === 1) ? meta.orgs[0] : '',
            startDate: meta.startDate, finishDate: meta.finishDate,
            status: meta.status, projectManager: meta.projectManager
          };
          // narrow the dependent LOVs to this project's valid values
          $page.variables.businessUnitArray = (meta.businessUnits || []).map(v => ({ value: v, label: v }));
          $page.variables.projectOrgArray = (meta.orgs || []).map(v => ({ value: v, label: v }));
        } else {
          $page.variables.planHeader = { projectName: '', businessUnit: '', projectOrg: '', startDate: '', finishDate: '', status: '', projectManager: '' };
        }
        $page.variables.lastProjectNumber = pn;
      }

      // effective BU/Org = user-picked chip OR auto-filled single value
      const effBU = selected.businessUnit || $page.variables.planHeader.businessUnit;
      const effOrg = selected.projectOrg || $page.variables.planHeader.projectOrg;

      // ---- filter the plan lines ----
      let rows = [...all];
      if (pn) rows = rows.filter(r => r.projectNumber === pn);
      if (effBU) rows = rows.filter(r => r.businessUnit === effBU);
      if (effOrg) rows = rows.filter(r => r.projectOrg === effOrg);
      if (selected.itemCategory) rows = rows.filter(r => r.itemCategory === selected.itemCategory);
      if (selected.buyer) rows = rows.filter(r => r.buyer === selected.buyer);
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['itemNumber', 'itemDescription', 'taskName', 'supplier'];
        rows = rows.filter(item => words.some(w => KW.some(f => item[f] && String(item[f]).toLowerCase().includes(w))));
      }

      $page.variables.planLinesArray = rows;
    }
  }

  return FilterChain;
});
