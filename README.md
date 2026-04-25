# LogLedger

Production-ready MVP for generating invoices from Jira Cloud worklogs. Fully containerized with Docker.

## Stack

- **Backend:** Node.js (Express)
- **Frontend:** React (Vite)
- **Database:** SQLite (Prisma ORM)
- **PDF:** pdfkit
- **Jira:** REST API v3 (axios)

## Quick start with Docker

```bash
cp .env.example .env
# Edit .env and set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN

docker compose up --build
```

Open **http://localhost:3000**. The SQLite database is stored in the `sqlite_data` Docker volume.

## Local development

### Backend

```bash
cd backend
cp ../.env.example .env
# Edit .env (use DATABASE_URL="file:./data/sqlite.db")
npm install
mkdir -p data
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173 with API proxy to the backend.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./data/sqlite.db` or `file:/app/data/sqlite.db` in Docker |
| `JIRA_BASE_URL` | Yes | Jira base URL, e.g. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | Yes | Email used for Jira Cloud |
| `JIRA_API_TOKEN` | Yes | [Jira API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_DOWNTIME_EXPORTED_FIELD_ID` | No | Custom field id for "Downtime Exported" (e.g. `customfield_10001`) so issues are marked after export |
| `PORT` | No | Server port (default 3000) |
| `INVOICE_FROM_EMAIL` | For email | Sender address for invoice emails (e.g. Wayne.bohannon@bohannonindustries.com) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | For email | SMTP credentials so the app can send invoice emails |

## Jira setup

1. Create a custom field in Jira named **Downtime Exported** (e.g. select list: No / Yes).
2. In Jira Cloud, create an API token and set `JIRA_EMAIL` and `JIRA_API_TOKEN`.
3. Optionally set `JIRA_DOWNTIME_EXPORTED_FIELD_ID` to the field id so exported issues are updated to "Yes".

Invoice generation fetches issues where **"Downtime Exported" = "No"** and that have worklogs in the chosen date range. After generating an invoice, those issues can be updated to "Yes" if the field id is configured.

## Features

- **Clients:** CRUD with name, hourly rate, Jira project key, and **billing emails** (comma- or newline-separated; e.g. finance@client.com, client@client.com).
- **Email invoice:** From the invoice view, "Email invoice" sends the PDF from your address (set in `INVOICE_FROM_EMAIL`) to all of the client’s billing emails.
- **Generate invoice:** Select client and date range → preview worklogs from Jira → confirm → create invoice and PDF, update Jira.
- **Invoices:** List, filter, view, download PDF, update status (draft → sent → paid).
- Duplicate prevention: no second invoice for the same client and date range.

## Project structure

```
/backend
  /prisma       schema, migrations, seed
  /src
    /controllers
    /routes
    /services    jira, invoice, client, pdf
    /utils
/frontend       React (Vite)
Dockerfile      multi-stage (frontend build + backend)
docker-compose.yml
.env.example
```

## Database

SQLite is used for the MVP. The schema is ready for a future PostgreSQL upgrade (change `provider` in `backend/prisma/schema.prisma` and set `DATABASE_URL` to a Postgres URL).

## License

MIT
