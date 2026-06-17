/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Capture the selected Requester's display name (the id is two-way bound to prForm.requesterId). */
  class PrRequesterChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const data = detail && detail.itemContext && detail.itemContext.data;
      const f = Object.assign({}, $page.variables.prForm);
      if (data) { f.requesterId = data.person_id; f.requester = data.person_name; }
      else if (detail) { f.requesterId = detail.value; }
      $page.variables.prForm = f;
    }
  }

  return PrRequesterChanged;
});
