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

  return PageModule;
});
