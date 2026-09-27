/**
 * GitHub Webhook Service
 * 
 * Verifies HMAC-SHA256 signatures, logs incoming events,
 * and maintains webhook event history.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { id as makeId } from '../utils/id.js';
import { nowIso } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('webhook-service');

export interface WebhookEventRecord {
  id: string;
  eventType: string;
  action?: string;
  repository?: string;
  sender?: string;
  receivedAt: string;
  status: 'processed' | 'ignored' | 'failed';
  summary: string;
  payloadExcerpt: Record<string, unknown>;
}

export interface WebhookSettings {
  enabled: boolean;
  hasSecret: boolean;
  webhookUrl: string;
  lastEventAt: string | null;
  totalEventsReceived: number;
  lastSuccessfulDelivery: string | null;
  lastFailedDelivery: string | null;
  supportedEvents: string[];
}

export class WebhookService {
  private events: WebhookEventRecord[] = [];
  private lastSuccess: string | null = null;
  private lastFailure: string | null = null;

  /**
   * Cryptographically verifies the GitHub HMAC SHA-256 signature.
   */
  verifySignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!config.githubWebhookSecret) {
      // If secret is not configured in backend, warn and refuse webhook
      log.warn('Webhook secret is not configured in GITHUB_WEBHOOK_SECRET');
      return false;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = signatureHeader.slice('sha256='.length);
    const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
    hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
    const calculatedSignature = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Process a verified webhook event payload.
   */
  recordEvent(
    eventType: string,
    payload: any,
    status: 'processed' | 'ignored' | 'failed',
    summary: string
  ): WebhookEventRecord {
    const record: WebhookEventRecord = {
      id: makeId('wh'),
      eventType,
      action: payload.action,
      repository: payload.repository?.full_name,
      sender: payload.sender?.login,
      receivedAt: nowIso(),
      status,
      summary,
      payloadExcerpt: {
        action: payload.action,
        repo: payload.repository?.full_name,
        sender: payload.sender?.login,
        issueNumber: payload.issue?.number,
        pullRequestNumber: payload.pull_request?.number,
        ref: payload.ref,
      },
    };

    this.events.unshift(record);
    if (this.events.length > 100) this.events.length = 100;

    if (status === 'processed') {
      this.lastSuccess = record.receivedAt;
    } else if (status === 'failed') {
      this.lastFailure = record.receivedAt;
    }

    log.info(`Recorded webhook ${eventType} (${status}): ${summary}`);
    return record;
  }

  getEvents(limit = 30): WebhookEventRecord[] {
    return this.events.slice(0, limit);
  }

  getSettings(): WebhookSettings {
    return {
      enabled: config.githubWebhookSecret.length > 0,
      hasSecret: config.githubWebhookSecret.length > 0,
      webhookUrl: `/api/integrations/github/webhook`,
      lastEventAt: this.events[0]?.receivedAt ?? null,
      totalEventsReceived: this.events.length,
      lastSuccessfulDelivery: this.lastSuccess,
      lastFailedDelivery: this.lastFailure,
      supportedEvents: ['issues', 'pull_request', 'push', 'ping'],
    };
  }
}

export const webhookService = new WebhookService();
