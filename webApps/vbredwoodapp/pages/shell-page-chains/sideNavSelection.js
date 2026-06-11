/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Left-drawer navigation-list selection. Navigates to the chosen page only on a
   * real user selection (updatedFrom 'internal'), then closes the drawer. Guards
   * against programmatic selection changes (e.g. activeNavTab sync) to avoid loops.
   */
  class SideNavSelection extends ActionChain {
    async run(context, params) {
      const detail = params && params.event && params.event.detail;
      if (!detail) return;
      if (detail.updatedFrom && detail.updatedFrom !== 'internal') return;

      const pageId = detail.value;
      if (!pageId || pageId === detail.previousValue) {
        context.$page.variables.navDrawerOpen = false;
        return;
      }

      context.$application.variables.activeNavTab = pageId;
      context.$page.variables.navDrawerOpen = false;
      context.$page.variables.isNavigating = true;
      try {
        await Actions.navigateToFlow(context, { flow: 'main', page: pageId });
      } finally {
        context.$page.variables.isNavigating = false;
      }
    }
  }

  return SideNavSelection;
});
