/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Search = filter the plan lines by the selected header filters.
   * Mock client-side filter for now; replace with ORDS getPDSCPlanDetails
   * (server-side, parameterized by project/BU/org/category/buyer) when wired.
   */
  class SearchActionChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      const f = $page.variables.filter || {};
      const all = $page.variables.planLinesAllArray && $page.variables.planLinesAllArray.length
        ? $page.variables.planLinesAllArray
        : $page.variables.planLinesArray;
      // keep a pristine copy on first search
      if (!$page.variables.planLinesAllArray || !$page.variables.planLinesAllArray.length) {
        $page.variables.planLinesAllArray = [...all];
      }
      let rows = [...$page.variables.planLinesAllArray];
      if (f.itemCategory) rows = rows.filter(r => r.itemCategory === f.itemCategory);
      if (f.buyer) rows = rows.filter(r => r.buyer === f.buyer);
      $page.variables.planLinesArray = rows;
    }
  }

  return SearchActionChain;
});
