/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Actions menu dispatcher: Purchase Requisition / Purchase Order / Negotiation /
   * Initiate Supply Plan. Purchase Requisition is fully wired (opens the PR drawer on the
   * selected ready lines -> Fusion purchaseRequisitions POST). The remaining three still
   * acknowledge with a notification pending their own port (PO -> draftPurchaseOrders,
   * Negotiation -> supplierNegotiations, Initiate Supply Plan -> OIC FORECAST_FBDI).
   */
  class SecondaryActionChain extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const id = detail && (detail.secondaryItem || detail.id || detail);

      if (id === 'purchaseRequisition') {
        await Actions.callChain(context, { chain: 'openPrDrawer' });
        return;
      }
      if (id === 'purchaseOrder') {
        await Actions.callChain(context, { chain: 'openPoDrawer' });
        return;
      }
      if (id === 'negotiation') {
        await Actions.callChain(context, { chain: 'openNegDrawer' });
        return;
      }

      const labels = {
        initiateSupplyPlan: 'Initiate Supply Plan'
      };
      const name = labels[id] || ('Action: ' + id);

      await Actions.fireNotificationEvent(context, {
        summary: name,
        message: name + ' — needs the OIC connection (Refresh ERP / Initiate Supply Plan). PR, PO and Negotiation are live.',
        severity: 'info', type: 'info', displayMode: 'transient'
      });
    }
  }

  return SecondaryActionChain;
});
