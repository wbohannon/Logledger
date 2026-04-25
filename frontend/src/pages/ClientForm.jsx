import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    hourlyRate: 75,
    jiraProjectKey: '',
    billingEmail: '',
  });

  useEffect(() => {
    if (!isEdit) return setLoading(false);
    api.clients.get(id)
      .then((c) => setForm({
        name: c.name,
        hourlyRate: c.hourlyRate,
        jiraProjectKey: c.jiraProjectKey || '',
        billingEmail: c.billingEmail || '',
      }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        hourlyRate: Number(form.hourlyRate),
        jiraProjectKey: form.jiraProjectKey || null,
        billingEmail: form.billingEmail || null,
      };
      if (isEdit) {
        await api.clients.update(id, payload);
      } else {
        await api.clients.create(payload);
      }
      navigate('/clients');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <>
      <div className="page-header">
        <h1>{isEdit ? 'Edit client' : 'New client'}</h1>
        <p>{isEdit ? 'Update client details' : 'Add a client for invoicing'}</p>
      </div>
      <div className="card" style={{ maxWidth: '480px' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Client name"
            />
          </div>
          <div className="form-group">
            <label>Hourly rate ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.hourlyRate}
              onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Jira project key</label>
            <input
              value={form.jiraProjectKey}
              onChange={(e) => setForm((f) => ({ ...f, jiraProjectKey: e.target.value }))}
              placeholder="e.g. PROJ"
            />
          </div>
          <div className="form-group">
            <label>Billing emails</label>
            <textarea
              value={form.billingEmail}
              onChange={(e) => setForm((f) => ({ ...f, billingEmail: e.target.value }))}
              placeholder="finance@client.com, client@client.com"
              rows={3}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
            <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Comma- or newline-separated. Invoice emails will be sent to all addresses.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </button>
            <Link to="/clients" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
