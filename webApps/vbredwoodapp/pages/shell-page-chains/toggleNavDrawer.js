/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  class ToggleNavDrawer extends ActionChain {
    async run(context) {
      context.$page.variables.navDrawerOpen = !context.$page.variables.navDrawerOpen;
    }
  }

  return ToggleNavDrawer;
});
