/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  class ResetActionChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      $page.variables.filter = {
        projectNumber: null, projectName: '', businessUnit: null,
        projectOrg: null, itemCategory: null, buyer: null
      };
      if ($page.variables.planLinesAllArray && $page.variables.planLinesAllArray.length) {
        $page.variables.planLinesArray = [...$page.variables.planLinesAllArray];
      }
    }
  }

  return ResetActionChain;
});
