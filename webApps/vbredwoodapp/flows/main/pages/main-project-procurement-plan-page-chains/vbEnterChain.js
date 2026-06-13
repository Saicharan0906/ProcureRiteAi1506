/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Page enter: highlight the nav tab and load the smart-search filter LOVs
   * (Project Number / Business Unit / Item Category) in ONE fast call each (parallel) —
   * a single request with a high limit instead of page-by-page looping (the looping was
   * the slowness). Project Org & Buyer are BU-dependent and load in filterChain.
   */
  class VbEnterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      $application.variables.activeNavTab = 'main-project-procurement-plan';
      const user = $application.variables.user || 'ProcureRite';
      const LIMIT = 2000;

      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      const opts = (arr, field) => {
        const seen = Object.create(null);
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      const [proj, bu, cat] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCProjectDetails', uriParams: { P_USERNAME: user, limit: LIMIT } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCBUDetails', uriParams: { limit: LIMIT } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCItemCategories', uriParams: { P_ITEM_NUMBER: '', limit: LIMIT } })
      ]);

      if (proj.status === 'fulfilled') $page.variables.projectNumberArray = opts(items(proj.value), 'project_number');
      if (bu.status === 'fulfilled') $page.variables.businessUnitArray = opts(items(bu.value), 'bu_name');
      if (cat.status === 'fulfilled') $page.variables.itemCategoryArray = opts(items(cat.value), 'category_code');
    }
  }

  return VbEnterChain;
});
