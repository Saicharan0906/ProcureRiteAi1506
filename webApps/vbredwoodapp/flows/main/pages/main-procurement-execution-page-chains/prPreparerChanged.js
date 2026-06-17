/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'], (ActionChain) => {
  'use strict';

  /** Capture the selected Preparer's display name (the id is two-way bound to prForm.preparerId). */
  class PrPreparerChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const data = detail && detail.itemContext && detail.itemContext.data;
      const f = Object.assign({}, $page.variables.prForm);
      if (data) { f.preparerId = data.person_id; f.preparer = data.person_name; }
      else if (detail) { f.preparerId = detail.value; }
      $page.variables.prForm = f;
    }
  }

  return PrPreparerChanged;
});
