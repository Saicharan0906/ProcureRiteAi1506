/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Fetch ALL rows from an ORDS GET, paging past the default 25-row page cap.
   * Loops limit/offset until hasMore is false. De-dupes by keyField and stops if a
   * page adds nothing new (safety against an ORDS handler that ignores `offset`, so
   * we never spin on duplicate pages).
   */
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
   * Page enter: highlight the nav tab and load the smart-search filter LOVs (full lists,
   * not just ORDS page 1): Project Number / Business Unit / Item Category. Project Org &
   * Buyer are BU-dependent and load in filterChain after a project is picked.
   */
  class VbEnterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      $application.variables.activeNavTab = 'main-project-procurement-plan';
      const user = $application.variables.user || 'ProcureRite';

      const opts = (arr, field) => {
        const seen = Object.create(null);
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      const [proj, bu, cat] = await Promise.allSettled([
        fetchAll(context, 'PDSCBUDetails/getPDSCProjectDetails', { P_USERNAME: user }, 'project_number'),
        fetchAll(context, 'PDSCBUDetails/getPDSCBUDetails', {}, 'bu_name'),
        fetchAll(context, 'PDSCBUDetails/getPDSCItemCategories', { P_ITEM_NUMBER: '' }, 'category_code')
      ]);

      if (proj.status === 'fulfilled') $page.variables.projectNumberArray = opts(proj.value, 'project_number');
      if (bu.status === 'fulfilled') $page.variables.businessUnitArray = opts(bu.value, 'bu_name');
      if (cat.status === 'fulfilled') $page.variables.itemCategoryArray = opts(cat.value, 'category_code');
    }
  }

  return VbEnterChain;
});
