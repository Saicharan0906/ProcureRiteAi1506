/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /** Inventory Org select cascade: capture inventory_org_id + organization_code for the POST body. */
  class InvOrgChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const d = detail && detail.itemContext && detail.itemContext.data;
      if (!d) return;
      $page.variables.planForm = Object.assign({}, $page.variables.planForm, {
        inventory_org_id: d.organization_id != null ? d.organization_id : null,
        organization_code: d.organization_code != null ? d.organization_code : ''
      });
    }
  }

  return InvOrgChanged;
});
