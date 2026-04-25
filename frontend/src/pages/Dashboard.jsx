import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.clients.list(), api.invoices.list()])
      .then(([c, i]) => {
        setClients(c);
        setInvoices(i);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const draftCount = invoices.filter((i) => i.status === 'draft').length;
  const recentInvoices = invoices.slice(0, 5);

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of clients and invoices</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Clients</h3>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{clients.length}</p>
          <Link to="/clients" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>Manage</Link>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Invoices</h3>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{invoices.length}</p>
          <Link to="/invoices" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>View all</Link>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Draft invoices</h3>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{draftCount}</p>
          <Link to="/generate" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>Generate</Link>
        </div>
      </div>
      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Recent invoices</h2>
        {recentInvoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No invoices yet. Generate one from Jira worklogs.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Period</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.client?.name}</td>
                  <td>{new Date(inv.startDate).toLocaleDateString()} – {new Date(inv.endDate).toLocaleDateString()}</td>
                  <td>${Number(inv.totalAmount).toFixed(2)}</td>
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td><Link to={`/invoices/${inv.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
