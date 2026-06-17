/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

  /**
   * Create a Purchase Requisition for the staged lines via direct Fusion REST
   * (FusionFSCM/createRequisition -> /purchaseRequisitions). Payload mirrors the old app's
   * getRequisitionData: header (RequisitioningBU / PreparerId / ExternallyManagedFlag) + one
   * line per staged row, each with a project DFF distribution (__FLEX_Context POR_Requisition,
   * _PROJECT_ID / _ORGANIZATION_ID / _TASK_ID / _EXPENDITURE_TYPE_ID). On success it syncs each
   * line back to PDSC (postPDSCGetReqDetailsForExec) and optimistically stamps the grid rows
   * with the new requisition number + 'Requisitioned' status.
   */
  class CreateRequisition extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const h = $page.variables.planHeader || {};
      const f = $page.variables.prForm || {};
      const lines = $page.variables.prLinesArray || [];
      const PAGE = 'procurement-execution';

      if (!lines.length) { await this.notify(context, 'Purchase Requisition', 'No lines to requisition.', 'warning'); return; }
      if (f.preparerId == null) { await this.notify(context, 'Validation', 'Select a Preparer.', 'warning'); return; }
      if (f.requesterId == null) { await this.notify(context, 'Validation', 'Select a Requester.', 'warning'); return; }
      if (f.destinationId == null) { await this.notify(context, 'Validation', 'Select a Destination Organization.', 'warning'); return; }
      if (lines.some((l) => !(num(l.order_quantity) > 0))) {
        await this.notify(context, 'Validation', 'Each line needs a positive Order Qty.', 'warning'); return;
      }

      $page.variables.prSaving = true;
      let failed = 'createRequisition';

      try {
        // App-maintenance defaults (best-effort): negotiated-by-preparer + externally-managed flags.
        let negFlag = false, extFlag = false;
        try {
          const am = await Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCAppMaintenance', uriParams: { business_unit: h.businessUnit, P_USERNAME: user } });
          const a = (am && am.body && Array.isArray(am.body.items)) ? am.body.items[0] : null;
          if (a) { negFlag = !!a.negotiated_by_preparer; extFlag = !!a.externally_managed; }
        } catch (e) { /* defaults stand */ }

        const reqLines = lines.map((l, idx) => ({
          LineNumber: idx + 1,
          LineTypeCode: l.line_type,
          CategoryName: l.item_category,
          ItemDescription: l.item_desc,
          Item: l.item_number,
          Quantity: num(l.order_quantity),
          Price: num(l.po_price_entered),
          CurrencyCode: l.currency_code,
          UOM: l.uom,
          RequesterId: f.requesterId,
          DestinationType: l.destination_type,
          DestinationOrganizationId: f.destinationId,
          DeliverToLocationCode: l.inv_org_name,
          NegotiatedByPreparerFlag: negFlag,
          RequestedDeliveryDate: l.requested_delivery_date,
          distributions: [{
            Quantity: num(l.order_quantity),
            DistributionNumber: idx + 1,
            projectDFF: [{
              _PROJECT_ID: h.projectId,
              __FLEX_Context: 'POR_Requisition',
              _ORGANIZATION_ID: (h.orgId != null ? h.orgId : null),
              _TASK_ID: (l.task_id != null ? l.task_id : null),
              _EXPENDITURE_TYPE_ID: (l.expenditure_type_id != null ? l.expenditure_type_id : null)
            }]
          }]
        }));

        const body = {
          RequisitioningBU: h.businessUnit,
          PreparerId: f.preparerId,
          ExternallyManagedFlag: extFlag,
          lines: reqLines
        };

        const res = await Actions.callRest(context, { endpoint: 'FusionFSCM/createRequisition', body });
        if (!res || res.ok === false) {
          const b = res && res.body;
          const msg = (b && (b.detail || b.message))
            || (b && b['o:errorDetails'] && b['o:errorDetails'][0] && b['o:errorDetails'][0].detail)
            || (typeof b === 'string' ? b : null)
            || ('Requisition create failed (HTTP ' + (res ? res.status : '?') + ')');
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }

        const reqNum = res.body && res.body.Requisition;
        const reqHdrId = res.body && res.body.RequisitionHeaderId;
        const docStatus = (res.body && res.body.DocumentStatus) || 'Requisitioned';
        const respLines = (res.body && res.body.lines && Array.isArray(res.body.lines.items)) ? res.body.lines.items
          : (res.body && Array.isArray(res.body.lines) ? res.body.lines : []);

        // Sync each line back to PDSC so the execution table reflects it on next read (best-effort).
        failed = 'postPDSCGetReqDetailsForExec';
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const lineId = respLines[i] ? respLines[i].RequisitionLineId : null;
          const syncBody = {
            execute_id: l.execute_id, plan_id: l.plan_id, error_details: null,
            requisition_number: reqNum, requisition_line_id: lineId, item_number: l.item_number,
            quantity: num(l.order_quantity), po_price_entered: num(l.po_price_entered),
            status: docStatus, preparer: f.preparer, requester: f.requester,
            destinationorgname: f.destinationorgname, requisition_header_id: reqHdrId,
            total_ordered_quantity: l.total_ordered_quantity, remain_qty: l.remaining_quantity, planned_qty: l.planned_quantity
          };
          try {
            await Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/postPDSCGetReqDetailsForExec',
              body: syncBody,
              headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user }
            });
          } catch (e) { /* best-effort sync; grid still updated optimistically below */ }
        }

        // Optimistic grid update.
        const staged = Object.create(null);
        lines.forEach((l) => { staged[String(l.execute_id)] = true; });
        const stamp = (arr) => (arr || []).map((r) => staged[String(r.execute_id)]
          ? Object.assign({}, r, { purchase_requisition: reqNum, status: 'Requisitioned' }) : r);
        $page.variables.execLinesAllArray = stamp($page.variables.execLinesAllArray);
        $page.variables.execLinesArray = stamp($page.variables.execLinesArray);

        $page.variables.prSaving = false;
        $page.variables.prDrawerOpen = false;
        await this.notify(context, 'Purchase Requisition Created', 'Requisition ' + (reqNum || '') + ' created for ' + lines.length + ' line(s).', 'confirmation');
      } catch (error) {
        $page.variables.prSaving = false;
        const msg = (error && error.message)
          || (error && error.body && (error.body.detail || error.body.message))
          || 'Unknown error creating the requisition.';
        try {
          await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/postPDSCOrclRestApi',
            headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user },
            body: { p_api_name: failed, p_debug_message: typeof msg === 'string' ? msg : JSON.stringify(msg) }
          });
        } catch (e) { /* logging best-effort */ }
        await this.notify(context, 'Requisition failed', typeof msg === 'string' ? msg : JSON.stringify(msg), 'error', 'persist');
      }
    }

    async notify(context, summary, message, type, displayMode) {
      await Actions.fireNotificationEvent(context, { summary, message, severity: type, type, displayMode: displayMode || 'transient' });
    }
  }

  return CreateRequisition;
});
