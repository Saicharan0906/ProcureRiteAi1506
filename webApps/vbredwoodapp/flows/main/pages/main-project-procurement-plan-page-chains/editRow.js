/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  // Find the nearest ancestor (across the event's composed path) carrying data-row.
  // For an oj-button the data-row is on the host element; the native click target is
  // inside its shadow DOM, so we must use composedPath()/the ojAction target — NOT
  // event.currentTarget (null once the async chain runs) or parentElement walking
  // (stops at the shadow boundary).
  function readRow(event) {
    if (!event) return null;
    const candidates = [];
    try { if (typeof event.composedPath === 'function') candidates.push.apply(candidates, event.composedPath()); } catch (e) { /* noop */ }
    if (event.target) candidates.push(event.target);
    if (event.currentTarget) candidates.push(event.currentTarget);
    const orig = event.detail && event.detail.originalEvent;
    if (orig) {
      try { if (typeof orig.composedPath === 'function') candidates.push.apply(candidates, orig.composedPath()); } catch (e) { /* noop */ }
      if (orig.target) candidates.push(orig.target);
    }
    for (let i = 0; i < candidates.length; i++) {
      let node = candidates[i];
      while (node && node.getAttribute) {
        const json = node.getAttribute('data-row');
        if (json) { try { return JSON.parse(json); } catch (e) { return null; } }
        node = node.parentElement;
      }
    }
    return null;
  }

  /**
   * Row "Edit" action: read the clicked row off the button's data-row attribute, copy it
   * into planForm, load the drawer LOVs, and open the drawer in edit mode.
   */
  class EditRow extends ActionChain {
    async run(context, { event }) {
      const { $page } = context;
      const row = readRow(event);
      if (!row) {
        await Actions.fireEvent(context, {
          event: 'application:spShowToast',
          payload: { detail: { message: 'Could not read the selected line. Please try again.' } }
        });
        return;
      }

      $page.variables.planForm = Object.assign({}, $page.variables.planForm, row, { isNew: 'N' });
      $page.variables.drawerMode = 'edit';

      try { await Actions.callChain(context, { chain: 'loadDrawerLovs' }); } catch (e) { /* LOVs best-effort */ }
      $page.variables.drawerOpen = true;
    }
  }

  return EditRow;
});
