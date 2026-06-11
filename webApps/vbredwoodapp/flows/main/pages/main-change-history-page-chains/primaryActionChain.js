/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain','vb/action/actions'],(ActionChain,Actions)=>{'use strict';
class PrimaryActionChain extends ActionChain{async run(context){await Actions.fireEvent(context,{event:'application:spShowToast',payload:{detail:{message:'Exporting change history...'}}});}}return PrimaryActionChain;});
