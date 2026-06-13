/* Copyright (c) 2026, Oracle and/or its affiliates */
define([
  'vb/action/actionChain'
], (ActionChain) => {
  'use strict';

  /** Task select cascade: auto-fill Task Name, Task Id and the planned start/finish dates. */
  class TaskChanged extends ActionChain {
    async run(context, { detail }) {
      const { $page } = context;
      const d = detail && detail.itemContext && detail.itemContext.data;
      if (!d) return;
      $page.variables.planForm = Object.assign({}, $page.variables.planForm, {
        task_name: d.task_name != null ? d.task_name : '',
        task_id: d.task_id != null ? d.task_id : null,
        planned_start_date: d.task_start_date != null ? d.task_start_date : '',
        planned_finish_date: d.task_end_date != null ? d.task_end_date : ''
      });
    }
  }

  return TaskChanged;
});
