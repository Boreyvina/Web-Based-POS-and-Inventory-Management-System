# Web-Based POS & Inventory Management System

A point-of-sale and stock management system for small convenience stores and
family businesses. Three roles: **admin** (owner), **cashier**, and a public
**customer** product list that needs no login.

React + Vite + Tailwind · Node.js + Express · MySQL · JWT · Chart.js

## Repository layout

```
├── backend/     Express REST API (raw mysql2, no ORM)
├── frontend/    React app (Vite + Tailwind + Chart.js)
├── database/    schema.sql (safe to re-run), reset.sql (deletes everything),
│                seed-demo.sql (sample products), upgrade-expiry.sql
├── GETTING-STARTED.md   step-by-step guide for first-time setup
├── DEPLOYMENT.md        hosting it on Vercel, and what will not work there
├── CODE-EXPLAINED.md    full walkthrough of every file, for your presentation
└── README.md    you are here
```

Each part has its own README with setup steps.

New to this? Read **[GETTING-STARTED.md](GETTING-STARTED.md)** — it walks through
installing Node and MySQL, and explains what each step is doing.

Not sure what all these folders are? Read **Files-and-Folders-Explained.docx** —
a plain-language tour of every folder and file, written for someone who has not
seen the code before.

Want to see the actual code explained? Read **The-Code-Explained.docx** — every
important function with its real code beside a line-by-line explanation.

Preparing to present or defend the project? Read
**[CODE-EXPLAINED.md](CODE-EXPLAINED.md)** (or Code-Walkthrough.docx) — every
file and function, why it was built that way, and the questions you are likely
to be asked.

## Quick start

```bash
# 1. Database — creates the tables, three staff accounts and eight categories
#    Safe to run again later; it never deletes existing data.
mysql -u root -p < database/schema.sql

# 2. Backend
cd backend
npm install
cp .env.example .env          # set DB_PASSWORD and JWT_SECRET
npm run seed:passwords        # real password hashes for the seeded accounts
npm run dev                   # http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

Sign in as `admin` / `admin123`. **Change that password before your demo.**

You start with three staff accounts (`admin`, `cashier1`, `cashier2` — the
cashiers use `cashier123`) and eight categories ready to sort stock into.
**Products and sales start empty**, so add your own from
**Products → Add product**, photo included.

Want sample products so the dashboard charts show something while you build?

```bash
mysql -u root -p < database/seed-demo.sql
```

`schema.sql` is safe to run repeatedly — it only creates what is missing. To
wipe everything deliberately, run `database/reset.sql` first.

## Build status

| Stage | Status |
|---|---|
| Database schema + seed data | done |
| REST API (auth, products, sales, reports) | done |
| Postman collection (35 requests) | done |
| Admin dashboard + product CRUD | done |
| Cashier checkout + printable receipt | done |
| Sales history, receipts, void | done |
| Reports UI + CSV/PDF export | done |
| Customer browse page | done |
| Product photo upload | done |
| Staff account management | done |
| Customer-facing display screen | done |
| Cash / card / QR payments | done |
| Percentage and amount discounts | done |
| Expiry date tracking and write-offs | done |
| Stock batches — old and new kept separate (FEFO) | done |
| Supplier and purchase order tracking | done |
| Per-staff sales filter and takings report | done |

Every requirement in the brief is now built. What remains is documentation:
the ER diagram in Draw.io, and your project report.

## Git

Both `backend/` and `frontend/` have a `.gitignore` that excludes
`node_modules/` and `.env`. **Never commit a `.env` file** — it holds your
database password and JWT secret. Commit `.env.example` instead.

Suggested branch-per-person workflow for a three-person team:

```bash
git checkout -b feature/checkout-screen
# work, commit
git push -u origin feature/checkout-screen
# open a pull request, have someone else read it before merging
```

## Documentation still to produce

- ER diagram (Draw.io) modelled from `database/schema.sql`
- User manual / project report
