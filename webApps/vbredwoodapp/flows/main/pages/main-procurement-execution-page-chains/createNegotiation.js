/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {
  'use strict';

  function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

  /**
   * Create a supplier negotiation (RFQ) for the staged lines via direct Fusion REST, mirroring
   * the old app's NegotiationCreateButtonActionChain:
   *   1) createNegotiation (CreateNegotiationFromTemplate) -> AuctionHeaderId + Negotiation #
   *   2) updateNegotiation (PATCH) -> title / open + close dates
   *   3) addNegotiationLine (POST child/lines) per staged line
   *   4) ORDS postPDSCPopulateNegotiation per line
   * Then optimistically stamps the grid rows with the negotiation number + 'Negotiation' status.
   */
  class CreateNegotiation extends ActionChain {
    async run(context) {
      const { $application, $page } = context;
      const user = $application.variables.user || 'ProcureRite';
      const h = $page.variables.planHeader || {};
      const f = $page.variables.negForm || {};
      const lines = $page.variables.negLinesArray || [];
      const PAGE = 'procurement-execution';

      if (!lines.length) { await this.notify(context, 'Negotiation', 'No lines to negotiate.', 'warning'); return; }
      if (!f.negotiationType) { await this.notify(context, 'Validation', 'Select a Negotiation Type.', 'warning'); return; }
      if (!f.negotiationStyle) { await this.notify(context, 'Validation', 'Select a Negotiation Style.', 'warning'); return; }
      if (!f.negotiationTemplate) { await this.notify(context, 'Validation', 'Select a Template.', 'warning'); return; }
      if (!f.negotiationCurrency) { await this.notify(context, 'Validation', 'Select a Currency.', 'warning'); return; }
      if (!f.buyer) { await this.notify(context, 'Validation', 'Select a Buyer.', 'warning'); return; }
      if (!f.title) { await this.notify(context, 'Validation', 'Enter a Title.', 'warning'); return; }

      $page.variables.negSaving = true;
      let failed = 'createNegotiation';

      try {
        // 1) Create from template.
        const createBody = {
          parameters: {
            ProcurementBU: h.businessUnit,
            NegotiationType: f.negotiationType,
            NegotiationStyle: f.negotiationStyle,
            NegotiationTemplate: f.negotiationTemplate,
            CurrencyCode: f.negotiationCurrency,
            Buyer: f.buyer,
            TwoStageEvaluationFlag: false
          }
        };
        const createRes = await Actions.callRest(context, {
          endpoint: 'FusionFSCM/createNegotiation',
          body: createBody,
          headers: { 'Content-Type': 'application/vnd.oracle.adf.action+json' }
        });
        if (!createRes || createRes.ok === false) throw new Error(this.errMsg(createRes, 'Create negotiation failed'));

        const result = (createRes.body && createRes.body.result) ? createRes.body.result : createRes.body || {};
        const auctionId = result.AuctionHeaderId != null ? result.AuctionHeaderId : (createRes.body && createRes.body.AuctionHeaderId);
        const negNum = result.Negotiation != null ? result.Negotiation : (createRes.body && createRes.body.Negotiation);
        if (auctionId == null) throw new Error('Negotiation created but no AuctionHeaderId was returned.');

        // 2) Update header (title + dates).
        failed = 'updateNegotiation';
        try {
          await Actions.callRest(context, {
            endpoint: 'FusionFSCM/updateNegotiation',
            uriParams: { AuctionHeaderId: auctionId },
            body: { NegotiationTitle: f.title, CloseDate: f.closedate, OpenDate: f.opendate, OpenImmediatelyFlag: false }
          });
        } catch (e) { /* header update best-effort; negotiation already exists */ }

        // App-maintenance line defaults (best-effort).
        let am = {};
        try {
          const r = await Actions.callRest(context, { endpoint: 'PDSCBUDetails/getPDSCAppMaintenance', uriParams: { business_unit: h.businessUnit, P_USERNAME: user } });
          am = (r && r.body && Array.isArray(r.body.items) && r.body.items[0]) ? r.body.items[0] : {};
        } catch (e) { /* defaults stand */ }

        // 3) Add lines.
        failed = 'addNegotiationLine';
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const lineBody = {
            SequenceNumber: i + 1,
            LineTypeId: am.line_type_id,
            LineDescription: l.item_desc,
            Item: l.item_number,
            UOM: l.uom,
            GroupTypeCode: am.group_type,
            EstimatedQuantity: num(l.order_quantity),
            PriceBreakTypeCode: am.price_break_type,
            DisplayTargetPriceFlag: am.display_target_price_flag,
            NoteToSuppliers: f.notetoSupplier
          };
          try {
            await Actions.callRest(context, { endpoint: 'FusionFSCM/addNegotiationLine', uriParams: { AuctionHeaderId: auctionId }, body: lineBody });
          } catch (e) { /* per-line best-effort */ }
        }

        // 4) Sync to PDSC.
        failed = 'postPDSCPopulateNegotiation';
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const popBody = {
            plan_id: l.plan_id, negotiation: negNum, execute_id: l.execute_id,
            negotiation_header_id: auctionId, project_number: l.project_number || h.projectNumber
          };
          try {
            await Actions.callRest(context, {
              endpoint: 'PDSCBUDetails/postPDSCPopulateNegotiation',
              body: popBody,
              headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user }
            });
          } catch (e) { /* best-effort sync */ }
        }

        // Optimistic grid update.
        const staged = Object.create(null);
        lines.forEach((l) => { staged[String(l.execute_id)] = true; });
        const stamp = (arr) => (arr || []).map((r) => staged[String(r.execute_id)]
          ? Object.assign({}, r, { negotiation: negNum, status: 'Negotiation' }) : r);
        $page.variables.execLinesAllArray = stamp($page.variables.execLinesAllArray);
        $page.variables.execLinesArray = stamp($page.variables.execLinesArray);

        $page.variables.negSaving = false;
        $page.variables.negDrawerOpen = false;
        await this.notify(context, 'Negotiation Created', 'Negotiation ' + (negNum || '') + ' created for ' + lines.length + ' line(s).', 'confirmation');
      } catch (error) {
        $page.variables.negSaving = false;
        const msg = (error && error.message) || 'Unknown error creating the negotiation.';
        try {
          await Actions.callRest(context, {
            endpoint: 'PDSCBUDetails/postPDSCOrclRestApi',
            headers: { 'R_PAGE_NAME': PAGE, 'R_TRACE_ID': $application.variables.traceIdDisplay || null, 'R_USER_NAME': user },
            body: { p_api_name: failed, p_debug_message: typeof msg === 'string' ? msg : JSON.stringify(msg) }
          });
        } catch (e) { /* logging best-effort */ }
        await this.notify(context, 'Negotiation failed', typeof msg === 'string' ? msg : JSON.stringify(msg), 'error', 'persist');
      }
    }

    errMsg(res, fallback) {
      const b = res && res.body;
      const m = (b && (b.detail || b.message))
        || (b && b['o:errorDetails'] && b['o:errorDetails'][0] && b['o:errorDetails'][0].detail)
        || (typeof b === 'string' ? b : null)
        || (fallback + ' (HTTP ' + (res ? res.status : '?') + ')');
      return typeof m === 'string' ? m : JSON.stringify(m);
    }

    async notify(context, summary, message, type, displayMode) {
      await Actions.fireNotificationEvent(context, { summary, message, severity: type, type, displayMode: displayMode || 'transient' });
    }
  }

  return CreateNegotiation;
});
