/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Close the Create Purchase Order drawer. */
  class ClosePoDrawer extends ActionChain {
    async run(context) {
      context.$page.variables.poDrawerOpen = false;
    }
  }

  return ClosePoDrawer;
});
