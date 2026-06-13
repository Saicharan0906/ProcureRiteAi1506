/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Page enter: highlight the nav tab and load the two SMALL filter LOVs (Business Unit,
   * Item Category) in one fast call each. Project Number is NOT bulk-loaded anymore — its
   * smart-search filter is backed by a ServiceDataProvider (projectSDP) that searches the
   * server as the user types, so the page loads instantly regardless of project count.
   * Project Org & Buyer are BU-dependent and load in filterChain after a project is picked.
   */
  class VbEnterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      $application.variables.activeNavTab = 'main-project-procurement-plan';

      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      const opts = (arr, field) => {
        const seen = Object.create(null);
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      const [bu, cat] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCBUDetails', uriParams: { limit: 1000 } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCItemCategories', uriParams: { P_ITEM_NUMBER: '', limit: 1000 } })
      ]);

      if (bu.status === 'fulfilled') $page.variables.businessUnitArray = opts(items(bu.value), 'bu_name');
      if (cat.status === 'fulfilled') $page.variables.itemCategoryArray = opts(items(cat.value), 'category_code');
    }
  }

  return VbEnterChain;
});
