const express = require('express');
const path = require('path');
const cors = require('cors');
const clientsRouter = require('./routes/clients');
const invoicesRouter = require('./routes/invoices');
const { AppError } = require('./utils/errors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/clients', clientsRouter);
app.use('/api/invoices', invoicesRouter);

if (process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND !== '0') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use((req, res, next) => {
  next(new AppError(`Not found: ${req.method} ${req.path}`, 404));
});

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

module.exports = app;
