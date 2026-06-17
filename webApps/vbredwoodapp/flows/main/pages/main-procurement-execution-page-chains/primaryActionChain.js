/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Primary action = Refresh ERP Details. Phase 1 acknowledges; the OIC sync
   * (PDSC_REQ_PO_REC_DETAILS) + reload is the next phase.
   */
  class PrimaryActionChain extends ActionChain {
    async run(context) {
      await Actions.fireNotificationEvent(context, {
        summary: 'Refresh ERP Details',
        message: 'Refresh ERP (OIC sync) wiring is the next phase.',
        severity: 'info', type: 'info', displayMode: 'transient'
      });
    }
  }

  return PrimaryActionChain;
});
