import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  SCENARIOS, SYNTHETIC_TICKETS, investigate, missingInformation, reproductionStatus,
  technicalEvidence, generateCustomerUpdate, generateHandoff, formatHandoff,
  diagnoseApi, routeIncident, humanDecision, duplicatePatterns, supportMetrics
} from "./engine.mjs";

test("seven sample workflows and one custom workflow are available",()=>{
  assert.equal(SCENARIOS.length,8);
  assert.ok(SCENARIOS.every(s=>s.id&&s.purpose));
  assert.ok(SCENARIOS.filter(s=>s.id!=="custom").every(s=>s.ticket));
  assert.equal(SCENARIOS.find(s=>s.id==="custom").ticket,"");
});
test("401 investigation aligns with Python severity and category",()=>{
  const s=SCENARIOS[0],result=investigate(s.ticket);
  assert.equal(result.severity,"P2");
  assert.equal(result.category,"authentication");
  assert.equal(result.confidence,.94);
  assert.ok(result.evidence.some(e=>e.source==="log_query"&&e.detail.status===401));
  assert.equal(result.telemetry.external_action_taken,false);
  assert.equal(reproductionStatus(result.ticket,result).status,"Pattern matched");
  assert.match(technicalEvidence(result.ticket,result).request_id,/^req-demo-401/);
});
test("generic SAML SCIM scenario produces identity-specific guidance",()=>{
  const result=investigate(SCENARIOS[1].ticket);
  assert.equal(result.category,"identity_sso_scim");
  assert.equal(result.severity,"P2");
  assert.ok(result.troubleshooting_steps.some(s=>s.includes("NameID")));
});
test("504 timeout is investigated without external network calls",()=>{
  const result=investigate(SCENARIOS[6].ticket);
  assert.equal(result.category,"performance");
  assert.ok(result.evidence.some(e=>e.source==="log_query"&&e.detail.status===504));
});
test("P1 guardrail forces a human approval preview",()=>{
  const result=investigate(SCENARIOS[4].ticket);
  assert.equal(result.severity,"P1");
  assert.equal(result.human_approval_required,true);
  assert.ok(result.guardrails_triggered.includes("p1_requires_human_approval"));
  assert.equal(result.action_status,"awaiting_human_approval");
  assert.ok(result.evidence.some(e=>e.source==="escalation_preview"&&e.detail.external_action_taken===false));
});
test("synthetic diagnostic failure fails closed",()=>{
  const result=investigate(SCENARIOS[5].ticket,{simulateToolFailure:true});
  assert.equal(result.human_approval_required,true);
  assert.ok(result.tool_errors.length);
  assert.equal(reproductionStatus(result.ticket,result).status,"Unable to reproduce");
});
test("high-risk security phrase routes to review even without an outage",()=>{
  const result=investigate("Customer reports security breach in production");
  assert.equal(result.human_approval_required,true);
  assert.ok(result.guardrails_triggered.includes("high_risk_signal_requires_human_approval"));
});
test("missing-information rules request IDs and timestamps",()=>{
  const missing=missingInformation("Customer says integration is weird.");
  assert.ok(missing.includes("request ID"));
  assert.ok(missing.includes("timestamp"));
  assert.ok(missing.includes("endpoint / URL"));
});
test("rejects short inputs, and bounds long tickets",()=>{
  assert.throws(()=>investigate("bad"),/five characters/);
  const result=investigate("Production reports HTTP 401. "+"a".repeat(8000));
  assert.equal(result.ticket.length,6000);
  assert.ok(result.guardrails_triggered.includes("input_truncated_to_configured_budget"));
});
test("handoff is structured and never claims to have taken action",()=>{
  const ticket=SCENARIOS[0].ticket,result=investigate(ticket);
  const report=generateHandoff(result.ticket,result);
  assert.equal(report.external_action_taken,false);
  assert.equal(report.severity,"P2");
  assert.match(formatHandoff(report),/External action taken: false/);
});
test("customer-facing update requests more evidence and no writes",()=>{
  const t=SCENARIOS[0].ticket,result=investigate(t);
  const update=generateCustomerUpdate(t,result);
  assert.match(update,/No changes have been made/);
  assert.match(update,/request ID/i);
});
test("API diagnostics 401 and 503 are correct and no API request is made",()=>{
  const unauthorized=diagnoseApi(401);
  assert.equal(unauthorized.category,"Authentication");
  assert.equal(unauthorized.escalate,false);
  assert.match(unauthorized.curl_example,/curl -i -X GET/);
  assert.equal(diagnoseApi(503).escalate,true);
});
test("rejects unsafe example API URLs",()=>{
  assert.throws(()=>diagnoseApi(401,"javascript:alert(1)"),/Only HTTP or HTTPS/);
  assert.throws(()=>diagnoseApi(401,"https://test:secret@example.com"),/without embedded credentials/);
});
test("incident router and human decision are local only",()=>{
  const route=routeIncident("production down - complete outage");
  assert.equal(route.severity,"P1");
  assert.equal(route.human_approval_required,true);
  const decision=humanDecision(route,"approve");
  assert.equal(decision.decision_status,"approved_for_next_step");
  assert.equal(decision.external_action_taken,false);
  assert.throws(()=>humanDecision(route,"delete"),/Unsupported/);
});
test("analytics use synthetic tickets and deterministic grouping",()=>{
  const metrics=supportMetrics();
  assert.equal(SYNTHETIC_TICKETS.length,10);
  assert.equal(metrics.open_issues,10);
  assert.equal(metrics.p1,1);
  assert.equal(metrics.first_response_sla_pct,96);
  const groups=duplicatePatterns();
  assert.equal(groups.length,3);
  assert.ok(groups.some(x=>x.pattern==="SSO / Provisioning"));
});
test("site includes all five accessible interactive panels",()=>{
  const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  for(const id of ["investigation","handoff","incident","api","operations"]){
    assert.match(html,new RegExp('id="tab-'+id+'"'));
    assert.match(html,new RegExp('id="panel-'+id+'"'));
  }
  assert.match(html,/type="module" src="\.\/app\.js"/);
  assert.match(html,/Browser demos use deterministic JavaScript/i);
});


test("unknown customer never inherits the default customer authentication logs",()=>{
  const report=investigate("A fictional customer reports an unexpected integration issue.");
  assert.equal(report.category,"integration");
  assert.equal(report.evidence.filter(x=>x.source==="log_query").length,0);
  assert.equal(report.human_approval_required,false);
});
test("unrelated 504 synthetic fixtures do not determine an ambiguous CUST-202 report",()=>{
  const report=investigate("Customer CUST-202 says the integration behaves differently in production.");
  assert.equal(report.category,"integration");
  assert.equal(report.evidence.filter(x=>x.source==="log_query").length,0);
  assert.equal(reproductionStatus(report.ticket,report).status,"Not reproduced");
});
test("explicit customer and issue must both match the static logs",()=>{
  const mismatch=investigate("Customer CUST-202 reports an HTTP 401 unauthorized error in production.");
  assert.equal(mismatch.category,"authentication");
  assert.equal(mismatch.evidence.filter(x=>x.source==="log_query").length,0);
  const match=investigate("Customer CUST-202 reports HTTP 504 timeout in production.");
  assert.ok(match.evidence.some(x=>x.source==="log_query"&&x.detail.status===504));
});
test("a security breach receives P1 treatment and human review",()=>{
  const report=investigate("Customer reports a security breach in production.");
  assert.equal(report.severity,"P1");
  assert.equal(report.human_approval_required,true);
});
test("service state is explicitly a fictional fixture, never live operational status",()=>{
  const report=investigate(SCENARIOS[4].ticket);
  assert.equal(technicalEvidence(report.ticket,report).service_status,"Synthetic fixture only — no live health check");
  assert.ok(report.evidence.some(x=>x.source==="service_status"&&x.detail.state==="synthetic_fixture_only_not_live"));
});
test("generated shell examples safely quote URL command substitutions",()=>{
  const dangerous="https://api.example.test/path?filter=$(touch%20oops)";
  const command=diagnoseApi(401,dangerous).curl_example;
  assert.ok(command.includes("GET 'https://"));
  assert.ok(command.includes("$(touch"));
  assert.ok(!command.includes('GET "https://'));
  const quote=diagnoseApi(403,"https://example.test/o'hara").curl_example;
  assert.ok(quote.includes("'\"'\"'"));
});
test("diagnostic URL lengths are bounded",()=>{
  assert.throws(()=>diagnoseApi(401,"https://example.test/"+'a'.repeat(3000)),/too long/);
});
test("HTML includes custom-reset UX, reviewer tour and stable accessible tabs",()=>{
  const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.match(html,/id="reset-investigation"/);
  assert.match(html,/60-SECOND TOUR/);
  assert.match(html,/id="workspace"/);
  assert.match(html,/aria-selected="true"/);
  assert.match(html,/No external writes|no external writes/i);
});
test("UI escapes reports before inserting HTML and has a clipboard fallback",()=>{
  const app=readFileSync(new URL("./app.js",import.meta.url),"utf8");
  assert.match(app,/replace\(\/\[&<>"'\]\//);
  assert.match(app,/window\.getSelection\(\)/);
  assert.match(app,/scenario"\)\.value = "custom"/);
});
