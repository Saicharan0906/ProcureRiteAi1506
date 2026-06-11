/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /**
   * On Project Number change, auto-fill Project Name (and later BU/Org/Manager/dates
   * via ORDS getPDSCGetProjectByBU). Mock map for now.
   */
  class ProjectChangedChain extends ActionChain {
    async run(context) {
      const { $page } = context;
      const map = { 'P012025': 'Pinnacle Park Project', 'P012026': 'Riverside Expansion' };
      const pn = $page.variables.filter.projectNumber;
      $page.variables.filter = { ...$page.variables.filter, projectName: map[pn] || '' };
    }
  }

  return ProjectChangedChain;
});
