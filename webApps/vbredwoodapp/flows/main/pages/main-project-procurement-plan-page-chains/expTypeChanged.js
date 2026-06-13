/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /** Expenditure Type select cascade: capture expenditure_type_id for the POST body. */
  class ExpTypeChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const d = detail && detail.itemContext && detail.itemContext.data;
      if (!d) return;
      $page.variables.planForm = Object.assign({}, $page.variables.planForm, {
        expenditure_type_id: d.expenditure_type_id != null ? d.expenditure_type_id : null
      });
    }
  }

  return ExpTypeChanged;
});
