/* Copyright (c) 2026, Oracle and/or its affiliates */

define([
  'vb/action/actionChain',
  'vb/action/builtin/fireNotificationEventAction'
], function (ActionChain, FireNotificationEventAction) {
  'use strict';

  class PrimaryActionChain extends ActionChain {
    async run(context) {
      await this.doAction(FireNotificationEventAction, context, {
        summary: 'Export',
        message: 'Project data export has been initiated.',
        displayMode: 'transient',
        type: 'info'
      });
    }
  }

  return PrimaryActionChain;
});
