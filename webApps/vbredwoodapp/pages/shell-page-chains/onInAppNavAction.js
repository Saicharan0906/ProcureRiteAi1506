/* Copyright (c) 2026, Oracle and/or its affiliates */

define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  class OnInAppNavActionChain extends ActionChain {

    /**
     * Handle footer in-app navigation tab selection.
     * Syncs the active tab highlight then navigates to the selected page.
     *
     * @param {object} context
     * @param {object} params
     * @param {object} params.event  The spSelectionAction event payload
     */
    async run(context, params) {
      const event = params && params.event;
      const currentId = event && event.detail && (event.detail.currentId || event.detail.id);

      if (!currentId) {
        return;
      }

      // Sync the active tab highlight immediately so the UI responds before navigation
      context.$application.variables.activeNavTab = currentId;

      // Show a loading overlay for the duration of the page transition
      context.$page.variables.isNavigating = true;
      try {
        await Actions.navigateToFlow(context, {
          flow: 'main',
          page: currentId
        });
      } finally {
        context.$page.variables.isNavigating = false;
      }
    }
  }

  return OnInAppNavActionChain;
});
