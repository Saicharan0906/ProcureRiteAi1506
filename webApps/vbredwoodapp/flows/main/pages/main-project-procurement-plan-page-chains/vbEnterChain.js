/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  class VbEnterChain extends ActionChain {
    /**
     * Highlights the Project Procurement Plan tab in the footer nav when the page
     * is loaded directly. (Data is mock placeholder; ORDS/Fusion wiring is a later phase.)
     */
    async run(context) {
      context.$application.variables.activeNavTab = 'main-project-procurement-plan';
    }
  }

  return VbEnterChain;
});
