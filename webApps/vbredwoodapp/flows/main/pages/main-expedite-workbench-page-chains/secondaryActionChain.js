/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';
  /** Hold / Release Hold / Email Supplier. Placeholders; wire to Fusion PO hold/
      removeHold + OIC sendmail later. */
  class SecondaryActionChain extends ActionChain {
    async run(context, { detail }) {
      const id = detail && (detail.secondaryItem || detail.id);
      const labels = {
        hold: 'Placed selected PO line(s) on hold',
        releaseHold: 'Released hold on selected PO line(s)',
        email: 'Opening supplier email'
      };
      await Actions.fireEvent(context, {
        event: 'application:spShowToast',
        payload: { detail: { message: labels[id] || ('Action: ' + id) } }
      });
    }
  }
  return SecondaryActionChain;
});
