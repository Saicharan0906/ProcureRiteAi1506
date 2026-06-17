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
   * Open the Create Negotiation drawer for the selected execution lines. Each row is staged
   * with its estimated quantity (defaulted to the remaining quantity). Type / Style / Template /
   * Currency / Buyer + title/dates/note are chosen in the drawer.
   */
  class OpenNegDrawer extends ActionChain {
    async run(context) {
      const { $page } = context;
      const all = $page.variables.execLinesArray || [];
      const rows = resolveRows($page.variables.selectedKeys, all, 'execute_id');

      const eligible = rows.filter((r) => !r.negotiation);
      if (!rows.length) {
        await this.notify(context, 'Negotiation', 'Select one or more lines first.', 'warning');
        return;
      }
      if (!eligible.length) {
        await this.notify(context, 'Negotiation', 'The selected line(s) already have a negotiation.', 'warning');
        return;
      }

      const staged = eligible.map((r) => {
        const planned = num(r.planned_quantity);
        const ordered = num(r.total_ordered_quantity);
        const remaining = (r.remaining_quantity != null) ? num(r.remaining_quantity) : (planned - ordered);
        const orderQty = remaining > 0 ? remaining : (planned > 0 ? planned : 1);
        return {
          execute_id: r.execute_id, plan_id: r.plan_id, project_number: r.project_number,
          item_number: r.item_number, item_desc: r.item_desc, uom: r.uom,
          order_quantity: orderQty
        };
      });

      $page.variables.negLinesArray = staged;
      $page.variables.negForm = { negotiationType: '', negotiationStyle: '', negotiationTemplate: '', negotiationCurrency: '', buyer: '', title: '', opendate: '', closedate: '', notetoSupplier: '' };
      $page.variables.negTemplateArray = [];
      $page.variables.negDrawerOpen = true;
      try { await Actions.callChain(context, { chain: 'loadNegLovs' }); } catch (e) { /* LOVs best-effort */ }
    }

    async notify(context, summary, message, type) {
      await Actions.fireNotificationEvent(context, { summary, message, severity: type, type, displayMode: 'transient' });
    }
  }

  return OpenNegDrawer;
});
