import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    api.clients.list().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    const params = {};
    if (filterClient) params.clientId = filterClient;
    if (filterStatus) params.status = filterStatus;
    api.invoices.list(params)
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterClient, filterStatus]);

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Invoices</h1>
          <p>View and download invoices</p>
        </div>
        <Link to="/generate" className="btn btn-primary">Generate invoice</Link>
      </div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
            <label>Client</label>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
              <option value="">All</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
            <label>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>
      <div className="card">
        {invoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No invoices match the filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Period</th>
                <th>Hours</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.client?.name}</td>
                  <td>
                    {new Date(inv.startDate).toLocaleDateString()} – {new Date(inv.endDate).toLocaleDateString()}
                  </td>
                  <td>{inv.totalHours}</td>
                  <td>${Number(inv.totalAmount).toFixed(2)}</td>
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td>
                    <Link to={`/invoices/${inv.id}`}>View</Link>
                    {' · '}
                    <a href={api.invoices.pdfUrl(inv.id)} target="_blank" rel="noopener noreferrer">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
