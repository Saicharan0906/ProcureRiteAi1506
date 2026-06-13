/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * Row "Edit" action: read the clicked row off the button's data-row attribute, copy it
   * into planForm, load the drawer LOVs, and open the drawer in edit mode.
   */
  class EditRow extends ActionChain {
    async run(context, { event }) {
      const { $page } = context;
      let row = null;
      try {
        const el = event && (event.currentTarget || event.target);
        const json = el && el.getAttribute && el.getAttribute('data-row');
        if (json) row = JSON.parse(json);
      } catch (e) { row = null; }
      if (!row) return;

      $page.variables.planForm = Object.assign({}, $page.variables.planForm, row, { isNew: 'N' });
      $page.variables.drawerMode = 'edit';

      try { await Actions.callChain(context, { chain: 'loadDrawerLovs' }); } catch (e) { /* LOVs best-effort */ }
      $page.variables.drawerOpen = true;
    }
  }

  return EditRow;
});
