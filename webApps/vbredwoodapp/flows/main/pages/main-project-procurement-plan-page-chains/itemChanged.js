/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /** Item select cascade: auto-fill Item Description, UOM and on-hand from the item LOV row. */
  class ItemChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const d = detail && detail.itemContext && detail.itemContext.data;
      if (!d) return;
      $page.variables.planForm = Object.assign({}, $page.variables.planForm, {
        item_desc: d.description != null ? d.description : '',
        uom: d.unit_of_measure != null ? d.unit_of_measure : '',
        item_onhand: d.item_onhand != null ? d.item_onhand : null
      });
    }
  }

  return ItemChanged;
});
