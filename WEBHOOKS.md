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
