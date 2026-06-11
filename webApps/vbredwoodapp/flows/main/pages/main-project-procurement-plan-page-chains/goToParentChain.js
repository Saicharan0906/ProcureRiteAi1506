/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  class GoToParentChain extends ActionChain {
    async run(context) {
      await Actions.navigateToPage(context, { page: 'main-erp-dashboard' });
    }
  }

  return GoToParentChain;
});
