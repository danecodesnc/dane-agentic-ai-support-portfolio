/**
 * Deterministic, browser-only port of the portfolio's synthetic support workflows.
 * No API calls, secrets, LLM inference, or external writes are performed here.
 * The original Python/Streamlit/FastAPI code remains in the repository.
 */
export const SCENARIOS = [
  {id:"credentials", name:"401 · Credential rotation", ticket:"Customer CUST-101 reports HTTP 401 in production after rotating API credentials. Postman works, but the production integration still fails at /api/v1/auth.", purpose:"Compare synthetic request logs, identity context and credential propagation.", failure:false},
  {id:"sso", name:"SSO · SAML / SCIM", ticket:"Acme Corp enabled SAML SSO in its production workspace. Users authenticate successfully with the identity provider but receive an access error when returning to the application. Some recently provisioned users are missing from the workspace.", purpose:"Investigate a generic enterprise identity mapping and provisioning failure.", failure:false},
  {id:"ambiguous", name:"Integration · Missing information", ticket:"Customer CUST-202 says the integration behaves differently between test and production, but no error code or request ID was provided.", purpose:"Ask for missing technical evidence rather than invent a root cause.", failure:false},
  {id:"unknown", name:"Unknown · Low confidence", ticket:"Customer CUST-202 reports intermittent unexpected behavior with no timestamps, request IDs, endpoints, or reproducible steps.", purpose:"Demonstrate restrained conclusions when details are incomplete.", failure:false},
  {id:"outage", name:"P1 · Complete outage", ticket:"Production down - complete outage for all customers. Preserve evidence and escalate immediately.", purpose:"Show hard-coded human approval for high-risk incidents.", failure:false},
  {id:"failure", name:"Diagnostic tool · Unavailable", ticket:"Customer CUST-101 reports an authentication failure in production, but the diagnostic log tool is unavailable.", purpose:"Fail safely into human review when an evidence source fails.", failure:true},
  {id:"timeout", name:"504 · Upstream timeout", ticket:"Customer CUST-202 reports repeated HTTP 504 timeouts in production at /api/v1/resource. Multiple requests are affected and request IDs are available for investigation.", purpose:"Trace synthetic upstream timeouts and next troubleshooting steps.", failure:false}
];

export const SYNTHETIC_TICKETS = [
  {id:"TKT-1001", text:"Production API returns HTTP 401 after API key rotation.", severity:"P2", category:"Authentication"},
  {id:"TKT-1002", text:"New production credentials are rejected with 401 Unauthorized.", severity:"P2", category:"Authentication"},
  {id:"TKT-1003", text:"Authentication stopped after replacing the production secret.", severity:"P2", category:"Authentication"},
  {id:"TKT-1004", text:"Dashboard page loads slowly for one user.", severity:"P3", category:"Configuration"},
  {id:"TKT-1005", text:"SAML user authenticates at the IdP but cannot enter the workspace.", severity:"P2", category:"SSO / Provisioning"},
  {id:"TKT-1006", text:"SCIM-created user is missing from the expected workspace.", severity:"P2", category:"SSO / Provisioning"},
  {id:"TKT-1007", text:"Multiple production requests return HTTP 504 upstream timeout.", severity:"P2", category:"API Timeout"},
  {id:"TKT-1008", text:"Second customer reports repeated 504 responses with request IDs.", severity:"P2", category:"API Timeout"},
  {id:"TKT-1009", text:"Production down - complete outage for all customers.", severity:"P1", category:"Platform Availability"},
  {id:"TKT-1010", text:"Customer needs help configuring a non-production webhook.", severity:"P3", category:"Configuration"}
];

const CUSTOMERS = {
  "CUST-101": {plan:"Enterprise", environment:"production", integration:"REST API", last_credential_rotation:"2026-09-01"},
  "CUST-202": {plan:"Business", environment:"production", integration:"REST API"},
  "CUST-303": {plan:"Enterprise", environment:"production", integration:"SAML SSO + SCIM", workspace:"acme-demo"}
};
const LOGS = [
  {customer_id:"CUST-101", status:401, message:"invalid api key", request_id:"req-demo-401-a"},
  {customer_id:"CUST-101", status:401, message:"authorization rejected", request_id:"req-demo-401-b"},
  {customer_id:"CUST-202", status:504, message:"upstream timeout", request_id:"req-demo-504-a"},
  {customer_id:"CUST-303", status:403, message:"workspace user mapping failed after successful SAML response", request_id:"req-demo-sso-303"}
];
const KNOWLEDGE = [
  ["401 credential rotation","If Postman works but production returns 401 after a rotation, compare the exact Authorization header and secret source used by the production runtime."],
  ["504 timeout","Capture request IDs and timestamps, compare service health, and review bounded retry/backoff behavior."],
  ["429 rate limit","Honor Retry-After, use exponential backoff with jitter, and reduce burst concurrency."],
  ["SAML SSO SCIM provisioning","Compare NameID/email mapping, assertion attributes, SCIM results and workspace assignment."]
];
const SSO_CHECKS = [
  "Verify the SAML NameID format matches the expected user identifier.",
  "Verify email attribute mapping in the SAML assertion.",
  "Compare assertion attributes for an affected and a working user.",
  "Inspect the SCIM provisioning result for errors.",
  "Confirm the user exists in the expected workspace.",
  "Verify domain-to-workspace mapping.",
  "Compare a working and failing account to isolate the difference."
];

function words(input) {
  return new Set((input.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2));
}
function customerId(ticket) {
  const match = ticket.toUpperCase().match(/CUST-\d+/);
  if (match) return match[0];
  if (/acme|saml|scim/i.test(ticket)) return "CUST-303";
  return "CUST-101"; // Same documented synthetic default as the Python demo.
}
function searchKnowledge(ticket) {
  const terms = words(ticket);
  return KNOWLEDGE.map(([title,detail]) => {
    let score = 0;
    for (const word of words(title + " " + detail)) if (terms.has(word)) score++;
    return {score, item:{source:"synthetic_kb", title, detail}};
  }).filter(item => item.score > 0).sort((a,b)=>b.score-a.score).slice(0,2).map(item=>item.item);
}
export function missingInformation(ticket) {
  const t = (ticket || "").toLowerCase();
  const missing = [];
  if (!/(req(?:uest)?[-_ ]?id|req-[a-z0-9-]+)/.test(t)) missing.push("request ID");
  if (!/(\b\d{1,2}:\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b|timestamp)/.test(t)) missing.push("timestamp");
  if (!/(https?:\/\/|\/api\/|endpoint|url)/.test(t)) missing.push("endpoint / URL");
  if (!["production","prod","staging","sandbox","test environment","workspace"].some(word=>t.includes(word))) missing.push("environment");
  if (!/\b(?:400|401|403|404|409|429|500|502|503|504)\b|error|unauthorized|timeout|access/.test(t)) missing.push("exact error / response");
  if (!["after","when","steps","reproduce","rotat","enabled","returning"].some(word=>t.includes(word))) missing.push("reproduction steps");
  return missing;
}
function classify(ticket,logs) {
  const t = ticket.toLowerCase();
  const logText = logs.map(x=>x.message).join(" ").toLowerCase();
  if (t.includes("production down") || t.includes("complete outage"))
    return ["P1","availability",.97,["Service availability incident"],["Confirm blast radius","Escalate to an incident owner","Preserve request IDs and timestamps"]];
  if (["saml","scim","identity provider","idp","workspace"].some(x=>t.includes(x)) &&
      ["access","missing","provision","authenticate","login"].some(x=>t.includes(x)))
    return ["P2","identity_sso_scim",.95,["SAML identifier mapping and SCIM provisioning are inconsistent for the affected user."],SSO_CHECKS];
  if (t.includes("401") || t.includes("unauthorized") || logText.includes("invalid api key"))
    return ["P2","authentication",.94,["Stale or mismatched production credential","Credential rotation did not propagate to the production runtime"],["Compare the production Authorization header to the working Postman request","Verify the secret source/environment","Use request IDs to confirm the rejected credential path"]];
  if (t.includes("504") || t.includes("timeout") || logText.includes("upstream timeout"))
    return ["P2","performance",.90,["Upstream latency or timeout"],["Capture request IDs and durations","Check service health","Review bounded retry/backoff behavior"]];
  if (t.includes("429"))
    return ["P3","rate_limit",.91,["Rate limit exceeded"],["Inspect Retry-After","Add exponential backoff with jitter","Reduce burst concurrency"]];
  return ["P3","integration",.65,["Insufficient evidence for a single root cause"],["Capture the complete request/response","Collect timestamps and request IDs","Compare working and failing environments"]];
}
export function investigate(rawTicket,{simulateToolFailure=false}={}) {
  if (typeof rawTicket !== "string" || rawTicket.trim().length < 5) throw new Error("Provide at least five characters of support context.");
  const ticket = rawTicket.trim().slice(0,6000);
  const truncated = rawTicket.trim().length > 6000;
  const cid = customerId(ticket);
  const customer = CUSTOMERS[cid] || {found:false};
  const logs = simulateToolFailure ? [] : LOGS.filter(log=>log.customer_id===cid);
  const toolErrors = simulateToolFailure ? ["query_logs synthetic failure: diagnostic evidence unavailable"] : [];
  const guardrails = [];
  if (truncated) guardrails.push("input_truncated_to_configured_budget");
  const [severity,category,confidence,likely_causes,troubleshooting_steps] = classify(ticket,logs);
  let forced = severity==="P1";
  let reason = forced ? "P1 incidents require human escalation." : "No deterministic high-risk signal detected.";
  if (forced) guardrails.push("p1_requires_human_approval");
  if (toolErrors.length) {
    forced = true;
    reason = "A required diagnostic tool failed; this investigation needs human review.";
    guardrails.push("tool_failure_requires_human_review");
  }
  if (!forced) for (const term of ["production down","complete outage","security breach","data loss","data corruption","credential leak"]) {
    if (ticket.toLowerCase().includes(term)) {
      forced=true; reason="High-risk signal detected: " + term + ".";
      guardrails.push("high_risk_signal_requires_human_approval");
      break;
    }
  }
  const evidence = [
    {source:"customer_lookup",detail:customer},
    {source:"service_status",detail:{state:"operational",incidents:[]}},
    ...logs.slice(0,2).map(detail=>({source:"log_query",detail})),
    ...searchKnowledge(ticket)
  ];
  if (category==="identity_sso_scim") evidence.push({source:"identity_diagnostics",detail:{customer:"Acme Corp (synthetic)",nameid_email_mapping:"mismatch",scim_provisioning_status:"partial_failure",platform_wide_outage:false,request_id:"req-demo-sso-303"}});
  if (toolErrors.length) evidence.push({source:"tool_error",detail:toolErrors[0]});
  const bounded = evidence.slice(0,Math.max(0,6-(forced?1:0)));
  if (forced) bounded.push({source:"escalation_preview",detail:{preview_only:true,severity,reason,external_action_taken:false}});
  const tools_used=["search_knowledge_base","lookup_customer","check_service_status","query_logs"];
  if (category==="identity_sso_scim") tools_used.push("diagnose_sso_scim");
  if (forced) tools_used.push("create_escalation_preview");
  const action_status = forced?"awaiting_human_approval":"recommendation_only_no_external_action";
  const decision_trace = [
    {step:"input_guardrail",result:truncated?"truncated":"within_budget"},
    {step:"evidence_collection",result:bounded.length+" bounded evidence items"},
    {step:"classification",result:{severity,category,confidence}},
    {step:"policy",result:{human_approval_required:forced,reason}},
    {step:"action",result:action_status}
  ];
  return {
    ticket,severity,category,confidence,likely_causes,troubleshooting_steps,
    escalate:forced,human_approval_required:forced,escalation_reason:reason,
    action_status,evidence:bounded,tools_used,tool_errors:toolErrors,guardrails_triggered:guardrails,decision_trace,
    telemetry:{mode:"browser_deterministic",request_chars:ticket.length,approx_input_tokens:Math.ceil(ticket.length/4),token_measurement:"rough_local_estimate_not_provider_usage",context_items:bounded.length,max_evidence_items:6,external_action_taken:false}
  };
}
export function reproductionStatus(ticket,result) {
  if (result.tool_errors.length) return {status:"Unable to reproduce",reason:"Required diagnostic evidence is unavailable."};
  const missing = missingInformation(ticket);
  const hasLog = result.evidence.some(x=>x.source==="log_query");
  if (["authentication","performance","identity_sso_scim"].includes(result.category) && hasLog && missing.length<=3)
    return {status:"Pattern matched",reason:"A corresponding failure pattern appears in the synthetic sample logs. No real customer system was tested."};
  if (hasLog) return {status:"Partial pattern match",reason:"Related synthetic logs exist, but important customer details are missing."};
  return {status:"Not reproduced",reason:"No matching synthetic diagnostic evidence was available; gather more context."};
}
export function technicalEvidence(ticket,result) {
  const log = result.evidence.find(x=>x.source==="log_query")?.detail;
  const service = result.evidence.find(x=>x.source==="service_status")?.detail;
  const endpoint = ticket.match(/(https?:\/\/\S+|\/api\/[\w\-/]+)/);
  const browser=/(browser|saml|workspace)/i.test(ticket);
  return {
    service_status:service?.state || "unknown",
    http_response:log ? log.status+" "+log.message : "Not captured",
    request_id:log?.request_id || "Not provided",
    environment:/production|prod/i.test(ticket)?"Production":"Not explicitly provided",
    endpoint:endpoint ? endpoint[0].replace(/[.,)]+$/,"") : result.category==="authentication"?"/api/v1/auth (synthetic)":"Not provided",
    browser:browser?"Chrome (synthetic demo)":"Not provided",
    operating_system:browser?"Windows 11 (synthetic demo)":"Not provided",
    reproduction_status:reproductionStatus(ticket,result).status
  };
}
export function generateCustomerUpdate(ticket,result) {
  const missing=missingInformation(ticket);
  const step=result.troubleshooting_steps[0] || "collect additional technical evidence";
  let message="Thanks for the details. I reviewed the information available so far. The issue currently appears related to "+result.category.replaceAll("_"," ")+", but this is a preliminary hypothesis based on synthetic evidence. Next I would "+step.toLowerCase().replace(/\.$/,"")+".";
  if (result.human_approval_required) message+=" This case meets an escalation or evidence-quality boundary, so human review is required before consequential action.";
  if (missing.length) message+=" To continue the investigation, please provide: "+missing.slice(0,5).join(", ")+".";
  return message+" No changes have been made to your environment by this demo.";
}
export function generateHandoff(ticket,result) {
  const tech=technicalEvidence(ticket,result);
  const repro=reproductionStatus(ticket,result);
  const titles={authentication:"Authentication failure after credential change",performance:"Repeated API timeout / latency failure",identity_sso_scim:"SAML SSO / SCIM provisioning access failure",availability:"Platform availability incident"};
  return {
    issue_title:titles[result.category]||"Integration support issue",
    severity:result.severity,
    environment:tech.environment,
    customer_impact:["P1","P2"].includes(result.severity)?"Customer workflow is blocked or degraded.":"Limited customer impact reported.",
    expected_behavior:"The customer workflow should complete successfully with valid configuration and credentials.",
    actual_behavior:ticket,
    reproduction_status:repro.status,
    reproduction_reason:repro.reason,
    reproduction_steps:result.troubleshooting_steps.slice(0,4),
    technical_evidence:tech,
    root_cause_hypothesis:result.likely_causes[0],
    confidence:result.confidence,
    recommended_engineering_investigation:result.troubleshooting_steps,
    missing_information:missingInformation(ticket),
    escalation_reason:result.escalation_reason,
    customer_facing_status:result.human_approval_required?"Escalation preview awaiting human review":"Investigation preview; no external action",
    external_action_taken:false
  };
}
export function formatHandoff(report) {
  return [
    "Issue: "+report.issue_title,"Severity: "+report.severity,"Environment: "+report.environment,
    "Customer impact: "+report.customer_impact,"",
    "Expected: "+report.expected_behavior,"Actual: "+report.actual_behavior,"",
    "Reproduction: "+report.reproduction_status,"Reason: "+report.reproduction_reason,"",
    "Reproduction / troubleshooting steps:",...report.reproduction_steps.map((x,i)=>(i+1)+". "+x),"",
    "Technical evidence:","- HTTP/network: "+report.technical_evidence.http_response,
    "- Request ID: "+report.technical_evidence.request_id,
    "- Endpoint: "+report.technical_evidence.endpoint,
    "- Service: "+report.technical_evidence.service_status,"",
    "Root-cause hypothesis: "+report.root_cause_hypothesis,"Confidence: "+Math.round(report.confidence*100)+"%","",
    "Missing information:",...(report.missing_information.length?report.missing_information:["None identified"]).map(x=>"- "+x),"",
    "Escalation: "+report.escalation_reason,
    "Customer-facing status: "+report.customer_facing_status,
    "External action taken: false"
  ].join("\n");
}
const API_RULES = {
  400:["Request validation","The server rejected the request as invalid.",["Validate JSON syntax and schema","Check required fields and data types","Confirm Content-Type"],false],
  401:["Authentication","The request did not present an accepted credential.",["Compare Authorization header to a known-good Postman request","Verify the production secret source","Confirm credential rotation propagated"],false],
  403:["Authorization","The caller may be authenticated but lacks permission.",["Verify role or scope","Confirm resource ownership","Check environment and tenant"],false],
  404:["Resource or route","The route or resource was not found.",["Verify base URL and API version","Check resource identifier","Confirm environment"],false],
  429:["Rate limit","The caller exceeded an API rate limit.",["Inspect Retry-After","Use exponential backoff with jitter","Reduce concurrency"],false],
  500:["Server error","The service encountered an unexpected error.",["Capture request ID","Check service status","Minimize reproducible request"],true],
  503:["Availability","The service is temporarily unavailable or overloaded.",["Check service status","Capture request IDs and timestamps","Use bounded retries for safe or idempotent operations only"],true],
  504:["Performance","A gateway timed out waiting for an upstream dependency.",["Capture request ID and duration","Check upstream and service health","Review retry and backoff behavior"],true]
};
export function diagnoseApi(status,url="https://api.example.test/v1/resource") {
  const n=Number(status);
  if (!Number.isInteger(n)) throw new Error("Select a valid HTTP status.");
  let parsed;
  try { parsed=new URL(url); } catch { throw new Error("Enter a complete HTTP or HTTPS example URL."); }
  if (!["http:","https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Only HTTP or HTTPS URLs without embedded credentials are allowed.");
  const [category,explanation,checks,escalate]=API_RULES[n]||["Unknown","No rule is defined for this status.",["Capture complete request/response","Check documentation","Escalate with request ID"],true];
  return {status:n,category,explanation,checks,escalate,curl_example:"curl -i -X GET "+JSON.stringify(parsed.href)+" -H 'Authorization: Bearer $API_TOKEN' -H 'Accept: application/json'"};
}
export function routeIncident(ticket) {
  if (typeof ticket!=="string" || ticket.trim().length<5) throw new Error("Describe the incident in at least five characters.");
  const t=ticket.toLowerCase();
  if (["production down","complete outage","security breach","data loss"].some(x=>t.includes(x)))
    return {severity:"P1",route:"human_escalation_preview",human_approval_required:true,reason:"High-risk signal"};
  if (["401","504","multiple customers","degraded"].some(x=>t.includes(x)))
    return {severity:"P2",route:"senior_support_review",human_approval_required:false,reason:"Material technical impact"};
  return {severity:"P3",route:"standard_support",human_approval_required:false,reason:"No high-risk signal"};
}
export function humanDecision(route,decision) {
  if (!["approve","reject","escalate"].includes(decision)) throw new Error("Unsupported decision.");
  return {
    decision,decision_status:decision==="approve"?(route.human_approval_required?"approved_for_next_step":"acknowledged"):decision==="reject"?"rejected_no_action":"escalated_to_human_owner",
    severity:route.severity,route:route.route,human_approval_required:route.human_approval_required,external_action_taken:false,
    note:"Portfolio preview only. No Jira, Slack, CRM or customer system is modified."
  };
}
export function duplicatePatterns(tickets=SYNTHETIC_TICKETS) {
  const definitions=[
    {pattern:"Authentication / Credential Rotation",words:["401","credential","api key","secret","authentication"],characteristics:["production environment","HTTP 401 / authentication failure","credential or secret change"]},
    {pattern:"SSO / Provisioning",words:["saml","scim","workspace","idp","provision"],characteristics:["enterprise identity workflow","workspace access","provisioning boundary"]},
    {pattern:"API Timeout",words:["504","timeout","latency","upstream"],characteristics:["API request path","timeout response","performance impact"]}
  ];
  return definitions.map(d=>{
    const matches=tickets.filter(row=>d.words.some(w=>row.text.toLowerCase().includes(w)));
    return {pattern:d.pattern,count:matches.length,related_tickets:matches.map(x=>x.id),confidence:Math.min(.98,.7+.07*matches.length),shared_characteristics:d.characteristics,
      reason:"Transparent deterministic keyword grouping; not a trained ML classifier.",
      suggested_action:"Consolidate related reports into a primary investigation and preserve individual customer impact."};
  }).filter(x=>x.count>=2);
}
export function supportMetrics(tickets=SYNTHETIC_TICKETS) {
  const count=field=>tickets.filter(t=>t.severity===field).length;
  const categories={};
  for(const ticket of tickets)categories[ticket.category]=(categories[ticket.category]||0)+1;
  return {label:"Demo metrics — synthetic data",open_issues:tickets.length,p1:count("P1"),p2:count("P2"),p3:count("P3"),
    first_response_sla_pct:96,median_first_response_minutes:18,automated_triage_pct:80,average_investigation_confidence_pct:87,human_review_cases:2,
    duplicate_groups_detected:duplicatePatterns(tickets).length,top_issue_categories:Object.entries(categories).map(([category,count])=>({category,count})).sort((a,b)=>b.count-a.count)};
}
