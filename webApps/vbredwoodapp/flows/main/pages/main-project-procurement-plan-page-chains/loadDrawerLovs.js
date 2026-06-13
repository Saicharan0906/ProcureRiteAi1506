/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the Add/Edit drawer LOVs from ORDS for the currently selected project/BU:
   *   - Task         -> getPDSCGetTaskByProject(P_PROJECT_NUMBER)
   *   - Item         -> getPDSCItemDetails       (cascades: description, UOM, on-hand)
   *   - Supplier     -> getPDSCSupplierDetails
   *   - Expenditure  -> getPDSCEXPTypes          (cascade: expenditure_type_id)
   *   - Inventory Org-> getPDSCGetInvOrgsByBU     (cascade: org id + code)
   *   - Currency     -> getPDSCCurrencyCode
   * Line Type / Destination / Strategy / Critical are static client-side enums.
   * All loads are best-effort (Promise.allSettled) so one failure never blanks the rest.
   */
  class LoadDrawerLovs extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const h = $page.variables.planHeader || {};
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      // Cache: the drawer LOVs depend on the project/BU — skip the reload if we already
      // loaded them for this project (makes re-opening Add/Edit instant).
      const key = h.projectNumber || '';
      if (key && $page.variables.drawerLovsLoadedFor === key && (($page.variables.itemArray || []).length || ($page.variables.currencyArray || []).length)) {
        return;
      }

      const LIMIT = 1000;
      const [task, item, sup, exp, inv, cur] = await Promise.allSettled([
        h.projectNumber ? Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetTaskByProject', uriParams: { P_PROJECT_NUMBER: h.projectNumber, P_USERNAME: user, limit: LIMIT } }) : Promise.resolve(null),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCItemDetails', uriParams: { P_USERNAME: user, p_organization_name: '', limit: LIMIT } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCSupplierDetails', uriParams: { P_USERNAME: user, limit: LIMIT } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCEXPTypes', uriParams: { limit: LIMIT } }),
        h.businessUnit ? Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetInvOrgsByBU', uriParams: { p_business_unit_name: h.businessUnit, limit: LIMIT } }) : Promise.resolve(null),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCCurrencyCode', uriParams: { limit: LIMIT } })
      ]);

      if (task.status === 'fulfilled' && task.value) $page.variables.taskArray = items(task.value);
      if (item.status === 'fulfilled') $page.variables.itemArray = items(item.value);
      if (sup.status === 'fulfilled') $page.variables.supplierArray = items(sup.value);
      if (exp.status === 'fulfilled') $page.variables.expTypeArray = items(exp.value);
      if (inv.status === 'fulfilled' && inv.value) $page.variables.invOrgArray = items(inv.value);
      if (cur.status === 'fulfilled') $page.variables.currencyArray = items(cur.value);

      $page.variables.drawerLovsLoadedFor = key;
    }
  }

  return LoadDrawerLovs;
});
