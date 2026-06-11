/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain',
  'vb/action/actions'
], (ActionChain, Actions) => {
  'use strict';

  /**
   * oj-sp-smart-search filter-criterion-changed handler (PATH B, client-side).
   * Filters the in-memory plan lines by the keyword + applied filter chips.
   * When wired to ORDS, replace this with a server call (getPDSCPlanDetails).
   */
  class FilterChain extends ActionChain {
    async run(context) {
      const { $page } = context;

      // pristine full set (capture once)
      if (!$page.variables.planLinesAllArray || !$page.variables.planLinesAllArray.length) {
        $page.variables.planLinesAllArray = [...$page.variables.planLinesArray];
      }
      const all = $page.variables.planLinesAllArray;
      const fc = $page.variables.filterCriterion;

      if (!fc || (Array.isArray(fc.criteria) && fc.criteria.length === 0)) {
        $page.variables.planLinesArray = [...all];
        return;
      }

      const KEYWORD_FIELDS = ['itemNumber', 'itemDescription', 'taskName', 'supplier'];

      const apply = (criterion, data) => {
        if (!criterion) return data;
        // keyword
        if (criterion.text && criterion.matchBy === 'phrase') {
          const words = String(criterion.text).toLowerCase().split(/\s+/).filter(Boolean);
          return data.filter(item => words.some(w =>
            KEYWORD_FIELDS.some(f => item[f] && String(item[f]).toLowerCase().includes(w))));
        }
        // select single — flat
        if (criterion.op === '$eq' && criterion.attribute) {
          return data.filter(item => String(item[criterion.attribute] || '').toLowerCase()
            === String(criterion.value || '').toLowerCase());
        }
        // select single — nested chip { op:'$eq', value:{ field: val } }
        if (criterion.op === '$eq' && !criterion.attribute && criterion.value && typeof criterion.value === 'object') {
          const k = Object.keys(criterion.value)[0];
          if (k) return data.filter(item => String(item[k] || '').toLowerCase()
            === String(criterion.value[k] || '').toLowerCase());
        }
        // compound
        if (Array.isArray(criterion.criteria)) {
          let out = data;
          criterion.criteria.forEach(c => { out = apply(c, out); });
          return out;
        }
        return data;
      };

      let rows = [...all];
      if (fc.$tag === '_root_' && Array.isArray(fc.criteria)) {
        fc.criteria.forEach(c => { rows = apply(c, rows); });
      } else {
        rows = apply(fc, rows);
      }
      $page.variables.planLinesArray = rows;
    }
  }

  return FilterChain;
});
