/* Copyright (c) 2026, Oracle and/or its affiliates */

define([
  'oj-sp/spectra-shell/config/config'
], function () {
  'use strict';

  const STRIP_URL = 'https://static.oracle.com/cdn/fnd/gallery/2604.0.2/images/color-strip-finance-2x.webp';

  function patchStrip(el) {
    el.style.setProperty('background-image', "url('" + STRIP_URL + "')", 'important');
    el.style.setProperty('background-size', '100% 100%', 'important');
    el.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  function patchAllStrips() {
    document.querySelectorAll('.oj-sp-header-general-overview-header-strip').forEach(patchStrip);
  }

  var observer = new MutationObserver(function () {
    patchAllStrips();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  [500, 1500, 3000, 5000].forEach(function (delay) {
    setTimeout(patchAllStrips, delay);
  });

  class AppModule {
  }

  return AppModule;
});
