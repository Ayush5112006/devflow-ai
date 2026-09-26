import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import type { GitInfo } from '../services/api.js';
import { Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export function RepositoriesPage() {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);

  useEffect(() => {
    // Load from the most recent investigation's git info, or first available
    api.listInvestigations()
      .then(({ investigations: invs }) => {
        setInvestigations(invs);
        const first = invs[0];
        if (first && first.id) {
          return api.git(first.id as string).then(({ git }) => {
            setGitInfo(git);
            setLoading(false);
          });
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner message="Loading repository data…" />;

  return (
    <div className="page-content stack" style={{ gap: 24 }}>
      {/* Header */}
      <div className="spread">
        <div>
          <h1 className="page-title">Repositories</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
            Repository overview, branch health, and git history from the investigation workspace.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="demo-notice">LOCAL GIT</span>
          <button className="btn btn-sm" disabled title="Coming Soon">
            Connect GitHub →
          </button>
        </div>
      </div>

      {error && (
        <div className="alert" role="alert">{error}</div>
      )}

      {/* Git info — LIVE */}
      {gitInfo && gitInfo.available ? (
        <>
          <section>
            <div className="section-heading">
              <h2>Current Repository</h2>
              <Badge variant="success" dot>Live git data</Badge>
            </div>
            <div className="card-grid-2">
              <Card title="Branch Status">
                <dl className="kv" style={{ rowGap: 10 }}>
                  <dt>Active branch</dt>
                  <dd>
                    <span className="chip mono" style={{ fontSize: 11 }}>
                      {gitInfo.branch ?? 'detached HEAD'}
                    </span>
                  </dd>
                  <dt>Latest commit</dt>
                  <dd className="mono" style={{ fontSize: 11, color: 'var(--accent-text)' }}>
                    {gitInfo.latestCommit?.slice(0, 8) ?? '—'}
                  </dd>
                  <dt>Commit message</dt>
                  <dd style={{ fontSize: 12, color: 'var(--ink)' }}>{gitInfo.latestMessage ?? '—'}</dd>
                  <dt>Author</dt>
                  <dd>{gitInfo.latestAuthor ?? '—'}</dd>
                  <dt>Date</dt>
                  <dd style={{ fontSize: 12 }}>{gitInfo.latestDate ? new Date(gitInfo.latestDate).toLocaleString() : '—'}</dd>
                  {gitInfo.suggestedBranch && (
                    <>
                      <dt>Suggested fix branch</dt>
                      <dd><span className="chip mono" style={{ fontSize: 10, color: 'var(--accent-text)' }}>{gitInfo.suggestedBranch}</span></dd>
                    </>
                  )}
                </dl>
              </Card>
              <Card title="Modified Files">
                {gitInfo.modifiedFiles.length > 0 ? (
                  <div className="stack" style={{ gap: 4 }}>
                    {gitInfo.modifiedFiles.map((f, i) => (
                      <div key={i} className="row" style={{ gap: 8, padding: '5px 8px', background: 'var(--panel-sunken)', borderRadius: 6, border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--mono)', flex: 'none' }}>M</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--ink)', flex: 1 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--subtle)', margin: 0 }}>
                    No modified files — working tree clean.
                  </p>
                )}
              </Card>
            </div>
          </section>

          {/* Recent commits */}
          {gitInfo.recentCommits.length > 0 && (
            <section>
              <div className="section-heading">
                <h2>Recent Commits</h2>
                <p>From investigation workspace</p>
              </div>
              <Card flush>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hash</th>
                      <th>Message</th>
                      <th>Author</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gitInfo.recentCommits.map((c) => (
                      <tr key={c.hash}>
                        <td>
                          <span className="chip mono" style={{ fontSize: 10 }}>{c.hash.slice(0, 8)}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--ink)', maxWidth: 320 }}>{c.message}</td>
                        <td style={{ fontSize: 12 }}>{c.author}</td>
                        <td style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--subtle)' }}>
                          {new Date(c.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          )}
        </>
      ) : !error ? (
        <div className="banner banner-info">
          <div>
            <p className="banner-title" style={{ color: 'var(--info)' }}>No git data available yet</p>
            <p className="banner-text">
              Git information is loaded from investigation workspaces. Run an investigation to see real repository data here.
            </p>
          </div>
          <Link to="/investigations" className="btn btn-sm btn-primary" style={{ flex: 'none' }}>
            Start investigation →
          </Link>
        </div>
      ) : null}

      {/* Linked investigations */}
      {investigations.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Investigation History</h2>
            <p>Investigations tied to this repository</p>
          </div>
          <Card flush>
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Title</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {investigations.slice(0, 8).map((inv: any) => (
                  <tr key={inv.id}>
                    <td><span className="chip mono" style={{ fontSize: 10 }}>{inv.id?.slice(0, 8)}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--ink)' }}>{inv.bug?.title}</td>
                    <td>
                      <Badge
                        variant={inv.status === 'completed' ? 'success' : inv.status === 'failed' ? 'danger' : 'info'}
                        dot
                      >
                        {inv.status?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td>
                      <Link to={`/investigations/${inv.id}`} className="btn btn-xs">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* GitHub Coming Soon */}
      <section>
        <div className="section-heading">
          <h2>GitHub Integration</h2>
          <span className="badge badge-coming">Coming Soon</span>
        </div>
        <div className="card-grid-2">
          {[
            { title: 'Repository sync', desc: 'Connect your GitHub repositories for automatic issue ingestion, PR creation, and branch management.' },
            { title: 'Pull request automation', desc: 'FixFlow automatically opens PRs with root cause analysis, change summary, test results, and regression report.' },
            { title: 'Issue tracker integration', desc: 'Sync GitHub Issues with FixFlow investigations. Auto-close issues when fixes are verified.' },
            { title: 'Webhook triggers', desc: 'Auto-trigger investigations when new issues are labelled or errors spike in production.' },
          ].map((item) => (
            <div key={item.title} className="panel" style={{ padding: '14px 16px', borderStyle: 'dashed' }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.title}</p>
                <span className="badge badge-coming">Coming Soon</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Link to="/integrations" className="btn btn-sm">Configure integrations →</Link>
        </div>
      </section>
    </div>
  );
}
