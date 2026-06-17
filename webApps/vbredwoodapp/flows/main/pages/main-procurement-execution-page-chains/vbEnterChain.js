/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  async function fetchAll(context, endpoint, uriParams, keyField) {
    const PAGE = 500;
    const all = [];
    const seen = Object.create(null);
    let offset = 0;
    for (let guard = 0; guard < 100; guard++) {
      let body = null;
      try {
        const r = await Actions.callRest(context, { endpoint, uriParams: Object.assign({}, uriParams, { limit: PAGE, offset }) });
        body = r && r.body;
      } catch (e) { break; }
      const items = (body && Array.isArray(body.items)) ? body.items : [];
      let added = 0;
      for (let i = 0; i < items.length; i++) {
        const k = keyField ? String(items[i][keyField]) : JSON.stringify(items[i]);
        if (!seen[k]) { seen[k] = 1; all.push(items[i]); added++; }
      }
      if (items.length === 0 || added === 0 || body.hasMore !== true) break;
      offset += items.length;
    }
    return all;
  }

  /**
   * Page enter: load the smart-search filter LOVs. Project Number from active Fusion
   * projects; Item Category from Fusion (Purchasing catalog). Both fall back to ORDS.
   * Business Unit from ORDS. (Same pattern as the Project Procurement Plan page.)
   */
  class VbEnterChain extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      $application.variables.activeNavTab = 'main-procurement-execution';
      const user = $application.variables.user || 'ProcureRite';

      const opts = (arr, field) => {
        const seen = Object.create(null);
        return arr.map((o) => ({ value: o[field], label: o[field] }))
          .filter((o) => o.value != null && o.value !== '' && !seen[o.value] && (seen[o.value] = true));
      };

      // Project Number -> Fusion active projects (exclude Closed); ORDS fallback.
      let projOpts = null;
      try {
        const r = await Actions.callRest(context, { endpoint: 'FusionFSCM/getProjects', uriParams: { limit: 500, onlyData: true, fields: 'ProjectNumber,ProjectName', q: "ProjectStatusCode!='CLOSED'" } });
        const fitems = (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];
        if (fitems.length) {
          const seenP = Object.create(null);
          projOpts = fitems
            .map((p) => ({ value: p.ProjectNumber, label: p.ProjectName ? (p.ProjectNumber + ' — ' + p.ProjectName) : p.ProjectNumber }))
            .filter((o) => o.value != null && o.value !== '' && !seenP[o.value] && (seenP[o.value] = true));
        }
      } catch (e) { /* fall back to ORDS below */ }

      // Item Category -> Fusion itemCategories (Purchasing); ORDS fallback.
      let catOpts = null;
      try {
        const rc = await Actions.callRest(context, { endpoint: 'FusionFSCM/getItemCategories', uriParams: { limit: 500, onlyData: true, q: "CatalogCode='Purchasing'", fields: 'CategoryCode,CategoryName' } });
        const citems = (rc && rc.body && Array.isArray(rc.body.items)) ? rc.body.items : [];
        if (citems.length) {
          const seenC = Object.create(null);
          catOpts = citems
            .map((c) => ({ value: c.CategoryCode, label: c.CategoryName ? (c.CategoryCode + ' — ' + c.CategoryName) : c.CategoryCode }))
            .filter((o) => o.value != null && o.value !== '' && !seenC[o.value] && (seenC[o.value] = true));
        }
      } catch (e) { /* fall back to ORDS below */ }

      const [proj, bu, cat] = await Promise.allSettled([
        projOpts ? Promise.resolve(null) : fetchAll(context, 'PDSCBUDetails/getPDSCProjectDetails', { P_USERNAME: user }, 'project_number'),
        fetchAll(context, 'PDSCBUDetails/getPDSCBUDetails', {}, 'bu_name'),
        catOpts ? Promise.resolve(null) : fetchAll(context, 'PDSCBUDetails/getPDSCItemCategories', { P_ITEM_NUMBER: '' }, 'category_code')
      ]);

      if (projOpts) $page.variables.projectNumberArray = projOpts;
      else if (proj.status === 'fulfilled' && proj.value) $page.variables.projectNumberArray = opts(proj.value, 'project_number');
      if (bu.status === 'fulfilled') $page.variables.businessUnitArray = opts(bu.value, 'bu_name');
      if (catOpts) $page.variables.itemCategoryArray = catOpts;
      else if (cat.status === 'fulfilled' && cat.value) $page.variables.itemCategoryArray = opts(cat.value, 'category_code');
    }
  }

  return VbEnterChain;
});
