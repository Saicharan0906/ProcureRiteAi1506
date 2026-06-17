/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Template cascade: when both Negotiation Type and Style are chosen, load the matching
   * negotiation templates (ORDS getPDSCNegotiationTemplate, keyed by P_STYLE_NAME +
   * P_NEGOTIATION_TYPE). Clears the current template pick so the user re-selects a valid one.
   */
  class NegTemplateCascade extends ActionChain {
    async run(context) {
      const { $page } = context;
      const f = $page.variables.negForm || {};
      const style = f.negotiationStyle;
      const type = f.negotiationType;
      if (!style || !type) return;

      const f2 = Object.assign({}, f, { negotiationTemplate: '' });
      $page.variables.negForm = f2;
      $page.variables.negTemplateArray = [];

      try {
        const r = await Actions.callRest(context, {
          endpoint: 'PDSCBUDetails/getPDSCNegotiationTemplate',
          uriParams: { P_STYLE_NAME: style, P_NEGOTIATION_TYPE: type, limit: 300 }
        });
        $page.variables.negTemplateArray = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
      } catch (e) { /* best-effort */ }
    }
  }

  return NegTemplateCascade;
});
