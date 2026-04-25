import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import GenerateInvoice from './pages/GenerateInvoice';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';

function Layout({ children }) {
  const loc = useLocation();
  const nav = [
    { to: '/', label: 'Dashboard' },
    { to: '/clients', label: 'Clients' },
    { to: '/invoices', label: 'Invoices' },
    { to: '/generate', label: 'Generate Invoice' },
  ];
  return (
    <div className="app">
      <nav className="nav">
        <div className="container nav-inner">
          <Link to="/" className="nav-brand">LogLedger</Link>
          <div className="nav-links">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to)) ? 'active' : ''}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route path="/clients/:id/edit" element={<ClientForm />} />
        <Route path="/generate" element={<GenerateInvoice />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceView />} />
      </Routes>
    </Layout>
  );
}
