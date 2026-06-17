/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

  /**
   * Create a draft Purchase Order for the staged lines via direct Fusion REST
   * (FusionFSCM/createPurchaseOrder -> /draftPurchaseOrders). Payload mirrors the old app's
   * constructPodata: header (ProcurementBU / Buyer / Supplier / Site / Currency / BillTo +
   * app-maintenance flags) and one line per row, each with a schedule (ship-to + tolerances)
   * and a project DFF distribution (__FLEX_Context PO_Purchase_Order). On success it syncs each
   * line back to PDSC (postPDSCGetPODetailsForExec) and optimistically stamps the grid rows
   * with the new PO number + 'PO Created' status.
   */
  class CreatePurchaseOrder extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const h = $page.variables.planHeader || {};
      const f = $page.variables.poForm || {};
      const lines = $page.variables.poLinesArray || [];
      const PAGE = 'procurement-execution';

      if (!lines.length) { await this.notify(context, 'Purchase Order', 'No lines to order.', 'warning'); return; }
      if (!f.supplier) { await this.notify(context, 'Validation', 'Select a Supplier.', 'warning'); return; }
      if (!f.supplierSite) { await this.notify(context, 'Validation', 'Select a Supplier Site.', 'warning'); return; }
      if (!f.buyer) { await this.notify(context, 'Validation', 'Select a Buyer.', 'warning'); return; }
      if (!f.currencyCode) { await this.notify(context, 'Validation', 'Select a Currency.', 'warning'); return; }
      if (lines.some((l) => !(num(l.order_quantity) > 0))) {
        await this.notify(context, 'Validation', 'Each line needs a positive Order Qty.', 'warning'); return;
      }

      $page.variables.poSaving = true;
      let failed = 'createPurchaseOrder';

      try {
        // App-maintenance defaults (best-effort): tolerances, matching, routing, comm method, flags.
        let am = {};
        try {
          const r = await Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCAppMaintenance', uriParams: { business_unit: h.businessUnit, P_USERNAME: user } });
          am = (r && r.body && Array.isArray(r.body.items) && r.body.items[0]) ? r.body.items[0] : {};
        } catch (e) { /* defaults stand */ }

        const poLines = lines.map((l, idx) => {
          const n = idx + 1;
          return {
            LineNumber: n,
            LineType: l.line_type,
            Item: l.item_number,
            Category: l.item_category,
            Description: l.item_desc,
            Quantity: num(l.order_quantity),
            Price: num(l.po_price_entered),
            UOM: l.uom,
            schedules: [{
              ScheduleNumber: n,
              Quantity: num(l.order_quantity),
              ShipToLocation: l.inv_org_name,
              ShipToOrganization: l.inv_org_name,
              ReceiptCloseTolerancePercent: am.receipt_close_tolerance_percent,
              InvoiceMatchOptionCode: am.invoice_match_option_code,
              RequestedShipDate: l.requested_delivery_date,
              RequestedDeliveryDate: l.requested_delivery_date,
              InvoiceCloseTolerancePercent: am.invoice_close_tolerance_percent,
              InspectionRequiredFlag: am.inspection_required,
              ReceiptRequiredFlag: am.receipt_required,
              ReceiptRoutingId: am.receipt_routing_id,
              DestinationType: l.destination_type,
              distributions: [{
                DistributionNumber: n,
                DeliverToLocation: l.inv_org_name,
                Quantity: num(l.order_quantity),
                projectDFF: [{
                  _PROJECT_ID: h.projectId,
                  __FLEX_Context: 'PO_Purchase_Order',
                  _ORGANIZATION_ID: (h.orgId != null ? h.orgId : null),
                  _TASK_ID: (l.task_id != null ? l.task_id : null),
                  _EXPENDITURE_ITEM_DATE: l.requested_delivery_date,
                  _EXPENDITURE_TYPE_ID: (l.expenditure_type_id != null ? l.expenditure_type_id : null)
                }]
              }]
            }]
          };
        });

        const body = {
          ProcurementBU: h.businessUnit,
          RequisitioningBU: h.businessUnit,
          Buyer: f.buyer,
          Supplier: f.supplier,
          CurrencyCode: f.currencyCode,
          SupplierSite: f.supplierSite,
          BillToLocation: f.billToLocation,
          RequiredAcknowledgment: am.required_acknowledgment,
          SupplierCommunicationMethod: am.supplier_communication_method,
          SupplierEmailAddress: f.supplierEmailAddress,
          BuyerManagedTransportFlag: am.buyer_managed_transport,
          PayOnReceiptFlag: am.pay_on_receipt,
          lines: poLines
        };

        const res = await Actions.callRest(context, { endpoint: 'FusionFSCM/createPurchaseOrder', body });
        if (!res || res.ok === false) {
          const b = res && res.body;
          const msg = (b && (b.detail || b.message))
            || (b && b['o:errorDetails'] && b['o:errorDetails'][0] && b['o:errorDetails'][0].detail)
            || (typeof b === 'string' ? b : null)
            || ('Purchase Order create failed (HTTP ' + (res ? res.status : '?') + ')');
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }

        const poNum = res.body && res.body.OrderNumber;
        const poHdrId = res.body && res.body.POHeaderId;
        const poStatus = (res.body && res.body.Status) || 'PO Created';
        const respLines = (res.body && res.body.lines && Array.isArray(res.body.lines.items)) ? res.body.lines.items
          : (res.body && Array.isArray(res.body.lines) ? res.body.lines : []);

        // Sync each line back to PDSC (best-effort).
        failed = 'postPDSCGetPODetailsForExec';
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const lineId = respLines[i] ? respLines[i].POLineId : null;
          const syncBody = {
            PO_NUMBER: poNum, PO_ID: poHdrId, req_id: null,
            execute_id: l.execute_id, plan_id: l.plan_id,
            po_price_entered: num(l.po_price_entered), requisition_number: l.requisition_number,
            item_number: l.item_number, supplier: f.supplier, supplier_site: f.supplierSite,
            quantity: num(l.order_quantity), need_by_date: null,
            ORACLE_PO_HEADER_ID: poHdrId, ORACLE_PO_LINE_ID: lineId, error_details: null,
            status: poStatus, project_number: l.project_number || h.projectNumber,
            planned_qty: l.planned_quantity, total_ordered_quantity: l.total_ordered_quantity, remaining_qty: l.remaining_quantity
          };
          try {
            await Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/postPDSCGetPODetailsForExec',
              body: syncBody,
              headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user }
            });
          } catch (e) { /* best-effort sync */ }
        }

        // Optimistic grid update.
        const staged = Object.create(null);
        lines.forEach((l) => { staged[String(l.execute_id)] = true; });
        const stamp = (arr) => (arr || []).map((r) => staged[String(r.execute_id)]
          ? Object.assign({}, r, { purchase_order: poNum, status: 'PO Created' }) : r);
        $page.variables.execLinesAllArray = stamp($page.variables.execLinesAllArray);
        $page.variables.execLinesArray = stamp($page.variables.execLinesArray);

        $page.variables.poSaving = false;
        $page.variables.poDrawerOpen = false;
        await this.notify(context, 'Purchase Order Created', 'PO ' + (poNum || '') + ' created for ' + lines.length + ' line(s).', 'confirmation');
      } catch (error) {
        $page.variables.poSaving = false;
        const msg = (error && error.message)
          || (error && error.body && (error.body.detail || error.body.message))
          || 'Unknown error creating the purchase order.';
        try {
          await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/postPDSCOrclRestApi',
            headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user },
            body: { p_api_name: failed, p_debug_message: typeof msg === 'string' ? msg : JSON.stringify(msg) }
          });
        } catch (e) { /* logging best-effort */ }
        await this.notify(context, 'Purchase Order failed', typeof msg === 'string' ? msg : JSON.stringify(msg), 'error', 'persist');
      }
    }

    async notify(context, summary, message, type, displayMode) {
      await Actions.fireNotificationEvent(context, { summary, message, severity: type, type, displayMode: displayMode || 'transient' });
    }
  }

  return CreatePurchaseOrder;
});
