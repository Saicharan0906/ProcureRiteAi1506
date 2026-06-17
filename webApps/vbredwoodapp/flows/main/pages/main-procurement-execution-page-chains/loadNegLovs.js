/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the Negotiation drawer header LOVs:
   *  - Type   -> ORDS getPDSCNegotiationType (negotiation_display_name)
   *  - Style  -> ORDS getPDSCNegotiationStyle (style_name)
   *  - Currency -> Fusion currenciesLOV (CurrencyCode)
   *  - Buyer  -> Fusion procurementAgents (Agent)
   * Template depends on Type + Style and is loaded by negTemplateCascade. Cached per BU.
   */
  class LoadNegLovs extends ActionChain {
    async run(context) {
      const { $page } = context;
      const bu = ($page.variables.planHeader && $page.variables.planHeader.businessUnit) || '';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      if ($page.variables.negLovsLoadedFor === bu && ($page.variables.negTypeArray || []).length) return;

      const [type, style, cur, buyer] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCNegotiationType', uriParams: { limit: 300 } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCNegotiationStyle', uriParams: { limit: 300 } }),
        Actions.callRest(context, { endpoint: 'FusionFSCM/getCurrencies', uriParams: { limit: 300, onlyData: true, fields: 'CurrencyCode,Name' } }),
        Actions.callRest(context, { endpoint: 'FusionFSCM/getProcurementAgents', uriParams: { limit: 500, onlyData: true, fields: 'AgentId,Agent' } })
      ]);

      if (type.status === 'fulfilled') $page.variables.negTypeArray = items(type.value);
      if (style.status === 'fulfilled') $page.variables.negStyleArray = items(style.value);
      if (cur.status === 'fulfilled') $page.variables.negCurrencyArray = items(cur.value);
      if (buyer.status === 'fulfilled') $page.variables.negBuyerArray = items(buyer.value);
      $page.variables.negLovsLoadedFor = bu;
    }
  }

  return LoadNegLovs;
});
