/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

  // Resolve the table's selected row KeySet into the matching data rows (see openPrDrawer).
  function resolveRows(sel, all, keyField) {
    let ks = sel;
    if (ks && ks.row) ks = ks.row;
    if (!ks) return [];
    try { if (typeof ks.isAddAll === 'function' && ks.isAddAll()) return all.slice(); } catch (e) { /* noop */ }
    const keys = [];
    try {
      const vals = (typeof ks.values === 'function') ? ks.values() : ks;
      if (vals && typeof vals.forEach === 'function') vals.forEach((k) => keys.push(k));
      else if (Array.isArray(vals)) vals.forEach((k) => keys.push(k));
    } catch (e) { /* noop */ }
    const set = Object.create(null);
    keys.forEach((k) => { set[String(k)] = true; });
    return all.filter((r) => set[String(r[keyField])]);
  }

  /**
   * Open the Create Purchase Order drawer for the selected execution lines. Each selected row
   * is staged with its Order Qty defaulted to the remaining quantity and its entered price.
   * Currency / Buyer / Bill-To / Supplier (+ Site / Email) are chosen in the drawer.
   * Lines that already have a PO are skipped.
   */
  class OpenPoDrawer extends ActionChain {
    async run(context) {
      const { $page } = context;
      const all = $page.variables.execLinesArray || [];
      const rows = resolveRows($page.variables.selectedKeys, all, 'execute_id');

      const eligible = rows.filter((r) => !r.purchase_order);
      if (!rows.length) {
        await this.notify(context, 'Purchase Order', 'Select one or more lines first.', 'warning');
        return;
      }
      if (!eligible.length) {
        await this.notify(context, 'Purchase Order', 'The selected line(s) already have a purchase order.', 'warning');
        return;
      }

      const staged = eligible.map((r) => {
        const planned = num(r.planned_quantity);
        const ordered = num(r.total_ordered_quantity);
        const remaining = (r.remaining_quantity != null) ? num(r.remaining_quantity) : (planned - ordered);
        const orderQty = remaining > 0 ? remaining : (planned > 0 ? planned : 1);
        return {
          execute_id: r.execute_id, plan_id: r.plan_id, project_number: r.project_number,
          requisition_number: r.purchase_requisition || r.requisition_number,
          item_number: r.item_number, item_desc: r.item_desc, uom: r.uom,
          line_type: r.line_type, item_category: r.item_category,
          destination_type: r.destination_type, requested_delivery_date: r.requested_delivery_date,
          inv_org_name: r.inv_org_name, expenditure_type_id: r.expenditure_type_id, task_id: r.task_id,
          planned_quantity: planned, total_ordered_quantity: ordered, remaining_quantity: remaining,
          order_quantity: orderQty,
          po_price_entered: (r.po_price_entered != null ? num(r.po_price_entered) : num(r.planned_cost))
        };
      });

      $page.variables.poLinesArray = staged;
      $page.variables.poForm = { currencyCode: '', buyer: '', billToLocation: '', supplier: '', supplierSite: '', supplierEmailAddress: '' };
      $page.variables.poSiteArray = [];
      $page.variables.poEmailArray = [];
      $page.variables.poDrawerOpen = true;
      try { await Actions.callChain(context, { chain: 'loadPoLovs' }); } catch (e) { /* LOVs best-effort */ }
    }

    async notify(context, summary, message, type) {
      await Actions.fireNotificationEvent(context, { summary, message, severity: type, type, displayMode: 'transient' });
    }
  }

  return OpenPoDrawer;
});
