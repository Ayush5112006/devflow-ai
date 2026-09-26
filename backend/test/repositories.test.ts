import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repositoryService } from '../src/services/repositoryService.js';
import { webhookService } from '../src/services/webhookService.js';
import { githubService } from '../src/services/githubService.js';
import { config } from '../src/config.js';
import { isGitRepository, getGitInfo, getGitBranches, getGitCommits } from '../src/utils/git.js';

describe('RepositoryService & Git Operations', () => {
  it('detects and lists default repositories', () => {
    const repos = repositoryService.listRepositories();
    assert.ok(repos.length >= 1, 'Should list at least 1 repository');
    const demo = repos.find((r) => r.id === 'insightboard');
    assert.ok(demo, 'Demo insightboard repository must be registered');
    assert.equal(demo.provider, 'demo');
  });

  it('detects if the FixFlow AI root is a valid git repository', async () => {
    const isGit = await isGitRepository(config.repoRoot);
    assert.equal(isGit, true, 'FixFlow AI root directory should be detected as a Git repository');
  });

  it('retrieves git information for the repository root', async () => {
    const info = await getGitInfo(config.repoRoot);
    assert.equal(info.available, true);
    assert.ok(info.branch, 'Branch must be present');
    assert.ok(info.latestCommit, 'Commit hash must be present');
    assert.ok(Array.isArray(info.modifiedFiles));
  });

  it('lists git branches in workspace', async () => {
    const branches = await getGitBranches(config.repoRoot);
    assert.ok(Array.isArray(branches));
    assert.ok(branches.length > 0, 'Should return at least one branch');
    const current = branches.find((b) => b.isCurrent);
    assert.ok(current, 'A current branch must be flagged');
  });

  it('lists git commits in workspace', async () => {
    const commits = await getGitCommits(config.repoRoot, 5);
    assert.ok(Array.isArray(commits));
    assert.ok(commits.length > 0, 'Should return recent commits');
    assert.ok(commits[0].hash);
    assert.ok(commits[0].message);
  });

  it('retrieves issues for a repository', async () => {
    const issues = await repositoryService.getIssues('insightboard');
    assert.ok(Array.isArray(issues));
    assert.equal(issues.length, 3, 'InsightBoard should have 3 demo issues');
    assert.equal(issues[0].source, 'demo');
  });

  it('allows creating a new repository issue', async () => {
    const issue = await repositoryService.createIssue('insightboard', {
      title: 'Test issue for automated investigation',
      description: 'Test failure description',
      severity: 'high',
      labels: ['test', 'auto'],
    });
    assert.ok(issue.id);
    assert.equal(issue.title, 'Test issue for automated investigation');
    assert.equal(issue.state, 'open');

    const issues = await repositoryService.getIssues('insightboard');
    assert.ok(issues.some((i) => i.id === issue.id));
  });

  it('creates and lists pull requests', async () => {
    const prs = await repositoryService.getPullRequests('insightboard');
    assert.ok(Array.isArray(prs));
    assert.ok(prs.length >= 1);

    const newPR = await repositoryService.createPullRequest('insightboard', {
      title: 'feat: automated bug resolution patch',
      description: 'Addresses defect via FixFlow AI',
      sourceBranch: 'fix/fixflow-test',
      targetBranch: 'main',
    });
    assert.ok(newPR.id);
    assert.equal(newPR.sourceBranch, 'fix/fixflow-test');
  });
});

describe('WebhookService & Signature Verification', () => {
  it('returns valid webhook settings', () => {
    const settings = webhookService.getSettings();
    assert.ok(settings.webhookUrl.includes('/api/integrations/github/webhook'));
    assert.ok(Array.isArray(settings.supportedEvents));
    assert.ok(settings.supportedEvents.includes('issues'));
    assert.ok(settings.supportedEvents.includes('pull_request'));
  });

  it('rejects unverified webhooks without signature', () => {
    const valid = webhookService.verifySignature('{}', undefined);
    assert.equal(valid, false, 'Webhook without signature must be rejected');
  });

  it('records webhook events in audit history', () => {
    const record = webhookService.recordEvent('issues', { action: 'opened', repository: { full_name: 'test/repo' } }, 'processed', 'Issue opened');
    assert.ok(record.id);
    assert.equal(record.eventType, 'issues');
    assert.equal(record.status, 'processed');

    const events = webhookService.getEvents();
    assert.ok(events.some((e) => e.id === record.id));
  });
});

describe('GitHubService Auth Check', () => {
  it('returns accurate unconfigured status when GITHUB_TOKEN is not configured', async () => {
    // If GITHUB_TOKEN is not set or empty, reports clean instructions and never fakes connection
    const status = await githubService.verifyAuth();
    if (!config.githubToken) {
      assert.equal(status.configured, false);
      assert.equal(status.authenticated, false);
      assert.ok(status.setupInstructions && status.setupInstructions.length > 0);
    } else {
      assert.equal(status.configured, true);
    }
  });
});
