/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Page enter: highlight the nav tab and load the smart-search filter LOVs from the
   * ORDS PDSCBUDetails service:
   *   - Project Number  -> getPDSCProjectDetails (field project_number)
   *   - Business Unit   -> getPDSCBUDetails      (field bu_name)
   *   - Item Category   -> getPDSCItemCategories (field category_code)
   * Project Organization and Buyer are BU-dependent, so they load in filterChain once
   * a project (hence a BU) is selected.
   *
   * LOV loads are best-effort and independent (Promise.allSettled) — one failing
   * endpoint never blanks the others or breaks the page.
   */
  class VbEnterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      $application.variables.activeNavTab = 'main-project-procurement-plan';
      const user = $application.variables.user || 'ProcureRite';

      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      const opts = (arr, field) => arr
        .map((o) => ({ value: o[field], label: o[field] }))
        .filter((o) => o.value !== null && o.value !== undefined && o.value !== '');

      const [proj, bu, cat] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCProjectDetails', uriParams: { P_USERNAME: user } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCBUDetails' }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCItemCategories', uriParams: { P_ITEM_NUMBER: '' } })
      ]);

      if (proj.status === 'fulfilled') {
        const seen = {};
        $page.variables.projectNumberArray = opts(items(proj.value), 'project_number').filter((o) => {
          if (seen[o.value]) return false; seen[o.value] = true; return true;
        });
      }
      if (bu.status === 'fulfilled') $page.variables.businessUnitArray = opts(items(bu.value), 'bu_name');
      if (cat.status === 'fulfilled') $page.variables.itemCategoryArray = opts(items(cat.value), 'category_code');
    }
  }

  return VbEnterChain;
});
