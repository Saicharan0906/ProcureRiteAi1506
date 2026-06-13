/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  // ISO / Date -> "DD-MM-YYYY" (the format the ORDS postPDSCPlanDetails handler expects)
  function toDDMMYYYY(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  /**
   * Save the drawer's plan line via postPDSCPlanDetails (one endpoint for INSERT & UPDATE):
   *   - create  -> isNew:'Y', no plan_id
   *   - edit    -> plan_id + p_plan_id
   * Then reload the project's plan lines and close the drawer.
   */
  class SavePlanLine extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const f = $page.variables.planForm || {};
      const h = $page.variables.planHeader || {};

      if (!f.item_number) {
        await this.toast(context, 'Item Number is required.');
        return;
      }
      $page.variables.drawerSaving = true;

      const body = {
        acquisition_strategy_objective: f.acquisition_strategy_objective,
        buyer: f.buyer,
        critical_flag: f.critical_flag,
        currency_code: f.currency_code,
        destination_type: f.destination_type,
        expenditure_type: f.expenditure_type,
        expenditure_type_id: f.expenditure_type_id,
        inv_org_name: f.inv_org_name,
        inventory_org_id: f.inventory_org_id,
        item_category: f.item_category,
        item_desc: f.item_desc,
        item_number: f.item_number,
        item_onhand: f.item_onhand,
        line_number: f.line_number,
        line_type: f.line_type,
        organization_code: f.organization_code,
        planned_cost: f.planned_cost,
        planned_finish_date: toDDMMYYYY(f.planned_finish_date),
        planned_quantity: f.planned_quantity,
        planned_start_date: toDDMMYYYY(f.planned_start_date),
        project_id: h.projectId,
        project_number: h.projectNumber,
        requested_delivery_date: toDDMMYYYY(f.requested_delivery_date),
        status: f.status || 'Draft',
        supplier: f.supplier,
        supplier_email_address: f.supplier_email_address,
        tag_number: f.tag_number,
        task_id: f.task_id,
        task_name: f.task_name,
        task_number: f.task_number,
        uom: f.uom,
        user_name: user,
        business_unit_name: h.businessUnit,
        business_unit_id: null,
        project_owning_org: h.projectOrg
      };
      if ($page.variables.drawerMode === 'edit' && f.plan_id != null) {
        body.plan_id = f.plan_id;
        body.p_plan_id = f.plan_id;
      } else {
        body.isNew = 'Y';
      }

      let ok = false;
      try {
        const res = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/postPDSCPlanDetails',
          body,
          headers: { 'R_PAGE_NAME': 'project-procurement-plan', 'R_USER_NAME': user }
        });
        ok = !res || res.ok !== false;
      } catch (e) { ok = false; }

      $page.variables.drawerSaving = false;

      if (!ok) {
        await this.toast(context, 'Save failed. Please review the line and try again.');
        return;
      }

      await this.reload(context);
      $page.variables.drawerOpen = false;
      await this.toast(context, $page.variables.drawerMode === 'edit' ? 'Plan line updated.' : 'Plan line added.');
    }

    async reload(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const pn = ($page.variables.planHeader && $page.variables.planHeader.projectNumber) || $page.variables.lastProjectNumber;
      if (!pn) return;
      try {
        const r = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/getPDSCPlanDetails', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user }
        });
        const fresh = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
        $page.variables.planLinesAllArray = fresh;
        $page.variables.planLinesArray = fresh;
      } catch (e) { /* keep current data on reload failure */ }
    }

    async toast(context, message) {
      await Actions.fireEvent(context, { event: 'application:spShowToast', payload: { detail: { message } } });
    }
  }

  return SavePlanLine;
});
