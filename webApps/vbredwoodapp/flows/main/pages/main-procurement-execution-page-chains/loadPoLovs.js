/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the PO drawer header LOVs:
   *  - Currency  -> Fusion currenciesLOV (CurrencyCode)
   *  - Buyer     -> Fusion procurementAgents (Agent)
   *  - Bill-To   -> Fusion inventoryOrganizationsLOV (OrganizationName)
   *  - Supplier  -> ORDS getPDSCSupplierDetails (vendor_name + vendor_number; Site/Email cascade
   *                 off the chosen supplier in poSupplierChanged)
   * Cached per BU. Fusion LOVs fall back to nothing on failure (best-effort); supplier is ORDS.
   */
  class LoadPoLovs extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const bu = ($page.variables.planHeader && $page.variables.planHeader.businessUnit) || '';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      if ($page.variables.poLovsLoadedFor === bu && ($page.variables.poSupplierArray || []).length) return;

      const [cur, buyer, billTo, sup] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'FusionFSCM/getCurrencies', uriParams: { limit: 300, onlyData: true, fields: 'CurrencyCode,Name' } }),
        Actions.callRest(context, { endpoint: 'FusionFSCM/getProcurementAgents', uriParams: { limit: 500, onlyData: true, fields: 'AgentId,Agent' } }),
        Actions.callRest(context, { endpoint: 'FusionFSCM/getInventoryOrgs', uriParams: { limit: 350, onlyData: true, fields: 'OrganizationId,OrganizationCode,OrganizationName' } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCSupplierDetails', uriParams: { P_USERNAME: user, limit: 1000 } })
      ]);

      if (cur.status === 'fulfilled') $page.variables.poCurrencyArray = items(cur.value);
      if (buyer.status === 'fulfilled') $page.variables.poBuyerArray = items(buyer.value);
      if (billTo.status === 'fulfilled') $page.variables.poBillToArray = items(billTo.value);
      if (sup.status === 'fulfilled') $page.variables.poSupplierArray = items(sup.value);
      $page.variables.poLovsLoadedFor = bu;
    }
  }

  return LoadPoLovs;
});
