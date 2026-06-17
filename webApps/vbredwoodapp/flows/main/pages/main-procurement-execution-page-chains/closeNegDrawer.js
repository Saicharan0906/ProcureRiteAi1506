/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Close the Create Negotiation drawer. */
  class CloseNegDrawer extends ActionChain {
    async run(context) {
      context.$page.variables.negDrawerOpen = false;
    }
  }

  return CloseNegDrawer;
});
