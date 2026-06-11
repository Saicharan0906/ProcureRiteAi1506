/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';
  /** Primary action = Refresh ERP Details (placeholder toast; wire to OIC RefreshERP later). */
  class PrimaryActionChain extends ActionChain {
    async run(context) {
      await Actions.fireEvent(context, {
        event: 'application:spShowToast',
        payload: { detail: { message: 'Refreshing ERP details…' } }
      });
    }
  }
  return PrimaryActionChain;
});
