/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Header secondary actions: Ready for Procurement / Export / Import / Gantt.
   * Placeholders that fire a toast; wire to real behavior (ORDS status update,
   * xlsx export/import, Gantt dialog) in later phases.
   */
  class SecondaryActionChain extends ActionChain {
    async run(context, { detail }) {
      const id = detail && (detail.actionId || detail.secondaryItem || detail.id);
      const labels = {
        readyForProcurement: 'Marked selected lines Ready for Procurement',
        export: 'Export started',
        import: 'Import dialog',
        gantt: 'Opening Gantt view'
      };
      await Actions.fireEvent(context, {
        event: 'application:spShowToast',
        payload: { detail: { message: labels[id] || ('Action: ' + id) } }
      });
    }
  }

  return SecondaryActionChain;
});
