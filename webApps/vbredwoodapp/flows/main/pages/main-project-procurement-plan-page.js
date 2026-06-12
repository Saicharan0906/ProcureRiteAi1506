/* Copyright (c) 2026, Oracle and/or its affiliates */
define([], function () {
  'use strict';

  var PageModule = function PageModule() {};

  PageModule.prototype.formatCurrency = function (amount, currency) {
    if (amount == null) return '';
    return (currency || 'USD') + ' ' + Number(amount).toLocaleString();
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
      good: 'background:#e3f3e6;color:#15683a;',
      warn: 'background:#fdecd2;color:#8a5300;',
      bad: 'background:#fde7e7;color:#b3261e;',
      neutral: 'background:#eceff1;color:#5a6b7b;'
    };
    return base + (variants[kind] || variants.neutral);
  }

  PageModule.prototype.statusPill = function (status) {
    return pill(status === 'Ready for Procurement' ? 'good' : 'neutral');
  };

  PageModule.prototype.criticalPill = function (critical) {
    return pill(critical === 'Yes' ? 'bad' : 'neutral');
  };

  return PageModule;
});
