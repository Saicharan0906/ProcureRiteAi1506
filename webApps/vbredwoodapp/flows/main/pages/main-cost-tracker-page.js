/* Copyright (c) 2026, Oracle and/or its affiliates */
define([], function () {
  'use strict';
  var PageModule = function PageModule() {};
  PageModule.prototype.formatCurrency = function (amount, currency) {
    if (amount == null) return '';
    return (currency || 'USD') + ' ' + Number(amount).toLocaleString();
  };
  return PageModule;
});
