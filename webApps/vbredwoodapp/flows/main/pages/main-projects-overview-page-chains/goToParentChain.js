/* Copyright (c) 2026, Oracle and/or its affiliates */

define([
  'vb/action/actionChain',
  'vb/action/builtin/navigateToPageAction'
], function (ActionChain, NavigateToPageAction) {
  'use strict';

  class GoToParentChain extends ActionChain {
    async run(context) {
      await this.doAction(NavigateToPageAction, context, {
        page: 'main-erp-dashboard'
      });
    }
  }

  return GoToParentChain;
});
