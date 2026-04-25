import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.invoices.get(id)
      .then(setInvoice)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      const updated = await api.invoices.updateStatus(id, status);
      setInvoice(updated);
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const sendInvoiceEmail = async () => {
    setSending(true);
    try {
      const result = await api.invoices.sendEmail(id);
      alert(`Invoice sent to ${result.to?.join(', ') || 'recipients'}.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="page-header"><p>Loading…</p></div>;
  if (!invoice) return <div className="page-header"><p>Invoice not found.</p></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Invoice #{invoice.id.slice(-8).toUpperCase()}</h1>
          <p>
            {invoice.client?.name} · {new Date(invoice.startDate).toLocaleDateString()} – {new Date(invoice.endDate).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
          <a
            href={api.invoices.pdfUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Download PDF
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={sendInvoiceEmail}
            disabled={sending || !invoice.client?.billingEmail?.trim()}
            title={!invoice.client?.billingEmail?.trim() ? 'Add billing emails in Clients' : ''}
          >
            {sending ? 'Sending…' : 'Email invoice'}
          </button>
          <Link to="/invoices" className="btn btn-secondary">Back to list</Link>
        </div>
      </div>
      <div className="card">
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Line items</h2>
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
            {(invoice.lineItems || []).map((item) => (
              <tr key={item.id}>
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
          Total: {invoice.totalHours} hrs · ${Number(invoice.totalAmount).toFixed(2)}
        </p>
      </div>
      {['draft', 'sent'].includes(invoice.status) && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Update status</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            Mark as sent or paid when you've sent the invoice or received payment.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateStatus('sent')}
              disabled={updating || invoice.status !== 'draft'}
            >
              Mark sent
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => updateStatus('paid')}
              disabled={updating || invoice.status === 'paid'}
            >
              Mark paid
            </button>
          </div>
        </div>
      )}
    </>
  );
}
