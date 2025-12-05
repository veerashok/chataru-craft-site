# Chataru Craft – Multi-page Site (Railway-ready)

This is a small Node.js + Express + PostgreSQL project for the **Chataru Craft** website.

## Structure

- `server.js` – Express server + PostgreSQL (for enquiries)
- `package.json` – dependencies
- `public/`
  - `index.html` – Home
  - `catalog.html` – Catalog / products
  - `custom.html` – Custom orders
  - `contact.html` – Contact page with enquiry form
  - `styles.css` – Shared styles
  - `main.js` – Frontend JS (mobile menu + enquiry submit)

Forms on `custom.html` and `contact.html` submit to `POST /api/enquiry`.

Enquiries are stored in a PostgreSQL table called `enquiries`.

## Running locally

1. Install dependencies:

```bash
npm install
```

2. Set environment variables (for local dev you can use a `.env` via something like `dotenv`, or export them in your shell):

- `DATABASE_URL` – Postgres connection string
- `ADMIN_PASSWORD` – password you will use to read enquiries
- (optional) `DATABASE_SSL=false` if your local Postgres has no SSL

3. Start the server:

```bash
npm start
```

Visit: http://localhost:3000

## API

### `POST /api/enquiry`

Body (JSON):

```json
{
  "name": "Your name",
  "email": "your@email",
  "phone": "optional",
  "message": "your message",
  "sourcePage": "/contact.html"
}
```

### `GET /api/admin/enquiries`

Returns all enquiries in JSON. Requires a header:

- `x-admin-key: <ADMIN_PASSWORD>`

Example with curl:

```bash
curl -H "x-admin-key: YOUR_ADMIN_PASSWORD" \
  https://your-railway-url/api/admin/enquiries
```

## Deploying to Railway (short version)

1. Push this folder to a GitHub repo.
2. On Railway:
   - Create a new project from your GitHub repo.
   - Add a **PostgreSQL** database in the same project.
   - Ensure the Node service has env vars:
     - `DATABASE_URL` (copied from the Postgres service or linked automatically)
     - `ADMIN_PASSWORD` (choose a strong password)
   - Start command should be `npm start`.

3. Open the public URL shown by Railway; the site should load with working enquiry forms.
