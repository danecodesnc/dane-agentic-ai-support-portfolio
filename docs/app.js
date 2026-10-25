import {
  SCENARIOS, SYNTHETIC_TICKETS, investigate, missingInformation, reproductionStatus,
  technicalEvidence, generateCustomerUpdate, generateHandoff, formatHandoff,
  diagnoseApi, routeIncident, humanDecision, duplicatePatterns, supportMetrics
} from "./engine.mjs";

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty = value => String(value).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const listHtml=(items,ordered=false)=>"<"+(ordered?"ol":"ul")+">"+items.map(x=>"<li>"+esc(x)+"</li>").join("")+"</"+(ordered?"ol":"ul")+">";
const box = (title,body,wide=false) => '<article class="result-card'+(wide?' wide':'')+'"><h4>'+esc(title)+'</h4>'+body+'</article>';
const metric = (name,value) => '<div class="metric"><small>'+esc(name)+'</small><strong class="'+(String(value).length>20?"tiny":"")+'">'+esc(value)+'</strong></div>';
const banner = (message,warning=false)=>'<div class="result-banner'+(warning?' warning':'')+'"><span aria-hidden="true">'+(warning?'⚠':'✓')+'</span><strong>'+esc(message)+'</strong></div>';
const codeOutput=(label,value,copyId)=>'<div class="code-output"><div class="code-top"><span>'+esc(label)+'</span><button type="button" class="btn btn-soft btn-small" data-copy="'+esc(copyId)+'">Copy text</button></div><pre id="'+esc(copyId)+'">'+esc(value)+'</pre></div>';
const kv=(pairs)=>'<dl>'+pairs.map(([key,val])=>'<div class="key-value"><dt>'+esc(key)+'</dt><dd>'+esc(val)+'</dd></div>').join("")+'</dl>';
function error(target,message){$(target).innerHTML='<div class="error-message" role="alert">'+esc(message)+'</div>';}
function setPanel(name,focus=false) {
  for (const tab of document.querySelectorAll("[data-tab]")) {
    const active=tab.dataset.tab===name;
    tab.classList.toggle("active",active);
    tab.setAttribute("aria-selected",String(active));
    tab.tabIndex=active?0:-1;
    $("panel-"+tab.dataset.tab).hidden=!active;
    if (active&&focus)tab.focus();
  }
}
const tabButtons=[...document.querySelectorAll("[data-tab]")];
tabButtons.forEach((button,index)=>{
  button.addEventListener("click",()=>setPanel(button.dataset.tab));
  button.addEventListener("keydown",event=>{
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();
    const target=event.key==="Home"?0:event.key==="End"?tabButtons.length-1:(index+(event.key==="ArrowRight"?1:-1)+tabButtons.length)%tabButtons.length;
    setPanel(tabButtons[target].dataset.tab,true);
  });
});

for (const scenario of SCENARIOS) $("scenario").add(new Option(scenario.name,scenario.id));
function syncTicketCount(){
  const n=$("ticket").value.length;
  $("ticket-count").textContent=n.toLocaleString()+" / 6,000";
}
function chooseScenario(){
  const choice=SCENARIOS.find(x=>x.id===$("scenario").value)||SCENARIOS[0];
  $("ticket").value=choice.ticket;
  $("scenario-purpose").textContent=choice.purpose;
  $("investigation-output").innerHTML="";
  syncTicketCount();
}
$("scenario").addEventListener("change",chooseScenario);
$("ticket").addEventListener("input",()=>{
  // Editing a preset must not silently preserve the synthetic tool-failure flag.
  if ($("scenario").value !== "custom") {
    $("scenario").value = "custom";
    $("scenario-purpose").textContent = SCENARIOS.find(x=>x.id==="custom").purpose;
  }
  $("investigation-output").innerHTML = "";
  syncTicketCount();
});
$("reset-investigation").addEventListener("click",()=>{
  $("scenario").value = "credentials";
  chooseScenario();
  $("ticket").focus();
});
chooseScenario();
$("handoff-ticket").value=SCENARIOS[0].ticket;

$("analyze").addEventListener("click",()=>{
  try {
    const scenario=SCENARIOS.find(x=>x.id===$("scenario").value);
    const ticket=$("ticket").value;
    const result=investigate(ticket,{simulateToolFailure:scenario?.failure||false});
    const repro=reproductionStatus(result.ticket,result);
    const tech=technicalEvidence(result.ticket,result);
    const missing=missingInformation(result.ticket);
    const evidenceNames=[...new Set(result.evidence.map(x=>pretty(x.source)))];
    let html=banner(result.human_approval_required?"Human review required — no action taken":"Investigation preview complete");
    html+='<div class="metrics-grid">'+metric("Priority",result.severity)+metric("Category",pretty(result.category))+metric("Confidence",Math.round(result.confidence*100)+"%")+metric("Evidence match",repro.status)+'</div>';
    html+='<div class="result-grid">';
    html+=box("Most likely cause",listHtml(result.likely_causes));
    html+=box("Recommended troubleshooting",listHtml(result.troubleshooting_steps,true));
    html+=box("Technical evidence",kv([["Service status",pretty(tech.service_status)],["HTTP / network",tech.http_response],["Request ID",tech.request_id],["Environment",tech.environment],["Endpoint",tech.endpoint]]));
    html+=box("Evidence needed",missing.length?listHtml(missing):'<p>No obvious fields are missing from the report.</p>');
    html+=box("Confidence & evidence limitations",'<p><strong>Rule-based demo score:</strong> '+esc(Math.round(result.confidence*100))+'%. This configured heuristic is not a probability, and no live system or customer was tested.</p>',true);
    html+=box("Reproduction assessment",'<p><strong>'+esc(repro.status)+'</strong></p><p>'+esc(repro.reason)+'</p>',true);
    html+=box("Synthetic sources",'<div class="pill-row">'+evidenceNames.map(x=>'<span class="pill">'+esc(x)+'</span>').join("")+'</div>',true);
    html+='</div>';
    html+=result.human_approval_required?'<div class="inline-alert"><strong>Review boundary:</strong> '+esc(result.escalation_reason)+' External action taken: false.</div>':'';
    html+='<div class="actions"><button type="button" class="btn btn-soft" id="create-customer-update">Create customer update</button><button type="button" class="btn btn-soft" id="create-investigation-handoff">Create engineering handoff</button></div>';
    html+='<div id="investigation-extra"></div>';
    html+='<details class="details"><summary>Technical trace & observability</summary><pre>'+esc(JSON.stringify({tools_used:result.tools_used,guardrails:result.guardrails_triggered,evidence:result.evidence,decision_trace:result.decision_trace,telemetry:result.telemetry},null,2))+'</pre></details>';
    $("investigation-output").innerHTML=html;
    $("create-customer-update").addEventListener("click",()=>{
      $("investigation-extra").innerHTML=codeOutput("Customer-facing update",generateCustomerUpdate(result.ticket,result),"copy-investigation-result");
    });
    $("create-investigation-handoff").addEventListener("click",()=>{
      $("investigation-extra").innerHTML=codeOutput("Engineering handoff",formatHandoff(generateHandoff(result.ticket,result)),"copy-investigation-result");
    });
  }catch(ex){error("investigation-output",ex.message);}
});

$("generate-handoff").addEventListener("click",()=>{
  try {
    const ticket=$("handoff-ticket").value;
    const result=investigate(ticket);
    const report=generateHandoff(result.ticket,result);
    let html=banner("Engineering handoff generated · preview only");
    html+='<div class="metrics-grid">'+metric("Severity",report.severity)+metric("Confidence",Math.round(report.confidence*100)+"%")+metric("Evidence match",report.reproduction_status)+metric("External actions","0")+'</div>';
    html+=codeOutput("Engineering-ready report",formatHandoff(report),"copy-handoff");
    html+='<details class="details"><summary>Structured JSON output</summary><pre>'+esc(JSON.stringify(report,null,2))+'</pre></details>';
    $("handoff-output").innerHTML=html;
  }catch(ex){error("handoff-output",ex.message);}
});

const incidentPresets={
  P1:"Production down - complete outage for all customers.",
  P2:"Multiple customers report degraded API performance and repeated HTTP 504 responses.",
  P3:"One customer has a configuration question with no production impact."
};
function chooseIncident(){$("incident-text").value=incidentPresets[$("incident-scenario").value];$("incident-output").innerHTML="";}
$("incident-scenario").addEventListener("change",chooseIncident);
chooseIncident();
$("route-incident").addEventListener("click",()=>{
  try {
    const outcome=routeIncident($("incident-text").value);
    let html=banner(outcome.human_approval_required?"High-risk incident — approval preview required":"Incident routed by deterministic policy",outcome.human_approval_required);
    html+='<div class="metrics-grid">'+metric("Priority",outcome.severity)+metric("Route",pretty(outcome.route))+metric("Human approval",outcome.human_approval_required?"Required":"Not required")+metric("External actions","0")+'</div>';
    html+=box("Policy evaluation",'<p><strong>Reason:</strong> '+esc(outcome.reason)+'</p><p>This is a simulated route. There is no production incident system or external integration.</p>');
    if(outcome.human_approval_required)html+='<div class="inline-alert">Consequential actions are blocked. Select a human decision to record a local-only preview.</div><div class="actions"><button class="btn btn-soft" type="button" data-decision="approve">Approve preview</button><button class="btn btn-soft" type="button" data-decision="reject">Reject</button><button class="btn btn-soft" type="button" data-decision="escalate">Escalate to owner</button></div>';
    html+='<div id="decision-output"></div>';
    $("incident-output").innerHTML=html;
    for(const button of $("incident-output").querySelectorAll("[data-decision]")){
      button.addEventListener("click",()=>{
        const decision=humanDecision(outcome,button.dataset.decision);
        $("decision-output").innerHTML=banner("Local decision: "+pretty(decision.decision_status))+box("Decision record",kv([["Severity",decision.severity],["Decision",decision.decision],["Result",pretty(decision.decision_status)],["External actions","false"]])+'<p>'+esc(decision.note)+'</p>');
      });
    }
  }catch(ex){error("incident-output",ex.message);}
});

$("diagnose-api").addEventListener("click",()=>{
  try{
    const result=diagnoseApi($("status-code").value,$("api-url").value.trim());
    let html=banner("HTTP "+result.status+" diagnostic preview");
    html+='<div class="metrics-grid">'+metric("Status",result.status)+metric("Category",result.category)+metric("Escalation",result.escalate?"Consider":"Not required")+metric("API calls made","0")+'</div>';
    html+='<div class="result-grid">'+box("What this response means",'<p>'+esc(result.explanation)+'</p>')+box("Troubleshooting sequence",listHtml(result.checks,true))+'</div>';
    html+=codeOutput("Example cURL (display only — not executed)",result.curl_example,"copy-curl");
    $("api-output").innerHTML=html;
  }catch(ex){error("api-output",ex.message);}
});

function renderOperations(){
  const m=supportMetrics(),patterns=duplicatePatterns();
  let html=banner("Demonstration metrics — fictional 10-ticket dataset");
  html+='<div class="metrics-grid">'+metric("Open issues",m.open_issues)+metric("First-response SLA",m.first_response_sla_pct+"%")+metric("Median response",m.median_first_response_minutes+" min")+metric("Automated triage",m.automated_triage_pct+"%")+'</div>';
  html+='<div class="metrics-grid">'+metric("P1 / P2 / P3",m.p1+" / "+m.p2+" / "+m.p3)+metric("Human review cases",m.human_review_cases)+metric("Duplicate groups",m.duplicate_groups_detected)+metric("Avg confidence",m.average_investigation_confidence_pct+"%")+'</div>';
  html+='<h4>Issue distribution</h4><div class="result-grid">'+m.top_issue_categories.map(row=>box(row.category,'<p><strong>'+esc(row.count)+' cases</strong> out of '+esc(m.open_issues)+'</p><div class="spectrum" aria-label="'+esc(row.count)+' cases">'+Array.from({length:row.count},()=>'<span style="width:18px"></span>').join("")+'</div>')).join("")+'</div>';
  html+='<h4 style="margin-top:28px">Potentially related incidents</h4><div class="result-grid">'+patterns.map(p=>box(p.pattern,'<p><strong>'+esc(p.related_tickets.join(", "))+'</strong></p><p>Keyword-match confidence: '+esc(Math.round(p.confidence*100))+'% (heuristic, not model probability)</p><p>'+esc(p.suggested_action)+'</p>')).join("")+'</div>';
  html+='<details class="details"><summary>View all synthetic tickets</summary><div class="table-wrap"><table><thead><tr><th>ID</th><th>Priority</th><th>Category</th><th>Customer report</th></tr></thead><tbody>'+SYNTHETIC_TICKETS.map(t=>'<tr><td>'+esc(t.id)+'</td><td>'+esc(t.severity)+'</td><td>'+esc(t.category)+'</td><td>'+esc(t.text)+'</td></tr>').join("")+'</tbody></table></div></details>';
  $("operations-output").innerHTML=html;
}
renderOperations();

document.addEventListener("click",async event=>{
  const button=event.target.closest("[data-copy]");
  if(!button)return;
  const target=$(button.dataset.copy);
  if(!target)return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(target.textContent);
    button.textContent="Copied ✓";
    button.setAttribute("aria-label","Text copied to clipboard");
  } catch {
    // Explicit selectable fallback for browsers that deny clipboard permission.
    target.tabIndex = 0;
    target.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection?.removeAllRanges();
    selection?.addRange(range);
    button.textContent="Text selected — Ctrl+C";
    button.setAttribute("aria-label","Text selected. Press Control C to copy");
  }
});
$("year").textContent=String(new Date().getFullYear());
