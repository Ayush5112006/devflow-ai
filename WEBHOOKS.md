<<<<<<< HEAD
# Webhooks

## Overview

FixFlow AI can receive GitHub webhook events at:

```
POST /api/integrations/github/webhook
```

## Security

Webhook payloads are validated using HMAC-SHA256 signature verification.
The secret is read **only** from the `GITHUB_WEBHOOK_SECRET` environment variable.
The secret value is **never** returned through any API endpoint.

### Without a secret (development only)

If `GITHUB_WEBHOOK_SECRET` is not set, webhooks are accepted without signature
validation. This is acceptable in local development but **must not** be used in
production.

### With a secret (production)

```bash
export GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

All incoming webhook requests without a valid `X-Hub-Signature-256` header
will receive a `401 Unauthorized` response.

---

## Setup

### 1. Generate a webhook secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Set environment variable

```bash
export GITHUB_WEBHOOK_SECRET=your-hex-secret-here
```

### 3. Configure GitHub webhook

1. Go to your repository on GitHub
2. Settings → Webhooks → Add webhook
3. Payload URL: `https://your-server.com/api/integrations/github/webhook`
4. Content type: `application/json`
5. Secret: the same value as `GITHUB_WEBHOOK_SECRET`
6. Events: select `Issues`, `Pull requests`, `Pushes` (or all events)
7. Click **Add webhook**

### 4. Verify webhook status

```bash
curl http://localhost:4000/api/integrations/github/webhook/config
```

---

## Supported Events

| Event | Action | Effect |
|-------|--------|--------|
| `issues` | any | Stored in memory; issues count updated on repo |
| `pull_request` | any | Stored in memory |
| `push` | — | Stored in memory |

All events are stored in memory (capped at 200). They are visible in the
Webhook Configuration section of the Repositories page.

---

## Viewing Events

```bash
curl http://localhost:4000/api/integrations/github/webhook/events
```

The UI also displays recent events in the **Webhook Configuration** section
of the `/repositories` page (click to expand).

---

## Limitations

- Events are stored in memory only (no persistence). They are lost on restart.
- Automatic investigation triggering on webhook events requires manual configuration.
- Only GitHub webhooks are currently supported.
=======
# GitHub Webhooks in FixFlow AI

FixFlow AI includes a secure webhook receiver for GitHub push, issue, and pull request events.

## 1. Webhook Endpoint

- **URL**: `POST /api/repositories/github/webhook` (or `/api/integrations/github/webhook`)
- **Content Type**: `application/json`
- **Security Requirement**: `X-Hub-Signature-256` header signed with your configured `GITHUB_WEBHOOK_SECRET`.

---

## 2. Security & Signature Verification

FixFlow AI enforces cryptographically verified signatures:
- The raw request body is captured prior to JSON parsing.
- An HMAC SHA-256 digest is generated using `GITHUB_WEBHOOK_SECRET`:
  ```ts
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = `sha256=${hmac.digest('hex')}`;
  crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  ```
- Any unverified payload or mismatched signature is rejected with HTTP `401 Unauthorized`.
- Prevents replay attacks, payload spoofing, and timing attacks.

---

## 3. Supported Events

| Event | Action | FixFlow Response |
|---|---|---|
| `issues` | `opened`, `reopened` | Records issue event in audit log; enables automated triage |
| `pull_request` | `opened`, `synchronize` | Audits PR lifecycle, tracks CI/CD check requirements |
| `push` | branch commit update | Logs commit batch, triggers background repository sync |
| `ping` | webhook test | Responds with `{ status: 'pong', verified: true }` |

---

## 4. Setup in GitHub

1. In your GitHub repository, navigate to **Settings → Webhooks → Add webhook**.
2. Set **Payload URL** to: `https://<your-fixflow-domain>/api/repositories/github/webhook`
3. Set **Content type** to: `application/json`
4. Set **Secret** to: The exact string stored in `GITHUB_WEBHOOK_SECRET` in your backend `.env`.
5. Select **Which events would you like to trigger this webhook?**:
   - `Issues`
   - `Pull requests`
   - `Pushes`
6. Click **Add webhook**. GitHub will dispatch a `ping` event immediately.
>>>>>>> origin/main
