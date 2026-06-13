/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /** Close the Add/Edit drawer without saving. */
  class CloseDrawer extends ActionChain {
    async run(context) {
      context.$page.variables.drawerOpen = false;
    }
  }

  return CloseDrawer;
});
