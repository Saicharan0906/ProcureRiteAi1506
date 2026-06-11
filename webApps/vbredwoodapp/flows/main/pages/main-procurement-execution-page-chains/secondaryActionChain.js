/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';
  /** Purchase Requisition / Purchase Order / Negotiation. Placeholders; wire to
      Fusion purchaseRequisitions / draftPurchaseOrders / supplierNegotiations later. */
  class SecondaryActionChain extends ActionChain {
    async run(context, { detail }) {
      const id = detail && (detail.secondaryItem || detail.id);
      const labels = {
        purchaseRequisition: 'Creating Purchase Requisition for selected lines',
        purchaseOrder: 'Creating Purchase Order for selected lines',
        negotiation: 'Opening Negotiation / RFQ'
      };
      await Actions.fireEvent(context, {
        event: 'application:spShowToast',
        payload: { detail: { message: labels[id] || ('Action: ' + id) } }
      });
    }
  }
  return SecondaryActionChain;
});
