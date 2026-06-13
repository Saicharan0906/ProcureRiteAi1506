/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Primary action = "Add Line".
   *
   * The read path (LOVs, project cascade, header, live plan lines, filters) and the
   * Ready-for-Procurement write are wired to ORDS. The full Add/Edit create form
   * (drawer with ~20 fields + cascading LOVs: task, item, item-category, buyer,
   * supplier, currency, expenditure type, inventory org, dates -> postPDSCPlanDetails
   * INSERT) is the next phase. For now surface a clear toast instead of a half-working
   * inline draft that cannot be saved.
   */
  class PrimaryActionChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      const hasProject = $page.variables.planHeader && $page.variables.planHeader.projectNumber;
      const message = hasProject
        ? 'Add Line — the create form (item, task, qty, cost, buyer, supplier, dates) is the next phase.'
        : 'Select a Project Number first, then Add Line.';
      await Actions.fireEvent(context, {
        event: 'application:spShowToast',
        payload: { detail: { message } }
      });
    }
  }

  return PrimaryActionChain;
});
