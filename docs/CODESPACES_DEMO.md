# GitHub Codespaces Public Demo

This deployment profile runs an isolated copy of NJU Match inside GitHub
Codespaces. It does not proxy or tunnel traffic to the Ubuntu origin server.
It is intended for short-lived course demonstrations, not production use.

## What is started

The Codespace builds and starts the repository's real Docker Compose stack:

- PostgreSQL 16;
- the Node.js backend and Agent harness;
- the React frontend and its same-origin API/WebSocket gateway;
- deterministic demo users, forum/circle data, resonance capsules, and meetup
  safety plans.

The generated database volume and credentials exist only in the Codespace.
`.env.codespaces` is ignored by Git and must never be committed.

## Create the demo

1. Open the repository on GitHub.
2. Select **Code > Codespaces > Create codespace**.
3. Wait for the post-create task to build the images and report a healthy URL.
4. Open the **PORTS** panel.
5. Confirm port `8082` has visibility **Public**.
6. Copy its forwarded address and open `/health` before sharing the root URL.

The public address has this form:

```text
https://<codespace-name>-8082.app.github.dev
```

If an organization policy prevents public forwarded ports, this profile cannot
override that account-level policy.

## Optional LLM credential

Create a GitHub Codespaces repository secret named `LLM_API_KEY` before
creating the Codespace. Optional non-secret overrides are `LLM_BASE_URL` and
`LLM_MODEL`. Never place a real provider credential in the repository or in a
pull request.

After adding or changing a Codespaces secret, rebuild the Codespace or run:

```bash
bash .devcontainer/scripts/bootstrap-demo.sh
```

## Verification

Inside the Codespace:

```bash
curl -i http://127.0.0.1:8082/health
curl -i http://127.0.0.1:8082/api/v1/stats
bash .devcontainer/scripts/show-demo-status.sh
```

The health endpoint must return HTTP `200`, and `totalUsers` must be greater
than zero after the seed completes.

## Lifecycle and security

- A stopped Codespace does not provide an always-on deployment.
- Port visibility can revert to private after a restart; verify it before the
  demonstration.
- The seeded accounts are public demo identities. Do not load production or
  personal data into this database.
- Delete the Codespace after grading to remove its volumes and generated
  credentials.
