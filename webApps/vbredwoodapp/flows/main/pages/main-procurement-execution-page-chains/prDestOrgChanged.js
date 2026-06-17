/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Capture the selected Destination Organization name (the id is two-way bound to prForm.destinationId). */
  class PrDestOrgChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const data = detail && detail.itemContext && detail.itemContext.data;
      const f = Object.assign({}, $page.variables.prForm);
      if (data) { f.destinationId = data.organization_id; f.destinationorgname = data.organization_name; }
      else if (detail) { f.destinationId = detail.value; }
      $page.variables.prForm = f;
    }
  }

  return PrDestOrgChanged;
});
