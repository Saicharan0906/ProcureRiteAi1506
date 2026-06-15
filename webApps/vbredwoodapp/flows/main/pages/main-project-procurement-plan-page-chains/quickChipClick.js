/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Quick-filter chip toggle (Draft / Ready for Procurement / Critical).
   * Toggles activeQuickChipId, then re-runs filterChain (which re-applies the
   * smart-search filters + this chip and recomputes the counts). Pure client-side.
   */
  class QuickChipClick extends ActionChain {
    async run(context, { chipId }) {
      const { $page } = context;
      $page.variables.activeQuickChipId =
        ($page.variables.activeQuickChipId === chipId) ? '' : (chipId || '');
      await Actions.callChain(context, { chain: 'filterChain' });
    }
  }

  return QuickChipClick;
});
