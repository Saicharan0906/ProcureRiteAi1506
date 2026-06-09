/* Copyright (c) 2026, Oracle and/or its affiliates */

define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  class VbEnterChain extends ActionChain {
    /**
     * Syncs the footer nav tab highlight when this page is loaded directly
     * (e.g. via URL refresh or bookmark) rather than via the nav bar tap.
     */
    async run(context) {
      context.$application.variables.activeNavTab = 'main-erp-dashboard';
    }
  }

  return VbEnterChain;
});
