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
