/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Load the PR drawer LOVs for the current project's Business Unit:
   *  - Destination organizations -> direct Fusion REST (inventoryOrganizationsLOV), ORDS
   *    getPDSCGetInvOrgsByBU only as a fallback (per the direct-REST convention).
   *  - Preparer / Requester people -> ORDS getPDSCPreparerRequesterDetails (no clean Fusion
   *    person LOV; this is a PDSC-curated list, kept on ORDS by design).
   * Cached per BU so re-opening the drawer for the same project does not re-fetch.
   */
  class LoadPrLovs extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const bu = ($page.variables.planHeader && $page.variables.planHeader.businessUnit) || '';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      if ($page.variables.prLovsLoadedFor === bu && ($page.variables.personArray || []).length) return;

      // Try Fusion first (map to the legacy field names the ADP/HTML bind); fall back to ORDS.
      const fusionOrOrds = async (fusion, mapFn, ords) => {
        try {
          const r = await Actions.callRest(context, fusion);
          const it = items(r);
          if (it.length) return it.map(mapFn);
        } catch (e) { /* fall through */ }
        try { return items(await Actions.callRest(context, ords)); } catch (e) { return []; }
      };

      const [persons, orgs] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCPreparerRequesterDetails', uriParams: { BU_NAME: bu, P_USERNAME: user, limit: 1000 } }),
        fusionOrOrds(
          { endpoint: 'FusionFSCM/getInventoryOrgs', uriParams: { limit: 350, onlyData: true, fields: 'OrganizationId,OrganizationCode,OrganizationName' } },
          (o) => ({ organization_id: o.OrganizationId, organization_name: o.OrganizationName, organization_code: o.OrganizationCode }),
          { endpoint: 'PDSCBUDetails/getPDSCGetInvOrgsByBU', uriParams: { p_business_unit_name: bu, limit: 1000 } }
        )
      ]);

      if (persons.status === 'fulfilled') $page.variables.personArray = items(persons.value);
      if (orgs.status === 'fulfilled') $page.variables.destOrgArray = orgs.value || [];
      $page.variables.prLovsLoadedFor = bu;
    }
  }

  return LoadPrLovs;
});
