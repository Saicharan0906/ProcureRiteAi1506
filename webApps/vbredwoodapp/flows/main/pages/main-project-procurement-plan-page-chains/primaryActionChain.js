/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Primary action = "Add Line". Placeholder: appends a new draft plan line to the
   * mock array. Replace with create-line drawer + ORDS postPDSCPlanDetails when wired.
   */
  class PrimaryActionChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      const lines = $page.variables.planLinesArray || [];
      const nextNum = lines.reduce((m, l) => Math.max(m, l.lineNumber || 0), 0) + 1;
      const newLine = {
        id: Date.now(), lineNumber: nextNum, critical: 'No', lineType: 'Goods',
        itemNumber: '', itemDescription: '', itemCategory: '', taskName: '',
        plannedQuantity: 0, uom: '', plannedCost: 0, currency: 'USD',
        buyer: '', supplier: '', expenditureType: '', status: 'Draft'
      };
      $page.variables.planLinesArray = [...lines, newLine];
    }
  }

  return PrimaryActionChain;
});
