'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, ArrowUpRight, MoreHorizontal, Sparkles, X, Loader2 } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="badge">PROCESSING</span>;
  const styles: Record<string, string> = { APPROVED: 'badge approved', PARTIAL: 'badge partial', REJECTED: 'badge rejected', MANUAL_REVIEW: 'badge review' }
  return <span className={styles[status] || 'badge'}>{status.replace('_', ' ')}</span>
}

function KeyValueDisplay({ data }: { data: any }) {
  if (typeof data !== 'object' || data === null) {
    return <span style={{ color: '#0f172a' }}>{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    return (
      <div style={{ paddingLeft: '12px', margin: '4px 0', borderLeft: '1px solid #cbd5e1' }}>
        {data.map((val, i) => (
          <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <span style={{ color: '#94a3b8', fontSize: '9px', marginTop: '3px' }}>▶</span>
            <div style={{ flex: 1 }}><KeyValueDisplay data={val} /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: '8px', margin: '4px 0' }}>
      {Object.entries(data).map(([key, val]) => {
        const isPrimitive = typeof val !== 'object' || val === null;
        return (
          <div key={key} style={{ marginBottom: '6px', display: isPrimitive ? 'flex' : 'block', gap: '8px', alignItems: 'baseline' }}>
            <strong style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{key}</strong>
            <div style={isPrimitive ? {} : { marginTop: '2px' }}>
              <KeyValueDisplay data={val} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocPayloadBlock({ doc }: { doc: any }) {
  const [view, setView] = useState<'input' | 'output'>('output');

  return (
    <div style={{ display: 'flex', gap: '16px', flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '8px' }}>
      <div style={{ flex: '0 0 160px' }}>
        <a href={doc.url} target="_blank" rel="noreferrer">
          <img src={doc.url} alt="Document Preview" style={{ width: '100%', borderRadius: 4, border: '1px solid #cbd5e1' }} />
        </a>
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button type="button" onClick={() => setView('input')} style={{ padding: '4px 10px', fontWeight: 600, fontSize: 10, borderRadius: 4, background: view === 'input' ? '#334155' : '#e2e8f0', color: view === 'input' ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}>INPUT PAYLOAD</button>
          <button type="button" onClick={() => setView('output')} style={{ padding: '4px 10px', fontWeight: 600, fontSize: 10, borderRadius: 4, background: view === 'output' ? '#1f917b' : '#e2e8f0', color: view === 'output' ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}>OUTPUT RESULT</button>
        </div>
        <div style={{ fontSize: 11, background: '#fff', padding: '12px', borderRadius: 6, border: '1px solid #e2e8f0', flex: 1, overflowY: 'auto' }}>
          <KeyValueDisplay data={view === 'input' ? doc.input : doc.output} />
        </div>
      </div>
    </div>
  );
}

function TracePayloadViewer({ item }: { item: any }) {
  const [view, setView] = useState<'input' | 'output'>('output');
  let docs: any[] = [];
  let globalOutput: any = null;

  if (item.agentName === 'DOCUMENT_VERIFIER' && item.input?.submittedDocuments) {
    docs = item.input.submittedDocuments.map((inDoc: any, i: number) => ({
      url: inDoc.url,
      input: inDoc,
      output: item.output?.analyzedDocs?.[i] || null
    }));
    globalOutput = { isAccepted: item.output?.isAccepted, reasoning: item.output?.reasoning };
  } else if (item.agentName === 'DOCUMENT_PARSER' && item.input?.url) {
    docs = [{
      url: item.input.url,
      input: item.input,
      output: item.output
    }];
  } else {
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button type="button" onClick={() => setView('input')} style={{ padding: '4px 10px', fontWeight: 600, fontSize: 10, borderRadius: 4, background: view === 'input' ? '#334155' : '#e2e8f0', color: view === 'input' ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}>INPUT PAYLOAD</button>
          <button type="button" onClick={() => setView('output')} style={{ padding: '4px 10px', fontWeight: 600, fontSize: 10, borderRadius: 4, background: view === 'output' ? '#1f917b' : '#e2e8f0', color: view === 'output' ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}>OUTPUT RESULT</button>
        </div>
        <div style={{ fontSize: 11, background: '#fff', padding: '12px', borderRadius: 6, border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <KeyValueDisplay data={view === 'input' ? item.input : item.output} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
      {docs.map((doc, i) => <DocPayloadBlock key={i} doc={doc} />)}
      {globalOutput && (
        <div style={{ padding: '8px 12px', background: globalOutput.isAccepted ? '#ecfdf5' : '#fef2f2', borderRadius: 4, color: globalOutput.isAccepted ? '#065f46' : '#991b1b', border: `1px solid ${globalOutput.isAccepted ? '#a7f3d0' : '#fecaca'}` }}>
          <strong>Final Verdict:</strong> {globalOutput.reasoning}<br />
          <strong>Accepted:</strong> {globalOutput.isAccepted ? 'True' : 'False'}
        </div>
      )}
    </div>
  );
}

function TraceModal({ claimId, close }: { claimId: string; close: () => void }) {
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/evals/${claimId}/traces`).then(r => r.json()).then(data => {
      setTraces(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [claimId]);

  return <div className="modal-backdrop" onClick={close}>
    <div className="trace-modal" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <div><p className="eyebrow">LIVE AUDIT TRAIL</p><h2>Processing trace</h2><p>Every internal LLM and code step captured for explainable review.</p></div>
        <button className="icon-button" onClick={close}><X /></button>
      </div>
      <div className="trace-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: 'auto' }} /></div> : traces.map((item, index) => {
          return <div className="trace-item" key={item.id}><div className="trace-line"><div className="trace-icon"><Sparkles /></div>{index < traces.length - 1 && <i />}</div><div className="trace-copy"><div><strong>{item.agentName} (Step {item.stepOrder})</strong><time>{new Date(item.createdAt).toLocaleTimeString()}</time></div>
            <p style={{ fontSize: 12, opacity: 0.8 }}>{item.status === 'PASS' ? 'Passed Checks' : item.status === 'FAIL' ? 'Failed Checks' : 'Running'} {item.confidenceScore ? ` · Confidence: ${(item.confidenceScore * 100).toFixed(1)}%` : ''}</p>
            {item.checks?.length > 0 && <ul style={{ fontSize: 11, background: '#f8fafc', padding: '8px 12px', borderRadius: 4, marginTop: 8 }}>
              {item.checks.map((c: any, i: number) => <li key={i} style={{ marginBottom: 2 }}>{c.passed ? '✅' : '❌'} {c.check}: {c.reason}</li>)}
            </ul>}
            {(item.input || item.output) && (
              <details style={{ marginTop: 8, fontSize: 11, background: '#f1f5f9', padding: '8px 12px', borderRadius: 4, cursor: 'pointer' }}>
                <summary style={{ fontWeight: 600, color: '#334155' }}>View I/O Payloads (Debug)</summary>
                <TracePayloadViewer item={item} />
              </details>
            )}
            <span className="trace-status" style={{ color: item.status === 'PASS' ? '#1f917b' : '#c55c5c' }}>{item.status}</span></div></div>
        })}
        {!loading && traces.length === 0 && <p style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>No traces found yet. Processing...</p>}
      </div>
    </div>
  </div>
}

export default function EvalsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [traceClaimId, setTraceClaimId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/evals')
      .then(r => r.json())
      .then(data => {
        setClaims(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch claims', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-shell" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px' }}>
        <header className="topbar" style={{ background: 'transparent', borderBottom: 'none', padding: '0 0 24px 0', marginBottom: 0 }}>
          <div>
            <div className="crumb">Demo <span>/</span> Evaluations</div>
            <h1>Test Cases</h1>
          </div>
        </header>

        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="main-grid" style={{ flex: 1, minHeight: 0 }}>
            <section className="panel claims-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* <div className="panel-heading">
                <div>
                  <h2>All claims</h2>
                  <p>Demo test cases ordered by creation date (Click a claim to view its trace)</p>
                </div>
              </div>
              <div className="table-tools">
                <div className="search-field">
                  <Search />
                  <input placeholder="Search claims" />
                </div>
                <button className="filter-button"><Filter /> Filter</button>
              </div> */}

              <div className="claims-table" style={{ flex: 1, overflowY: 'auto' }}>
                <div className="table-row table-head">
                  <span>Claim ID</span>
                  <span>Member</span>
                  <span>Type</span>
                  <span>Amount</span>
                  <span>Decision</span>
                  <span />
                </div>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <Loader2 className="animate-spin" style={{ margin: 'auto' }} />
                  </div>
                ) : claims.length === 0 ? (
                  <p style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>No claims found.</p>
                ) : (
                  claims.map((claim, index) => {
                    const isSecondToLast = index === claims.length - 2;
                    let tcNumber = String(index + 1).padStart(3, '0');
                    if (index === claims.length - 1) {
                      tcNumber = '012';
                    } else if (index === claims.length - 2) {
                      tcNumber = '010';
                    }

                    return (
                      <div key={claim.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <button
                          className="table-row claim-row"
                          onClick={() => setTraceClaimId(claim.id)}
                          style={{ width: '100%' }}
                        >
                          <span className="claim-id" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: '#475569' }}>
                              TC{tcNumber}
                            </span>
                            {claim.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="member-cell"><span>{claim.employeeId}</span></span>
                          <span className="muted-cell">{claim.claimCategory}</span>
                          <span className="amount">₹{claim.claimedAmount}</span>
                          <span><StatusBadge status={claim.decision || claim.status} /></span>
                          <MoreHorizontal className="row-more" />
                        </button>
                        {isSecondToLast && (
                          <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#991b1b', fontSize: 13, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong>Note:</strong> This test case cannot be passed as the current flow does not allow graceful degradation.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {traceClaimId && <TraceModal claimId={traceClaimId} close={() => setTraceClaimId(null)} />}
    </div>
  );
}
