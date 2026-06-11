/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * oj-sp-smart-search filter-criterion-changed (PATH B, client-side mock).
   * Project Number cascade fills header + auto-applies single BU/Org (else narrows
   * the list). Filters PO schedules by effective filters + keyword. Wire to ORDS
   * getPDSCExpediteWorkbench later.
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $page } = context;

      if (!$page.variables.poSchedulesAllArray || !$page.variables.poSchedulesAllArray.length) {
        $page.variables.poSchedulesAllArray = [...$page.variables.poSchedulesArray];
      }
      const all = $page.variables.poSchedulesAllArray;

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
            status: meta.status, projectManager: meta.projectManager
          };
          $page.variables.businessUnitArray = (meta.businessUnits || []).map(v => ({ value: v, label: v }));
          $page.variables.projectOrgArray = (meta.orgs || []).map(v => ({ value: v, label: v }));
        } else {
          $page.variables.planHeader = { projectName: '', businessUnit: '', projectOrg: '', status: '', projectManager: '' };
        }
        $page.variables.lastProjectNumber = pn;
      }

      const effBU = selected.businessUnit || $page.variables.planHeader.businessUnit;
      const effOrg = selected.projectOrg || $page.variables.planHeader.projectOrg;

      let rows = [...all];
      if (pn) rows = rows.filter(r => r.projectNumber === pn);
      if (effBU) rows = rows.filter(r => r.businessUnit === effBU);
      if (effOrg) rows = rows.filter(r => r.projectOrg === effOrg);
      if (selected.critical) rows = rows.filter(r => r.critical === selected.critical);
      if (selected.assignee) rows = rows.filter(r => r.assignee === selected.assignee);
      if (keyword) {
        const words = String(keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const KW = ['poNumber', 'itemNumber', 'itemDescription', 'supplier'];
        rows = rows.filter(item => words.some(w => KW.some(f => item[f] && String(item[f]).toLowerCase().includes(w))));
      }
      $page.variables.poSchedulesArray = rows;
    }
  }
  return FilterChain;
});
