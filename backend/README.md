# POS & Inventory — Backend API

Express + MySQL REST API. Raw `mysql2` queries (no ORM) so every SQL statement is visible.

## Requirements

- Node.js 18+
- MySQL 8.0+ (MySQL Workbench is fine for importing the schema)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database
#    Open database/schema.sql in MySQL Workbench and execute it,
#    or from the terminal:
mysql -u root -p < ../database/schema.sql

# 3. Configure environment
cp .env.example .env
#    Edit .env — set DB_PASSWORD and generate a JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Set real passwords on the seeded accounts
npm run seed:passwords

# 5. Run
npm run dev      # nodemon, auto-restart
npm start        # plain node
```

Check it worked: <http://localhost:5000/api/health>

## Default accounts (after step 4)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `cashier1` | `cashier123` | cashier |
| `cashier2` | `cashier123` | cashier |

`schema.sql` also creates eight product categories. Products and sales start
empty — add your own stock through the app.

**Change these passwords before your demo.** The values live in
`scripts/seed-passwords.js`, and staff can be added or blocked from the Staff
screen without touching SQL again.

## QR payments

Set either `QR_STATIC_IMAGE_URL` (show a saved picture of your bank QR) or the
`QR_ACCOUNT_ID` group (generate an EMVCo QR carrying the amount) in `.env`.

To read the values out of a QR your bank already issued:

```bash
npm run qr:decode "<raw text from your bank QR>"
```

`GET /api/payments/qr?amount=12.50` returns either the payload string or the
image URL; the frontend renders the code. Nothing contacts the bank — payment
confirmation is the cashier's job.

## Product images

Photos are uploaded to `POST /api/uploads/product-image` as
`multipart/form-data` with one file field named `image`. The endpoint returns a
path like `/uploads/products/1724...-a3f9.jpg`, which you then send as
`imageUrl` on the product.

- Files land in `backend/uploads/products/` and are served from `/uploads`
- JPG, PNG, WEBP and GIF only, 2 MB maximum
- Filenames are random, so an uploaded file can never overwrite another one or
  escape the folder — the client's filename is discarded entirely
- Replacing or clearing a product's photo deletes the old file
- `uploads/` is git-ignored: photos are data, not source code. Back up that
  folder alongside your database dump, or the images are gone.

## Project structure

```
src/
├── config/         env validation, MySQL pool & transaction helper, upload rules
├── middleware/     JWT auth, role guard, validation, error handler
├── controllers/    request → SQL → response
├── routes/         URL → middleware chain → controller
├── validators/     express-validator rule sets
├── utils/          ApiError, asyncHandler, money/CSV helpers
├── app.js          Express wiring
└── server.js       DB check, then listen
```

## Response shape

Every endpoint returns the same envelope, so the frontend never has to guess:

```jsonc
// success
{ "success": true, "data": { ... }, "pagination": { ... } }

// failure
{ "success": false, "message": "Not enough stock for \"Cola Can 330ml\": 3 left, 5 requested" }
```

## Role matrix

| | admin | cashier | public |
|---|---|---|---|
| Browse catalogue (`/public/*`) | ✓ | ✓ | ✓ |
| View products / stock | ✓ | ✓ | — |
| Adjust stock count | ✓ | ✓ | — |
| Create / edit / delete products | ✓ | — | — |
| Checkout | ✓ | ✓ | — |
| View sales | all | own only | — |
| Void a sale | ✓ | — | — |
| Reports, exports, inventory logs | ✓ | — | — |
| Manage users | ✓ | — | — |

Roles are enforced in `middleware/auth.js`. The frontend also hides what a role
can't use, but that is convenience only — the server is what actually decides.

## API testing

Import `POS-API.postman_collection.json` into Postman, run **1. Auth → Login (Admin)**
first. The token is captured into a collection variable automatically; every other
request reuses it.

## Notes for the team

- Money is `DECIMAL(10,2)` in MySQL and rounded through `utils/helpers.money()` in JS.
  Never use `float` for currency.
- Checkout prices are read from the database, never from the request body. A modified
  frontend cannot set its own prices.
- `POST /api/sales` runs inside one transaction with `SELECT ... FOR UPDATE` row locks.
  If any line fails the stock check, the whole sale rolls back.
- Products are deactivated, not deleted, because `sale_items` references them.
