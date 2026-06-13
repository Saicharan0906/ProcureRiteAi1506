/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the SMALL Add/Edit drawer LOVs for the selected project/BU (one fast call each):
   *   - Task        -> getPDSCGetTaskByProject(P_PROJECT_NUMBER)  (cascades: start/finish dates)
   *   - Expenditure -> getPDSCEXPTypes                            (cascade: expenditure_type_id)
   *   - Inventory   -> getPDSCGetInvOrgsByBU                      (cascade: org id + code)
   *   - Currency    -> getPDSCCurrencyCode
   * Item & Supplier are NOT loaded here — they are backed by ServiceDataProviders
   * (itemSDP / supplierSDP) that search the server as the user types (no bulk load).
   * Line Type / Destination / Strategy / Critical are static client enums.
   * Cached per project so re-opening the drawer is instant.
   */
  class LoadDrawerLovs extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const h = $page.variables.planHeader || {};
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      const key = h.projectNumber || '';
      if (key && $page.variables.drawerLovsLoadedFor === key && (($page.variables.currencyArray || []).length || ($page.variables.expTypeArray || []).length)) {
        return;
      }

      const [task, exp, inv, cur] = await Promise.allSettled([
        h.projectNumber ? Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetTaskByProject', uriParams: { P_PROJECT_NUMBER: h.projectNumber, P_USERNAME: user, limit: 1000 } }) : Promise.resolve(null),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCEXPTypes', uriParams: { limit: 1000 } }),
        h.businessUnit ? Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetInvOrgsByBU', uriParams: { p_business_unit_name: h.businessUnit, limit: 1000 } }) : Promise.resolve(null),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCCurrencyCode', uriParams: { limit: 1000 } })
      ]);

      if (task.status === 'fulfilled' && task.value) $page.variables.taskArray = items(task.value);
      if (exp.status === 'fulfilled') $page.variables.expTypeArray = items(exp.value);
      if (inv.status === 'fulfilled' && inv.value) $page.variables.invOrgArray = items(inv.value);
      if (cur.status === 'fulfilled') $page.variables.currencyArray = items(cur.value);

      $page.variables.drawerLovsLoadedFor = key;
    }
  }

  return LoadDrawerLovs;
});
