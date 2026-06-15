/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /** Delete the plan line currently open in the drawer (edit mode) via deletePDSCPlanDetails. */
  class DeletePlanLine extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const f = $page.variables.planForm || {};

      if (f.plan_id == null) {
        $page.variables.drawerOpen = false;
        return;
      }

      let ok = false;
      try {
        const res = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/deletePDSCPlanDetails',
          uriParams: { plan_id: f.plan_id }
        });
        ok = !res || res.ok !== false;
      } catch (e) { ok = false; }

      if (!ok) {
        await this.notify(context, 'Delete failed', 'Could not delete the plan line. Please try again.', 'error', 'persist');
        return;
      }

      // reload the project's plan lines
      const pn = ($page.variables.planHeader && $page.variables.planHeader.projectNumber) || $page.variables.lastProjectNumber;
      if (pn) {
        try {
          const r = await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/getPDSCPlanDetails', uriParams: { P_PROJECT_NUMBER: pn, P_USERNAME: user, limit: 5000 }
          });
          const fresh = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
          $page.variables.planLinesAllArray = fresh;
          $page.variables.planLinesArray = fresh;
        } catch (e) { /* keep current data on reload failure */ }
      }

      $page.variables.drawerOpen = false;
      await this.notify(context, 'Deleted', 'Plan line deleted.', 'confirmation');
    }

    async notify(context, summary, message, type, displayMode) {
      await Actions.fireNotificationEvent(context, {
        summary: summary, message: message, severity: type, type: type, displayMode: displayMode || 'transient'
      });
    }
  }

  return DeletePlanLine;
});
