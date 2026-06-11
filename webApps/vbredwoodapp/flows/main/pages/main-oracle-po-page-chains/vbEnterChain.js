/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain'],(ActionChain)=>{'use strict';
class VbEnterChain extends ActionChain{async run(context){context.$application.variables.activeNavTab='main-oracle-po';}}return VbEnterChain;});
