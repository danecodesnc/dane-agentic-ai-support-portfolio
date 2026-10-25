# GitHub Pages migration

The GitHub-only interactive portfolio lives in docs/:

- docs/index.html — semantic, recruiter-friendly website
- docs/styles.css — responsive design
- docs/engine.mjs — deterministic JavaScript support/incident/API logic
- docs/app.js — browser controls and result rendering
- docs/engine.test.mjs — Node.js regression checks

## Public URL (after Pages is enabled)

https://danecodesnc.github.io/dane-agentic-ai-support-portfolio/

## One-time repository setting

GitHub currently reports has_pages: false, so publishing needs a one-time setting change by the repository owner:

1. Open https://github.com/danecodesnc/dane-agentic-ai-support-portfolio/settings/pages
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → GitHub Pages — Portfolio**, and if necessary click **Run workflow** on master.
4. Confirm the workflow's **Verify browser demo** and **Publish to GitHub Pages** jobs succeed.
5. Open the public URL above and test a 401 investigation, an engineering handoff, a P1 approval preview and a 504 diagnostic.

GitHub Actions publishes only the docs/ directory. The Python source, FastAPI endpoints, Streamlit demo, tests, and n8n workflows remain in the repository, are not executed in the browser, and are not hosted as API services.

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

## Optional finishing touches

The repository's GitHub About → Website may still point to the old Railway URL. After confirming Pages works, change that field to the GitHub Pages URL. This is not required for hosting.
