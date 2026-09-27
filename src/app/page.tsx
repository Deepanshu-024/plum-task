'use client'

import { useState, useEffect } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { AlertTriangle, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, ClipboardCheck, Clock3, FileCheck2, FileText, Filter, Headphones, LayoutDashboard, MoreHorizontal, Paperclip, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, Upload, UserRound, UsersRound, X, Loader2 } from 'lucide-react'
import policy from '../../policy_terms.json'
import { NewClaim } from '@/components/NewClaim'

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="badge">PROCESSING</span>;
  const styles: Record<string, string> = { APPROVED: 'badge approved', PARTIAL: 'badge partial', REJECTED: 'badge rejected', MANUAL_REVIEW: 'badge review' }
  return <span className={styles[status] || 'badge'}>{status.replace('_', ' ')}</span>
}

function Sidebar({ active, setActive }: { active: string; setActive: (v: string) => void }) {
  const items = [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Claims inbox', icon: FileText, count: '24' },
    { label: 'Evaluation', icon: ClipboardCheck }, { label: 'Policy rules', icon: ShieldCheck },
  ]
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">P</div><span>plum<span className="brand-dot">.</span></span></div>
    <div className="workspace-label">WORKSPACE</div>
    <nav>{items.map(({ label, icon: Icon, count }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label)}><Icon />{label}{count && <span className="nav-count">{count}</span>}</button>)}</nav>
    <div className="sidebar-bottom"><button className="nav-item"><Settings2 />Settings</button><button className="nav-item"><CircleHelp />Help center</button></div>
  </aside>
}

function Header({ active }: { active: string }) { 
  const { user } = useUser();
  const userName = user?.firstName || user?.fullName || "Ananya";
  const [greeting, setGreeting] = useState('Good morning');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return <header className="topbar"><div><div className="crumb">Operations <span>/</span> {active}</div><h1>{active === 'Overview' ? `${greeting}, ${userName}` : active}</h1></div><div className="top-actions"><button className="icon-button"><Search /></button><button className="icon-button notification"><Bell /><i /></button><div className="divider" /><button className="policy-pill"><span className="live-dot" /> Policy: Standard Plan <ChevronDown /></button><div style={{ marginLeft: 8, display: 'flex' }}><UserButton /></div></div></header> 
}

function StatCard({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: any; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon /></div><div><p>{label}</p><strong>{value}</strong><small>{sub}</small></div><ArrowUpRight className="stat-arrow" /></div> }

function Overview({ onNewClaim }: { onNewClaim: () => void }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    fetch('/api/claims').then(r => r.json()).then(data => {
      setClaims(data);
      if (data.length > 0) setSelected(data[0]);
    });
    setCurrentDate(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  return <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 94px)' }}>
    <div className="overview-actions"><div><p className="eyebrow">{currentDate}</p><p className="muted">Here&apos;s what&apos;s happening across your claims workspace.</p></div><button className="primary-button" onClick={onNewClaim}><Plus /> New claim</button></div>
    <div className="main-grid" style={{ flex: 1, minHeight: 0 }}><section className="panel claims-panel" style={{ display: 'flex', flexDirection: 'column' }}><div className="panel-heading"><div><h2>Recent claims</h2><p>Latest activity from your workspace</p></div><button className="text-button">View all <ArrowUpRight /></button></div><div className="table-tools"><div className="search-field"><Search /><input placeholder="Search claims" /></div><button className="filter-button"><Filter /> Filter</button></div><div className="claims-table" style={{ flex: 1, overflowY: 'auto' }}><div className="table-row table-head"><span>Claim ID</span><span>Member</span><span>Type</span><span>Amount</span><span>Decision</span><span /></div>
      {claims.map(claim => <button className={`table-row claim-row ${selected?.id === claim.id ? 'selected' : ''}`} key={claim.id} onClick={() => setSelected(claim)}><span className="claim-id">{claim.id.slice(0, 8).toUpperCase()}</span><span className="member-cell"><span>{claim.employeeId}</span></span><span className="muted-cell">{claim.claimCategory}</span><span className="amount">₹{claim.claimedAmount}</span><span><StatusBadge status={claim.decision || claim.status} /></span><MoreHorizontal className="row-more" /></button>)}
    </div></section>{selected && <DecisionPanel claim={selected} />}</div>
  </div>
}

function DecisionPanel({ claim }: { claim: any }) { return <section className="panel decision-panel" style={{ alignSelf: 'start' }}><div className="panel-heading"><div><h2>Decision preview</h2><p>{claim.id.slice(0, 8).toUpperCase()} · selected claim</p></div><button className="icon-button"><MoreHorizontal /></button></div><div className="decision-hero"><div><span className="decision-label">FINAL DECISION</span><h3><StatusBadge status={claim.decision || claim.status} /></h3></div><div className="approved-amount"><span>Claimed amount</span><strong>₹{claim.claimedAmount}</strong></div></div><div className="reason"><strong>Why this decision?</strong><p>{claim.decisionSummary || "Claim is currently processing. View trace for live updates."}</p></div><button className="outline-button full" onClick={() => window.dispatchEvent(new CustomEvent('show-trace', { detail: { claimId: claim.id } }))}>View live processing trace <ArrowUpRight /></button></section> }

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
    fetch(`/api/claims/${claimId}/traces`).then(r => r.json()).then(data => {
      setTraces(data);
      setLoading(false);
    });
  }, [claimId]);

  return <div className="modal-backdrop">
    <div className="trace-modal" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
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
      <div className="trace-footer" style={{ marginTop: 'auto' }}><span><ShieldCheck /> Immutable audit record</span></div>
    </div>
  </div>
}

export default function Page() {
  const [active, setActive] = useState('Overview');
  const [newClaim, setNewClaim] = useState(false);
  const [traceClaimId, setTraceClaimId] = useState<string | null>(null);

  useEffect(() => {
    const handleTrace = (e: any) => setTraceClaimId(e.detail?.claimId);
    window.addEventListener('show-trace', handleTrace);
    return () => window.removeEventListener('show-trace', handleTrace);
  }, []);

  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-area"><Header active={active} />{active === 'Overview' && <Overview onNewClaim={() => setNewClaim(true)} />}{active === 'Claims inbox' && <Overview onNewClaim={() => setNewClaim(true)} />}{active === 'Policy rules' && <PolicyView />}</main>{newClaim && <NewClaim close={() => setNewClaim(false)} />}{traceClaimId && <TraceModal claimId={traceClaimId} close={() => setTraceClaimId(null)} />}</div>
}

function PolicyView() { return <div className="page-content"><div className="overview-actions"><div><p className="eyebrow">POLICY CONFIGURATION</p><h2 className="page-title">{policy.policy_name}</h2><p className="muted">{policy.insurer} · {policy.policy_id}</p></div><button className="outline-button"><Settings2 /> Edit policy</button></div><div className="policy-grid"><div className="panel policy-overview"><h2>Coverage overview</h2><div className="policy-number"><span>Sum insured per employee</span><strong>₹5,00,000</strong></div><div className="policy-number"><span>Annual OPD limit</span><strong>₹50,000</strong></div><div className="policy-number"><span>Family floater</span><strong>₹1,50,000</strong></div></div><div className="panel policy-overview"><h2>Plan status</h2><div className="plan-status"><span className="live-dot" /> Active</div><p>Policy period</p><strong>01 Apr 2024 — 31 Mar 2025</strong><p className="muted">{policy.policy_holder.company_name} · {policy.policy_holder.employee_count} employees</p></div></div><section className="panel"><div className="panel-heading"><div><h2>OPD categories</h2><p>Rules applied during automated evaluation</p></div></div><div className="category-grid">{Object.entries(policy.opd_categories).map(([key, value]: [string, any]) => <div className="category-card" key={key}><div className="category-top"><strong>{key.replace('_', ' ')}</strong><span className="badge approved">Covered</span></div><div><span>Sub-limit</span><strong>₹{value.sub_limit.toLocaleString('en-IN')}</strong></div><div><span>Co-pay</span><strong>{value.copay_percent}%</strong></div><div><span>Prescription</span><strong>{value.requires_prescription ? 'Required' : 'Not required'}</strong></div></div>)}</div></section></div> }
