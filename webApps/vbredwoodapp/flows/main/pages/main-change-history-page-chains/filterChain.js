/* Copyright (c) 2026, Oracle and/or its affiliates */
define(['vb/action/actionChain','vb/action/actions'],(ActionChain,Actions)=>{'use strict';
class FilterChain extends ActionChain{async run(context){
  const {$page}=context;
  if(!$page.variables.auditLinesAllArray||!$page.variables.auditLinesAllArray.length){$page.variables.auditLinesAllArray=[...$page.variables.auditLinesArray];}
  const all=$page.variables.auditLinesAllArray;
  const selected={};let keyword='';
  const collect=(c)=>{if(!c)return;if(c.text&&c.matchBy==='phrase'){keyword=c.text;return;}if(Array.isArray(c.criteria)){c.criteria.forEach(collect);return;}if(c.op==='$eq'){if(c.attribute){selected[c.attribute]=c.value;}else if(c.value&&typeof c.value==='object'){const k=Object.keys(c.value)[0];if(k)selected[k]=c.value[k];}}};
  collect($page.variables.filterCriterion);
  let rows=[...all];
      const pn=selected.projectNumber||'';
      if(pn!==$page.variables.lastProjectNumber){
        const meta=($page.variables.projectMeta||{})[pn];
        if(pn&&meta){
          const ph={projectName:meta.projectName,businessUnit:(meta.businessUnits&&meta.businessUnits.length===1)?meta.businessUnits[0]:'',projectOrg:(meta.orgs&&meta.orgs.length===1)?meta.orgs[0]:''};
          Object.keys(meta).forEach(k=>{if(['startDate','finishDate','status','projectManager','plannedCostTotal','orderedTotal'].indexOf(k)>=0)ph[k]=meta[k];});
          $page.variables.planHeader=ph;
          $page.variables.businessUnitArray=(meta.businessUnits||[]).map(v=>({value:v,label:v}));
          $page.variables.projectOrgArray=(meta.orgs||[]).map(v=>({value:v,label:v}));
        } else { $page.variables.planHeader={}; }
        $page.variables.lastProjectNumber=pn;
      }
      const effBU=selected.businessUnit||$page.variables.planHeader.businessUnit;
      const effOrg=selected.projectOrg||$page.variables.planHeader.projectOrg;
      if(pn) rows=rows.filter(r=>r.projectNumber===pn);
      if(effBU) rows=rows.filter(r=>r.businessUnit===effBU);
      if(effOrg) rows=rows.filter(r=>r.projectOrg===effOrg);
  if(keyword){const words=String(keyword).toLowerCase().split(/\s+/).filter(Boolean);const KW=["itemNumber", "itemDescription", "taskName", "updatedBy"];rows=rows.filter(item=>words.some(w=>KW.some(f=>item[f]&&String(item[f]).toLowerCase().includes(w))));}
  $page.variables.auditLinesArray=rows;
}}return FilterChain;});
