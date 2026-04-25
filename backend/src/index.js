require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const app = require('./app');

const PORT = process.env.PORT || 3000;

function ensureDataDir() {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/file:(.+)/);
  if (match) {
    const dbPath = path.dirname(path.resolve(__dirname, '..', match[1].trim()));
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });
  }
}

function runMigrations() {
  ensureDataDir();
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      cwd: path.join(__dirname, '..'),
    });
  } catch (e) {
    console.warn('Migration deploy failed, trying db push for dev:', e.message);
    try {
      execSync('npx prisma db push', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });
    } catch (e2) {
      console.error('DB setup failed:', e2.message);
      process.exit(1);
    }
  }
}

function runSeed() {
  try {
    execSync('npx prisma db seed', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (e) {
    console.warn('Seed failed (may be ok):', e.message);
  }
}

runMigrations();
runSeed();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
