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
   * Collection-container actions.
   *  - readyForProcurement: promote the SELECTED plan lines Draft -> Ready for
   *    Procurement via postPDSCPlanDetails (one POST per line), then reload the grid.
   *  - import / gantt / export: placeholders (toast) for a later phase.
   */
  class SecondaryActionChain extends ActionChain {
    async run(context, { detail }) {
      const id = detail && (detail.actionId || detail.secondaryItem || detail.id);
      if (id === 'readyForProcurement') {
        return this.markReady(context);
      }
      const labels = { export: 'Export started', import: 'Import — coming in a later phase', gantt: 'Gantt — coming in a later phase' };
      await this.toast(context, labels[id] || ('Action: ' + id));
    }

    async toast(context, message) {
      await Actions.fireNotificationEvent(context, {
        summary: 'Project Procurement Plan', message: message,
        severity: 'confirmation', type: 'confirmation', displayMode: 'transient'
      });
    }

    async markReady(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const header = $page.variables.planHeader || {};

      // resolve selected row keys (plan_id) from the table's selected.row KeySet
      const ks = $page.variables.selectedKeys;
      let keys = [];
      try {
        if (ks) {
          if (typeof ks.isAddAll === 'function' && ks.isAddAll()) {
            keys = ($page.variables.planLinesArray || []).map((r) => r.plan_id);
          } else if (typeof ks.values === 'function') {
            keys = Array.from(ks.values());
          } else if (ks.keys) {
            keys = Array.from(ks.keys);
          }
        }
      } catch (e) { keys = []; }

      const rows = ($page.variables.planLinesArray || [])
        .filter((r) => keys.indexOf(r.plan_id) !== -1 && r.status !== 'Ready for Procurement');

      if (!rows.length) {
        await this.toast(context, 'Select one or more Draft lines to mark Ready for Procurement.');
        return;
      }

      let ok = 0;
      for (const row of rows) {
        const body = {
          acquisition_strategy_objective: row.acquisition_strategy_objective,
          buyer: row.buyer,
          critical_flag: row.critical_flag,
          currency_code: row.currency_code,
          destination_type: row.destination_type,
          expenditure_type: row.expenditure_type,
          expenditure_type_id: row.expenditure_type_id,
          inv_org_name: row.inv_org_name,
          inventory_org_id: row.inventory_org_id,
          item_category: row.item_category,
          item_desc: row.item_desc,
          item_number: row.item_number,
          item_onhand: row.item_onhand,
          line_number: row.line_number,
          line_type: row.line_type,
          negotiation: row.negotiation,
          organization_code: row.organization_code,
          plan_id: row.plan_id,
          planned_cost: row.planned_cost,
          planned_finish_date: toDDMMYYYY(row.planned_finish_date),
          planned_quantity: row.planned_quantity,
          planned_start_date: toDDMMYYYY(row.planned_start_date),
          project_id: header.projectId != null ? header.projectId : row.project_id,
          project_number: header.projectNumber || row.project_number,
          requested_delivery_date: toDDMMYYYY(row.requested_delivery_date),
          status: 'Ready for Procurement',
          supplier: row.supplier,
          supplier_email_address: row.supplier_email_address,
          tag_number: row.tag_number,
          task_id: row.task_id,
          task_name: row.task_name,
          task_number: row.task_number,
          uom: row.uom,
          p_plan_id: row.plan_id,
          user_name: user
        };
        try {
          const res = await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/postPDSCPlanDetails',
            body,
            headers: { 'R_PAGE_NAME': 'project-procurement-plan', 'R_USER_NAME': user }
          });
          if (!res || res.ok !== false) ok++;
        } catch (e) { /* per-line failure tolerated; continue */ }
      }

      // reload the project's plan lines so the new statuses show
      const pn = header.projectNumber || $page.variables.lastProjectNumber;
      if (ok && pn) {
        try {
          const r = await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/getPDSCPlanDetails',
            uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 5000 }
          });
          const fresh = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
          $page.variables.planLinesAllArray = fresh;
          $page.variables.planLinesArray = fresh;
        } catch (e) { /* keep current data on reload failure */ }
        $page.variables.selectedKeys = null;
      }

      await this.toast(context, ok
        ? (ok + ' line' + (ok > 1 ? 's' : '') + ' marked Ready for Procurement.')
        : 'No lines were updated.');
    }
  }

  return SecondaryActionChain;
});
