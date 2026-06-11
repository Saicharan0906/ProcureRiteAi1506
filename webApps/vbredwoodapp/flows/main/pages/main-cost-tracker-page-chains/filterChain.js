/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * oj-sp-smart-search filter-criterion-changed (PATH B, client-side mock).
   * Project Number cascade fills header (Name/BU/Org + cost totals), auto-applies
   * single BU/Org or narrows the list. Filters cost lines by effective filters +
   * keyword. Wire to ORDS getPDSCCostTracker (server-side) later.
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $page } = context;

      if (!$page.variables.costLinesAllArray || !$page.variables.costLinesAllArray.length) {
        $page.variables.costLinesAllArray = [...$page.variables.costLinesArray];
      }
      const all = $page.variables.costLinesAllArray;

      const selected = {};
      let keyword = '';
      const collect = (c) => {
        if (!c) return;
        if (c.text && c.matchBy === 'phrase') { keyword = c.text; return; }
        if (Array.isArray(c.criteria)) { c.criteria.forEach(collect); return; }
        if (c.op === '$eq') {
          if (c.attribute) { selected[c.attribute] = c.value; }
          else if (c.value && typeof c.value === 'object') {
            const k = Object.keys(c.value)[0]; if (k) selected[k] = c.value[k];
          }
        }
      };
      collect($page.variables.filterCriterion);

      const pn = selected.projectNumber || '';
      if (pn !== $page.variables.lastProjectNumber) {
        const meta = ($page.variables.projectMeta || {})[pn];
        if (pn && meta) {
          $page.variables.planHeader = {
            projectName: meta.projectName,
            businessUnit: (meta.businessUnits && meta.businessUnits.length === 1) ? meta.businessUnits[0] : '',
            projectOrg: (meta.orgs && meta.orgs.length === 1) ? meta.orgs[0] : '',
            plannedCostTotal: meta.plannedCostTotal, orderedTotal: meta.orderedTotal
          };
          $page.variables.businessUnitArray = (meta.businessUnits || []).map(v => ({ value: v, label: v }));
          $page.variables.projectOrgArray = (meta.orgs || []).map(v => ({ value: v, label: v }));
        } else {
          $page.variables.planHeader = { projectName: '', businessUnit: '', projectOrg: '', plannedCostTotal: '', orderedTotal: '' };
        }
        $page.variables.lastProjectNumber = pn;
      }

      const effBU = selected.businessUnit || $page.variables.planHeader.businessUnit;
      const effOrg = selected.projectOrg || $page.variables.planHeader.projectOrg;

      let rows = [...all];
      if (pn) rows = rows.filter(r => r.projectNumber === pn);
      if (effBU) rows = rows.filter(r => r.businessUnit === effBU);
      if (effOrg) rows = rows.filter(r => r.projectOrg === effOrg);
      if (selected.poNumber) rows = rows.filter(r => r.poNumber === selected.poNumber);
      if (selected.supplier) rows = rows.filter(r => r.supplier === selected.supplier);
      if (selected.itemCategory) rows = rows.filter(r => r.itemCategory === selected.itemCategory);
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['itemNumber', 'itemDescription', 'supplier', 'poNumber', 'taskName'];
        rows = rows.filter(item => words.some(w => KW.some(f => item[f] && String(item[f]).toLowerCase().includes(w))));
      }
      $page.variables.costLinesArray = rows;
    }
  }
  return FilterChain;
});
