import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.clients.list()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deleteClient = async (id, name) => {
    if (!window.confirm(`Delete client "${name}"?`)) return;
    try {
      await api.clients.delete(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Clients</h1>
          <p>Manage clients and their Jira project keys for invoicing</p>
        </div>
        <Link to="/clients/new" className="btn btn-primary">Add client</Link>
      </div>
      <div className="card">
        {clients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No clients. Add one to start generating invoices.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Hourly rate</th>
                <th>Jira project</th>
                <th>Billing emails</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>${Number(c.hourlyRate).toFixed(2)}</td>
                  <td>{c.jiraProjectKey || '–'}</td>
                  <td>{c.billingEmail || '–'}</td>
                  <td>
                    <Link to={`/clients/${c.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                    {' '}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteClient(c.id, c.name)}>Delete</button>
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
