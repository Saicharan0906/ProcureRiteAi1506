/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Primary action = "Add Line". Seed a blank Draft plan line, load the drawer LOVs for
   * the current project/BU, then open the Add/Edit drawer in create mode.
   */
  class PrimaryActionChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      const h = $page.variables.planHeader || {};
      if (!h.projectNumber) {
        await Actions.fireEvent(context, {
          event: 'application:spShowToast',
          payload: { detail: { message: 'Select a Project Number first, then Add Line.' } }
        });
        return;
      }

      const lines = $page.variables.planLinesAllArray || [];
      const nextNum = lines.reduce((m, l) => Math.max(m, Number(l.line_number) || 0), 0) + 1;

      $page.variables.planForm = {
        plan_id: null, line_number: nextNum, critical_flag: 'No', line_type: 'Goods',
        item_number: '', item_desc: '', item_category: '', task_number: '', task_name: '', task_id: null,
        planned_quantity: null, uom: '', planned_cost: null, currency_code: 'USD', buyer: '', supplier: '',
        supplier_email_address: '', expenditure_type: 'Material', expenditure_type_id: null,
        inv_org_name: '', inventory_org_id: null, organization_code: '', destination_type: 'Expense',
        acquisition_strategy_objective: 'On time Delivery', planned_start_date: '', planned_finish_date: '',
        requested_delivery_date: '', item_onhand: null, tag_number: '', status: 'Draft', isNew: 'Y'
      };
      $page.variables.drawerMode = 'create';

      try { await Actions.callChain(context, { chain: 'loadDrawerLovs' }); } catch (e) { /* LOVs best-effort */ }
      $page.variables.drawerOpen = true;
    }
  }

  return PrimaryActionChain;
});
