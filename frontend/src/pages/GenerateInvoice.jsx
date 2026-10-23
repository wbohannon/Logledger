import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function GoalProgress({ progress, rate }) {
  const reached = progress.remainingAmount <= 0;
  const since = progress.periodStart
    ? `since last invoice sent ${new Date(progress.periodStart).toLocaleDateString()}`
    : 'no invoice sent yet';
  return (
    <div style={{ margin: '1rem 0', padding: '0.85rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '0.5rem' }}>
        <span>Goal progress</span>
        <span>{money(progress.amount)} / {money(progress.goal)} · {progress.percent}%</span>
      </div>
      <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, progress.percent)}%`, height: '100%', background: reached ? '#16a34a' : 'var(--accent)' }} />
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
        {reached
          ? 'Goal reached for this billing period.'
          : <>
              <strong>{progress.remainingHours ?? '–'} more billable hrs</strong> at {money(rate)}/hr
              to reach the goal ({money(progress.remainingAmount)} to go).
            </>}
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {progress.hours} unbilled hrs {since}.
        {progress.carriedOverHours > 0 && <> {progress.carriedOverHours} unbilled hrs from before this period are on the invoice but not counted.</>}
      </p>
      {progress.outstanding.count > 0 && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Outstanding (sent, unpaid): {progress.outstanding.count} invoice{progress.outstanding.count === 1 ? '' : 's'} · {money(progress.outstanding.amount)}. Not included in goal progress.
        </p>
      )}
    </div>
  );
}

export default function GenerateInvoice() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.clients.list().then(setClients).catch(console.error);
  }, []);

  const loadPreview = async () => {
    if (!clientId) {
      setError('Select a client.');
      return;
    }
    setError('');
    setLoadingPreview(true);
    setPreview(null);
    try {
      const data = await api.invoices.preview({ clientId });
      setPreview(data);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmGenerate = async () => {
    if (!clientId) return;
    const issueCount = new Set(preview.lineItems.map((item) => item.issueKey)).size;
    const ok = window.confirm(
      `Generate this invoice for ${preview.client.name}?\n\n` +
      `This will close out ${issueCount} Jira issue${issueCount === 1 ? '' : 's'} by setting "Time Exported" to Yes, ` +
      `so they won't show up on future invoices.`
    );
    if (!ok) return;
    setGenerating(true);
    setError('');
    try {
      const invoice = await api.invoices.generate({ clientId });
      if (invoice.jiraExportFailures?.length) {
        alert(`Invoice created, but these Jira issues could not be marked as exported: ${invoice.jiraExportFailures.join(', ')}`);
      }
      window.location.href = `/invoices/${invoice.id}`;
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const client = clients.find((c) => c.id === clientId);
  const hasProjectKey = client?.jiraProjectKey;

  return (
    <>
      <div className="page-header">
        <h1>Generate invoice</h1>
        <p>Select client to pull all unexported Jira issues for that project, then create the invoice</p>
      </div>
      <div className="card" style={{ maxWidth: '520px' }}>
        <div className="form-group">
          <label>Client</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {client && !hasProjectKey && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
              This client has no Jira project key. <Link to={`/clients/${client.id}/edit`}>Edit client</Link> to set it.
            </p>
          )}
        </div>
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={loadPreview}
          disabled={loadingPreview || !hasProjectKey}
        >
          {loadingPreview ? 'Loading…' : 'Preview'}
        </button>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Preview</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {preview.client.name}
            {preview.startDate && preview.endDate && (
              <> · {new Date(preview.startDate).toLocaleDateString()} – {new Date(preview.endDate).toLocaleDateString()}</>
            )}
          </p>
          <table>
            <thead>
              <tr>
                <th>Epic</th>
                <th>Issue</th>
                <th>Summary</th>
                <th>Work description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.lineItems.map((item, i) => (
                <tr key={i}>
                  <td>{item.epicTitle || 'General Maintenance'}</td>
                  <td>{item.issueKey}</td>
                  <td>{item.summary}</td>
                  <td>{item.worklogDescription || '–'}</td>
                  <td>{item.hours}</td>
                  <td>${Number(item.rate).toFixed(2)}</td>
                  <td>${Number(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '1rem', fontWeight: 600 }}>
            Total: {preview.totalHours} hrs · ${Number(preview.totalAmount).toFixed(2)}
          </p>
          {preview.monthlyGoal && <GoalProgress progress={preview.monthlyGoal} rate={preview.client.hourlyRate} />}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Generating will create the invoice, save it, and mark the related Jira issues as exported.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmGenerate}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Confirm & generate invoice'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
