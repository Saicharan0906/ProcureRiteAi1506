/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Close the Create Purchase Requisition drawer. */
  class ClosePrDrawer extends ActionChain {
    async run(context) {
      context.$page.variables.prDrawerOpen = false;
    }
  }

  return ClosePrDrawer;
});
