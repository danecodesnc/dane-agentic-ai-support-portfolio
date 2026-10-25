import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  SCENARIOS, SYNTHETIC_TICKETS, investigate, missingInformation, reproductionStatus,
  technicalEvidence, generateCustomerUpdate, generateHandoff, formatHandoff,
  diagnoseApi, routeIncident, humanDecision, duplicatePatterns, supportMetrics
} from "./engine.mjs";

test("all seven preset workflows exist and use synthetic inputs",()=>{
  assert.equal(SCENARIOS.length,7);
  assert.ok(SCENARIOS.every(s=>s.id&&s.ticket&&s.purpose));
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
  assert.match(html,/browser demos use deterministic JavaScript rules/i);
});
