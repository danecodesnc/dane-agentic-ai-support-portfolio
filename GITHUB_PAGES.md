# GitHub Pages migration

The GitHub-only interactive portfolio lives in docs/:

- docs/index.html — semantic, recruiter-friendly website
- docs/styles.css — responsive design
- docs/engine.mjs — deterministic JavaScript support/incident/API logic
- docs/app.js — browser controls and result rendering
- docs/engine.test.mjs — Node.js regression checks

## Live public URL

https://danecodesnc.github.io/dane-agentic-ai-support-portfolio/

## Deployment and verification

GitHub Pages is enabled and the deployment source is **GitHub Actions**. The workflow file is `.github/workflows/pages.yml`.

1. Open https://github.com/danecodesnc/dane-agentic-ai-support-portfolio/actions/workflows/pages.yml
2. For pull requests touching the website, **Verify browser demo** runs syntax checks and Node.js regression tests; the publication job does not run on PRs.
3. After review and merge into `master`, GitHub Actions automatically deploys the `docs/` directory.
4. Verify the workflow completes both the JavaScript test and Pages deployment jobs successfully.
5. Open the public URL above and manually test a 401 investigation, an engineering handoff, a P1 approval preview, custom input, copying output and a 504 diagnostic.

No paid hosting plan, API key, database or external backend is required.

GitHub Actions publishes only the docs/ directory. The Python source, FastAPI endpoints, Streamlit demo, tests, and n8n workflows remain in the repository, are not executed in the browser, and are not hosted as API services.

## V2 accuracy and privacy decisions

- Never infer an API failure from unrelated synthetic records: the browser implementation matches logs only when both a known fixture customer and the report's error family align.
- If the user edits a sample report, the selection switches to Custom and the synthetic tool-failure override is cleared.
- The browser labels service status as a **fictional fixture**, not a live production check.
- “Confidence” percentages in Python sample data and browser rule scores are **configured heuristics**, not statistical certainty.
- Example cURL output uses shell-safe single quoting. It is never executed in the browser.
- The public demo is a front-end simulation; use only invented tickets, without credentials or real customer data.

The existing Python agent was intentionally preserved unchanged. Where the browser has stricter evidence labeling and matching, this is an explicit accuracy/safety improvement, not proof that both engines are identical.

## Development and validation

No npm installation, API key or server is required.

~~~sh
node --test docs/engine.test.mjs
python -m pytest -q
~~~

To preview locally, serve docs/ with any basic static web server (ES modules require HTTP):

~~~sh
python -m http.server 8000 --directory docs
~~~

Then visit http://localhost:8000.

## Functional and security boundaries

- The website runs in the browser using deterministic simulation rules, not an LLM and not the Python backend.
- All customer records, logs, sample metrics, decisions and incident routes are synthetic.
- No external writes, ticket-system integrations, customer API calls or secrets are used.
- The HTTP diagnostics tool generates example commands but does not execute them.
- GitHub Pages cannot execute FastAPI/Streamlit/Python or protect an OpenAI API key used from client JavaScript. The original optional Python/live LLM path remains source code only unless separately run in a trusted server environment.
- Avoid putting tokens, customer information or confidential support tickets into the public browser demo. Browser-side data is processed locally, but the published source can be inspected by anyone.

## Railway clean-up

No Railway service, project or volume needs to be deleted to use GitHub Pages. Do not apply the Railway environment's pending deletion patch, which also targets the separate submarine-streaming service. Railway billing, service cleanup and volume preservation are independent decisions.

## Repository About / Website

The GitHub repository About → Website currently points to the old Railway URL. The GitHub connector available for this project does not expose repository-metadata editing. An owner can update it once at https://github.com/danecodesnc/dane-agentic-ai-support-portfolio by clicking **About → ⚙ → Website** and entering https://danecodesnc.github.io/dane-agentic-ai-support-portfolio/ . This affects the GitHub repository profile only, not hosting.
