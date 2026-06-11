/* Copyright (c) 2026, Oracle and/or its affiliates */
define([],function(){'use strict';
var PageModule=function(){};
PageModule.prototype.formatCurrency=function(a,c){if(a==null)return '';return (c||'USD')+' '+Number(a).toLocaleString();};
var SM={'Received':'good','Partial':'warn','Pending':'info'};
PageModule.prototype.statusClass=function(s){return 'pr-badge pr-badge-'+(SM[s]||'info');};
return PageModule;});
