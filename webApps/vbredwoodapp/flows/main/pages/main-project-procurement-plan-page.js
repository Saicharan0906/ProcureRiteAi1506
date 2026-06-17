/* Copyright (c) 2026, Oracle and/or its affiliates */
define([], function () {
  'use strict';

  var PageModule = function PageModule() {};

  PageModule.prototype.formatCurrency = function (amount, currency) {
    if (amount == null) return '';
    return (currency || 'USD') + ' ' + Number(amount).toLocaleString();
  };

  // Sum a numeric field across the rows array (for the KPI "Planned Value" card). Reactive:
  // re-evaluates whenever the bound planLinesAllArray changes.
  PageModule.prototype.kpiSum = function (arr, field) {
    if (!arr || !arr.length) return 0;
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = Number(arr[i] && arr[i][field]);
      if (!isNaN(v)) total += v;
    }
    return total;
  };

  PageModule.prototype.formatDate = function (dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  };

  // ── Colored status pills (inline-styled — page CSS does not load reliably) ──
  function pill(kind) {
    var base = 'display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;'
      + 'font-weight:600;line-height:1.5;white-space:nowrap;';
    var variants = {
      good: 'background:#e3f3e6;color:#15683a;',     // success  (green)
      warn: 'background:#fdecd2;color:#8a5300;',     // warning  (amber)
      bad: 'background:#fde7e7;color:#b3261e;',      // danger   (red)
      info: 'background:#e3eefc;color:#1a4f8a;',     // info     (blue)
      neutral: 'background:#eceff1;color:#5a6b7b;'   // neutral  (gray)
    };
    return base + (variants[kind] || variants.neutral);
  };

  // Map any plan-line status to a Redwood semantic badge color (not just Ready=green).
  PageModule.prototype.statusPill = function (status) {
    var s = String(status || '').toLowerCase();
    var kind = 'neutral';
    if (/ready|approv|complete|receiv|closed|done|success/.test(s)) kind = 'good';
    else if (/cancel|reject|error|fail|hold|overdue/.test(s)) kind = 'bad';
    else if (/process|progress|submit|pending|partial|review|negotiat|requisition/.test(s)) kind = 'warn';
    else if (/draft|new|open/.test(s)) kind = 'neutral';
    return pill(kind);
  };

  PageModule.prototype.criticalPill = function (critical) {
    if (String(critical || '').toLowerCase() === 'yes') return pill('bad');
    return 'color:#637387;';  // plain muted text for No/blank (only flag the critical ones)
  };

  return PageModule;
});
