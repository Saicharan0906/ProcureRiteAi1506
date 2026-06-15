/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  // -> "DD-MM-YYYY". String-split YYYY-MM-DD / ISO (no Date object — avoids the
  //    timezone off-by-one the old app's convertDateFormat also avoids); fall back to Date.
  function toDDMMYYYY(v) {
    if (!v) return null;
    const datePart = String(v).split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  /**
   * Save the drawer's plan line via postPDSCPlanDetails (one endpoint for INSERT & UPDATE).
   * Body mirrors the old working saveplanDialog payload. Feedback uses fireNotificationEvent
   * (the shell-rendered notification the old app uses) — spShowToast was not surfacing.
   */
  class SavePlanLine extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const f = $page.variables.planForm || {};
      const h = $page.variables.planHeader || {};

      if (!f.item_number) {
        await this.notify(context, 'Validation', 'Item Number is required.', 'warning');
        return;
      }
      $page.variables.drawerSaving = true;

      const body = {
        enable_expediting: f.enable_expediting != null ? f.enable_expediting : null,
        business_unit_name: h.businessUnit,
        project_owning_org: h.projectOrg,
        business_unit_id: h.buId != null ? h.buId : null,
        acquisition_strategy_objective: f.acquisition_strategy_objective,
        inventory_org_id: f.inventory_org_id,
        buyer: f.buyer,
        tag_number: f.tag_number,
        critical_flag: f.critical_flag,
        currency_code: f.currency_code,
        destination_type: f.destination_type,
        expenditure_type: f.expenditure_type,
        expenditure_type_id: f.expenditure_type_id,
        inv_org_name: f.inv_org_name,
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
        project_number: h.projectNumber,
        requested_delivery_date: toDDMMYYYY(f.requested_delivery_date),
        status: f.status || 'Draft',
        task_id: f.task_id,
        task_name: f.task_name,
        task_number: f.task_number,
        uom: f.uom,
        user_name: user,
        project_id: h.projectId
      };
      if ($page.variables.drawerMode === 'edit' && f.plan_id != null) {
        body.plan_id = f.plan_id;
        body.p_plan_id = f.plan_id;
      } else {
        body.isNew = 'Y';
      }

      try {
        const res = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/postPDSCPlanDetails',
          body,
          headers: { 'R_PAGE_NAME': 'project-procurement-plan', 'R_USER_NAME': user }
        });
        if (res && res.ok === false) {
          const msg = (res.body && (res.body.detail || res.body.message)) || ('Save failed (HTTP ' + res.status + ')');
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
      } catch (e) {
        $page.variables.drawerSaving = false;
        await this.notify(context, 'Save failed', (e && e.message) || 'Unknown error saving the plan line.', 'error', 'persist');
        return;
      }

      $page.variables.drawerSaving = false;
      await this.reload(context);
      $page.variables.drawerOpen = false;
      await this.notify(context, 'Saved',
        $page.variables.drawerMode === 'edit' ? 'Plan line updated.' : 'Plan line added.', 'confirmation');
    }

    async reload(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const pn = ($page.variables.planHeader && $page.variables.planHeader.projectNumber) || $page.variables.lastProjectNumber;
      if (!pn) return;
      try {
        const r = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/getPDSCPlanDetails', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 5000 }
        });
        const fresh = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
        $page.variables.planLinesAllArray = fresh;
        $page.variables.planLinesArray = fresh;
      } catch (e) { /* keep current data on reload failure */ }
    }

    async notify(context, summary, message, type, displayMode) {
      await Actions.fireNotificationEvent(context, {
        summary: summary,
        message: message,
        severity: type,
        type: type,
        displayMode: displayMode || 'transient'
      });
    }
  }

  return SavePlanLine;
});
