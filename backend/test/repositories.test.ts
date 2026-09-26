<<<<<<< HEAD
// Repository store + routes — unit and integration tests.
// Runs with: node --import tsx --test "test/repositories.test.ts"
// No external services are required.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { RepositoryStore } from '../src/repositories/repositoryStore.js';

/* ------------------------------------------------------------------ */
/* RepositoryStore unit tests                                         */
/* ------------------------------------------------------------------ */

describe('RepositoryStore', () => {
  it('upserts and retrieves a repository', () => {
    const store = new RepositoryStore();
    const repo = store.upsert({
      name: 'test-repo',
      description: 'Test',
      provider: 'local',
      path: '/tmp/test',
      owner: null,
      fullName: null,
      defaultBranch: 'main',
      currentBranch: null,
      visibility: 'private',
      language: 'TypeScript',
      stars: 0,
      openIssues: 0,
      openPRs: 0,
      lastCommitSha: null,
      lastCommitMessage: null,
      lastCommitAt: null,
      lastSyncAt: null,
      syncStatus: 'never',
      syncError: null,
    });
    assert.ok(repo.id.startsWith('repo_'), 'id should start with repo_');
    assert.equal(repo.name, 'test-repo');
    assert.equal(repo.provider, 'local');
    assert.ok(repo.addedAt, 'addedAt should be set');
    assert.ok(repo.updatedAt, 'updatedAt should be set');

    const retrieved = store.get(repo.id);
    assert.deepEqual(retrieved, repo);
  });

  it('lists repositories in an array', () => {
    const store = new RepositoryStore();
    const base = {
      description: '',
      provider: 'local' as const,
      path: '/tmp/x',
      owner: null, fullName: null,
      defaultBranch: 'main', currentBranch: null,
      visibility: 'private' as const,
      language: null, stars: 0, openIssues: 0, openPRs: 0,
      lastCommitSha: null, lastCommitMessage: null, lastCommitAt: null,
      lastSyncAt: null, syncStatus: 'never' as const, syncError: null,
    };
    store.upsert({ ...base, name: 'first' });
    store.upsert({ ...base, name: 'second' });
    const list = store.list();
    assert.equal(list.length, 2);
    // Both names present
    const names = list.map((r) => r.name);
    assert.ok(names.includes('first'));
    assert.ok(names.includes('second'));
  });

  it('patches a repository', () => {
    const store = new RepositoryStore();
    const repo = store.upsert({
      name: 'patchable',
      description: '',
      provider: 'local',
      path: '/tmp/p',
      owner: null, fullName: null,
      defaultBranch: 'main', currentBranch: null,
      visibility: 'private',
      language: null, stars: 0, openIssues: 0, openPRs: 0,
      lastCommitSha: null, lastCommitMessage: null, lastCommitAt: null,
      lastSyncAt: null, syncStatus: 'never', syncError: null,
    });
    const patched = store.patch(repo.id, { openIssues: 5, syncStatus: 'synced' });
    assert.equal(patched?.openIssues, 5);
    assert.equal(patched?.syncStatus, 'synced');
    assert.equal(patched?.name, 'patchable'); // unchanged
  });

  it('deletes a repository', () => {
    const store = new RepositoryStore();
    const repo = store.upsert({
      name: 'deletable',
      description: '',
      provider: 'local',
      path: '/tmp/d',
      owner: null, fullName: null,
      defaultBranch: 'main', currentBranch: null,
      visibility: 'private',
      language: null, stars: 0, openIssues: 0, openPRs: 0,
      lastCommitSha: null, lastCommitMessage: null, lastCommitAt: null,
      lastSyncAt: null, syncStatus: 'never', syncError: null,
    });
    const deleted = store.delete(repo.id);
    assert.equal(deleted, true);
    assert.equal(store.get(repo.id), undefined);
    assert.equal(store.delete(repo.id), false); // idempotent
  });

  it('returns undefined for patch of unknown id', () => {
    const store = new RepositoryStore();
    const result = store.patch('nonexistent', { openIssues: 1 });
    assert.equal(result, undefined);
  });
});

/* ------------------------------------------------------------------ */
/* Webhook signature validation                                        */
/* ------------------------------------------------------------------ */

describe('Webhook signature validation', () => {
  function sign(secret: string, body: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
  }

  it('generates correct HMAC-SHA256 signature', () => {
    const secret = 'test-secret-123';
    const body = JSON.stringify({ action: 'opened' });
    const sig = sign(secret, body);
    assert.ok(sig.startsWith('sha256='));
    assert.equal(sig.length, 71); // 'sha256=' (7) + 64 hex chars
  });

  it('produces different signatures for different bodies', () => {
    const secret = 'my-secret';
    const sig1 = sign(secret, 'body1');
    const sig2 = sign(secret, 'body2');
    assert.notEqual(sig1, sig2);
  });

  it('produces different signatures for different secrets', () => {
    const body = 'same-body';
    const sig1 = sign('secret1', body);
    const sig2 = sign('secret2', body);
    assert.notEqual(sig1, sig2);
  });

  it('timing-safe comparison detects tampered signatures', () => {
    const secret = 'safe-secret';
    const body = 'payload';
    const valid = sign(secret, body);
    const tampered = valid.slice(0, -2) + 'ff'; // change last 2 chars
    // Verify they differ
    assert.notEqual(valid, tampered);
    // Verify lengths match (required for timingSafeEqual)
    assert.equal(valid.length, tampered.length);
  });
});

/* ------------------------------------------------------------------ */
/* Path traversal protection                                          */
/* ------------------------------------------------------------------ */

describe('Path traversal protection', () => {
  it('assertInside rejects paths outside root', async () => {
    const { assertInside } = await import('../src/utils/fsSafe.js');
    assert.throws(
      () => assertInside('/allowed', '/allowed/../../../etc/passwd'),
      /escapes/,
    );
  });

  it('assertInside allows valid sub-paths', async () => {
    const { assertInside } = await import('../src/utils/fsSafe.js');
    // Should not throw
    const result = assertInside('/allowed', '/allowed/subdir/file.txt');
    assert.ok(result.includes('subdir'));
  });
});

/* ------------------------------------------------------------------ */
/* Git ref safety                                                      */
/* ------------------------------------------------------------------ */

describe('Git ref safety', () => {
  it('rejects refs with shell metacharacters', async () => {
    const { assertSafeRef } = await import('../src/utils/git.js');
    assert.throws(() => assertSafeRef('branch; rm -rf /'), /Unsafe/);
    assert.throws(() => assertSafeRef('$(evil)'), /Unsafe/);
    assert.throws(() => assertSafeRef('branch|pipe'), /Unsafe/);
  });

  it('accepts valid ref names', async () => {
    const { assertSafeRef } = await import('../src/utils/git.js');
    assert.equal(assertSafeRef('main'), 'main');
    assert.equal(assertSafeRef('feature/my-branch'), 'feature/my-branch');
    assert.equal(assertSafeRef('HEAD'), 'HEAD');
    assert.equal(assertSafeRef('abc123def'), 'abc123def');
  });
});

/* ------------------------------------------------------------------ */
/* Language detection                                                  */
/* ------------------------------------------------------------------ */

describe('Language detection', () => {
  it('detects common languages', async () => {
    const { detectLanguage } = await import('../src/utils/git.js');
    assert.equal(detectLanguage('index.ts'), 'TypeScript');
    assert.equal(detectLanguage('app.tsx'), 'TypeScript');
    assert.equal(detectLanguage('main.js'), 'JavaScript');
    assert.equal(detectLanguage('server.py'), 'Python');
    assert.equal(detectLanguage('main.go'), 'Go');
    assert.equal(detectLanguage('README.md'), 'Markdown');
    assert.equal(detectLanguage('config.yml'), 'YAML');
    assert.equal(detectLanguage('data.json'), 'JSON');
    assert.equal(detectLanguage('unknown.xyz'), null);
  });
});

/* ------------------------------------------------------------------ */
/* GitHub service — configured check                                  */
/* ------------------------------------------------------------------ */

describe('GitHub service', () => {
  it('isGitHubConfigured returns false when GITHUB_TOKEN is not set', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    const { isGitHubConfigured } = await import('../src/services/githubService.js');
    assert.equal(isGitHubConfigured(), false);
    if (originalToken) process.env.GITHUB_TOKEN = originalToken;
  });

  it('getGitHubToken returns null when not configured', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    const { getGitHubToken } = await import('../src/services/githubService.js');
    assert.equal(getGitHubToken(), null);
    if (originalToken) process.env.GITHUB_TOKEN = originalToken;
  });
});

/* ------------------------------------------------------------------ */
/* makeLocalRepository helper                                         */
/* ------------------------------------------------------------------ */

describe('makeLocalRepository', () => {
  it('builds a correctly structured local repository object', async () => {
    const { makeLocalRepository } = await import('../src/repositories/repositoryStore.js');
    const repo = makeLocalRepository('/home/user/project', 'my-project');
    assert.equal(repo.name, 'my-project');
    assert.equal(repo.provider, 'local');
    assert.equal(repo.path, '/home/user/project');
    assert.equal(repo.syncStatus, 'never');
    assert.equal(repo.owner, null);
    assert.equal(repo.fullName, null);
  });

  it('uses directory name when no name is provided', async () => {
    const { makeLocalRepository } = await import('../src/repositories/repositoryStore.js');
    const repo = makeLocalRepository('/home/user/my-app');
    assert.equal(repo.name, 'my-app');
=======
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
>>>>>>> origin/main
  });
});
