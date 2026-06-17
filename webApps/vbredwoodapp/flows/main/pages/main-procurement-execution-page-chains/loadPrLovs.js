/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the PR drawer LOVs for the current project's Business Unit:
   *  - Preparer / Requester people  -> ORDS getPDSCPreparerRequesterDetails (BU + user scoped)
   *  - Destination organizations    -> ORDS getPDSCGetInvOrgsByBU
   * Cached per BU so re-opening the drawer for the same project does not re-fetch.
   */
  class LoadPrLovs extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const bu = ($page.variables.planHeader && $page.variables.planHeader.businessUnit) || '';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      if ($page.variables.prLovsLoadedFor === bu && ($page.variables.personArray || []).length) return;

      const [persons, orgs] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCPreparerRequesterDetails', uriParams: { BU_NAME: bu, P_USERNAME: user, limit: 1000 } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCGetInvOrgsByBU', uriParams: { p_business_unit_name: bu, limit: 1000 } })
      ]);

      if (persons.status === 'fulfilled') $page.variables.personArray = items(persons.value);
      if (orgs.status === 'fulfilled') $page.variables.destOrgArray = items(orgs.value);
      $page.variables.prLovsLoadedFor = bu;
    }
  }

  return LoadPrLovs;
});
