/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  /**
   * Supplier cascade: when a supplier is chosen, load its Sites (by vendor name) and Emails
   * (by vendor number) and reset the dependent selections. The supplier name is two-way bound
   * to poForm.supplier; here we resolve its vendor_number from the supplier list.
   */
  class PoSupplierChanged extends ActionChain {
    async run(context, { detail }) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const items = (r) => (r && r.body && Array.isArray(r.body.items)) ? r.body.items : [];

      const data = detail && detail.itemContext && detail.itemContext.data;
      const vendorName = data ? data.vendor_name : (detail ? detail.value : '');
      let vendorNumber = data ? data.vendor_number : null;
      if (!vendorName) return;
      if (vendorNumber == null) {
        const match = ($page.variables.poSupplierArray || []).find((s) => s.vendor_name === vendorName);
        vendorNumber = match ? match.vendor_number : null;
      }

      // reset dependent picks
      const f = Object.assign({}, $page.variables.poForm, { supplier: vendorName, supplierSite: '', supplierEmailAddress: '' });
      $page.variables.poForm = f;
      $page.variables.poSiteArray = [];
      $page.variables.poEmailArray = [];

      const [sites, emails] = await Promise.allSettled([
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCSupplierSiteDetails', uriParams: { P_VENDOR_NAME: vendorName, limit: 500 } }),
        Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCSupplierEmail', uriParams: { p_vendor_number: vendorNumber, P_USERNAME: user, limit: 500 } })
      ]);

      if (sites.status === 'fulfilled') $page.variables.poSiteArray = items(sites.value);
      if (emails.status === 'fulfilled') {
        let em = items(emails.value);
        // Fall back to emails embedded in the site rows if the email endpoint returned nothing.
        if (!em.length && ($page.variables.poSiteArray || []).length) {
          const seen = Object.create(null);
          em = ($page.variables.poSiteArray || [])
            .filter((s) => s.supplier_email_address && !seen[s.supplier_email_address] && (seen[s.supplier_email_address] = true))
            .map((s) => ({ supplier_email_address: s.supplier_email_address }));
        }
        $page.variables.poEmailArray = em;
      }
    }
  }

  return PoSupplierChanged;
});
