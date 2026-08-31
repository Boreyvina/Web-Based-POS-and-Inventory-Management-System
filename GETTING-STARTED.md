# Getting Started — a step-by-step guide

Written for someone who has never set up a project like this before. Follow the
steps in order. Don't skip any.

---

## Part 1 — Install the three things you need

You only do this once per computer.

### 1. Node.js

Node.js runs the backend and builds the frontend.

Go to <https://nodejs.org> and download the **LTS** version. Install it by
clicking Next through the installer.

Check it worked. Open a terminal:

- **Windows** — press the Start key, type `cmd`, press Enter
- **Mac** — press Cmd+Space, type `terminal`, press Enter

Type this and press Enter:

```bash
node -v
```

You should see something like `v20.11.0`. If you see "command not found", close
the terminal, open a new one, and try again. If it still fails, reinstall Node.

### 2. MySQL

MySQL stores all your data. Download **MySQL Installer** from
<https://dev.mysql.com/downloads/installer/> and choose the "Developer Default"
setup. It installs both MySQL Server and MySQL Workbench.

During installation it asks you to set a **root password**. Write it down. You
will need it in Part 2, and there is no way to recover it easily.

### 3. A code editor

Visual Studio Code, from <https://code.visualstudio.com>. This is where you will
open the project folder and read the code.

---

## Part 2 — Set up the database

**What you are doing:** creating the empty tables that will hold your products,
sales and users.

1. Open **MySQL Workbench**.
2. Click the connection tile (usually called "Local instance MySQL80"). Enter
   the root password you set during installation.
3. In the menu: **File → Open SQL Script**.
4. Navigate to the project folder, open `database/schema.sql`.
5. Click the **lightning bolt icon** ⚡ in the toolbar to run it.
6. On the left, right-click **Schemas** and choose **Refresh All**. You should
   now see `pos_system` with seven tables inside.

If you see red error text, read the last line. The most common cause is running
the script twice — that is fine, the script deletes and recreates the database
each time.

**What you just created:** the tables, three staff accounts (one admin, two
cashiers), and eight product categories. Products and sales are empty — you add
your own stock in the app.

---

## Part 3 — Start the backend

**What the backend is:** the program that talks to the database. The website
never touches MySQL directly; it asks the backend, and the backend answers.

Open a terminal, then move into the backend folder:

```bash
cd path/to/project/backend
```

> **Tip:** in VS Code, right-click the `backend` folder and choose "Open in
> Integrated Terminal". That saves you typing the path.

### 3.1 Install the libraries

```bash
npm install
```

This downloads everything the backend depends on into a `node_modules` folder.
It takes a minute or two and prints a lot of text. Warnings are normal; errors
in red are not.

### 3.2 Create your settings file

The backend needs to know your database password. That goes in a file called
`.env`, which is deliberately never shared or committed to Git.

**Windows:**
```bash
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

Now open `backend/.env` in VS Code and change two lines:

```env
DB_PASSWORD=your_mysql_password      ← the root password from Part 1
JWT_SECRET=change_this_to_a_long_random_string
```

For `JWT_SECRET`, run this command and paste the result:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**What JWT_SECRET does:** when someone logs in, the backend gives them a signed
token. This secret is what signs it. If someone knows your secret, they can
forge a token and log in as anyone. Keep it long and random.

While you are in `.env`, set your shop details — these print on receipts:

```env
STORE_NAME=My Convenience Store
STORE_ADDRESS=Street 123, Phnom Penh
STORE_PHONE=012 345 678
CURRENCY=USD
```

### 3.3 Set the admin password

```bash
npm run seed:passwords
```

This turns the placeholders in the database into real encrypted passwords. You
should see three `ok` lines: `admin` gets `admin123`, and `cashier1` and
`cashier2` both get `cashier123`.

**Why this step exists:** passwords are never stored as plain text. They are
"hashed" — scrambled in a way that cannot be reversed. The SQL file cannot do
this, so a small script does it instead.

### 3.4 Run it

```bash
npm run dev
```

You should see:

```
[db] Connected to MySQL
[server] Running in development mode on http://localhost:5000
```

**Leave this terminal open.** Closing it stops the backend. Open
<http://localhost:5000/api/health> in your browser — you should see a small
message saying the API is running.

---

## Part 4 — Start the frontend

**What the frontend is:** the website you actually click on.

Open a **second** terminal (do not close the first one):

```bash
cd path/to/project/frontend
npm install
```

Then create its settings file:

**Windows:** `copy .env.example .env` · **Mac/Linux:** `cp .env.example .env`

The defaults are fine. Now start it:

```bash
npm run dev
```

Open <http://localhost:5173>.

**You now have two programs running at once.** That is normal and correct. The
frontend on port 5173 talks to the backend on port 5000, which talks to MySQL.

---

## Part 5 — Using the system

Log in with:

- Username: `admin`
- Password: `admin123`

Change this later — Postman's `PATCH /api/auth/password`, or ask me to add a
settings screen.

### Step 1 — Check your categories

Go to **Products → Categories**. Eight are already there: Beverages, Snacks,
Dairy & Eggs, Instant Food, Bakery, Household, Personal Care, Tobacco & Misc.

Rename them, delete the ones that do not match your shop, or add your own. A
category with no products in it can be deleted freely; once products use it, you
have to move those first.

Categories are what make the "Revenue by category" chart meaningful, so it is
worth having them match how your shelves are actually laid out.

### Step 2 — Add your products

**Products → Add product.** Fill in:

| Field | What to put |
|---|---|
| Product name | What staff would call it: "Bottled Water 500ml" |
| Category | Pick one you just made |
| Barcode | Click the field and **scan the item** — the scanner types it for you. Leave empty for loose goods |
| Cost price | What you pay your supplier |
| Selling price | What the customer pays |
| Opening stock | How many you have on the shelf right now |
| Reorder level | Warn me when stock drops to this number |
| Photo | Tap to choose a file, or drag one in. On a phone it opens the camera |

**About barcodes:** a barcode scanner is just a keyboard. Click into the barcode
box, scan, and the numbers appear. You do not need special software.

**Internal codes are automatic.** Every product still gets a unique code
(BEV-0001, SNK-0002) for the database and reports, but the app generates it from
the category — nobody has to invent one. You will only see it in exports.

### Step 3 — Make a sale

Click **Sell** in the sidebar.

1. **Scan the item.** The cursor is already in the barcode box. Scan and the
   item drops into the cart.
2. **No barcode?** Search by name, or just tap the product tile.
3. **Adjust quantities** with the − and + buttons. The system will not let you
   sell more than you have.
4. **Discounts** — per item, or one discount on the whole sale.
5. **Discount, if any.** Toggle between **$** (an amount off) and **%** (a
   percentage of the bill). You can also discount a single line in the cart.
6. **Choose payment** — Cash, Card or QR.
   - **Cash** — type what the customer handed you. The change appears
     automatically; the "Exact" button fills in the exact total.
   - **Card** — take it on your card terminal, then record the sale here.
   - **QR** — a bank QR appears with the amount. Wait until the money shows up
     in your banking app before pressing Take payment.
7. **Take payment.** The receipt appears; **Print** sends it to a printer.

Behind the scenes, one click just did four things: recorded the sale, saved
every line item, reduced the stock of each product, and wrote an entry to the
inventory log. If any of those had failed, none of them would have happened.

### Step 4 — Restocking

When a delivery arrives: **Products → find the item → Stock**.

Choose **Delivery received**, type how many arrived, add a note, save. The stock
goes up and the change is recorded with your name and the time.

**Why not just type the new number?** Because then nobody could tell the
difference between a delivery, a correction, and a mistake. Every change here
answers "why".

### Step 4b — The customer-facing screen

On the checkout screen, click **Customer screen** (top right). A second window
opens showing the customer their items and the running total in large type, with
no buttons they can press. Drag it onto a second monitor facing the counter.

It mirrors the till live, and shows a thank-you with the change due once a sale
finishes.

**One limitation to be aware of:** the two windows must be on the *same
computer*, in the same browser. It uses a browser feature that passes messages
between windows. A tablet across the counter is a different device, and syncing
that would need the backend to relay the cart.

### Step 4c — Expiry dates

Perishables get an expiry date when you add them. From then on:

- **Products** shows the date and how long is left, with an **Expiring soon**
  filter button.
- **The dashboard** has an Expiry watch panel and a card totalling the value of
  stock at risk.
- **The checkout refuses to sell an expired item.** The tile is greyed out with
  "Expired — do not sell", and the server refuses it too, so it cannot be
  worked around.
- **Write off** appears next to expired products. It reduces the stock and
  records the loss as "expired" in the movement log, so you can total up what
  expiry costs you over a month.

Set the date when the delivery arrives, not when you first created the product.
Each new delivery replaces the date on that product.

### Step 5 — Reading the dashboard

The dashboard is empty until you make your first sale. That is expected.

- **Sold today / This month** — revenue and how many transactions
- **Stock value** — what your shelves are worth at cost price
- **Needs reordering** — how many products hit their reorder level
- **Revenue chart** — switch between 7 days, 30 days, 3 months, 12 months
- **Best sellers** — what actually moves
- **Reorder list** — your shopping list for the supplier

### Step 6 — Adding a cashier

Two cashier accounts already exist — `cashier1` and `cashier2`, both with the
password `cashier123`. Rename or block them and create real ones.

**Staff → Add staff member.** Fill in their name, a username they will type to
sign in, an email, and a password. Choose **Cashier** unless they genuinely need
to change prices and see reports.

Write the password down and hand it over in person. It is stored encrypted, so
nobody can read it back later — if they forget it, create a new account or add a
password-reset screen.

A cashier signing in sees only Sell, My sales and Products. They cannot open
reports, cannot change prices, and see only their own transactions.

**When someone leaves, block them — do not delete them.** Blocking stops them
signing in immediately, while keeping every sale they rang up attached to their
name. Deleting would break that link and your sales history would lose track of
who served whom.

### Step 7 — Reports

**Reports** lets you pick any date range and download the result as CSV (opens
in Excel) or PDF (for printing or handing in).

The **Inventory** tab shows every stock movement: what changed, by how much,
who did it, and when.

---

## Setting up QR payments

Pick one of the two options below and put the values in `backend/.env`.
Restart the backend afterwards — `.env` is only read at startup.

### Option A — show your saved bank QR (easiest, works today)

1. Open your banking app and save your receive/merchant QR as an image.
2. Copy the file into `backend/uploads/products/` and name it `bank-qr.png`.
3. In `backend/.env`:

```env
QR_STATIC_IMAGE_URL=/uploads/products/bank-qr.png
```

The checkout screen shows your QR with the amount printed beside it. The
customer scans and types the amount themselves — which is how most small shops
already operate.

### Option B — a QR that already carries the amount

The app can build the QR itself so the customer just scans and confirms. It
needs your bank account identifier, which is hidden inside the QR your bank
already gave you. There is a tool to read it out:

1. Open your banking app and show your merchant QR.
2. Scan it with any QR reader app that shows the **raw text** rather than
   opening it as a link. The text begins with `0002`.
3. Paste that text into this command, from the `backend` folder:

```bash
npm run qr:decode "00020101021229400017kh.gov.nbc.bakong..."
```

It prints the fields with labels and then a block of `.env` lines ready to copy:

```
QR_ACQUIRER_ID=kh.gov.nbc.bakong
QR_ACCOUNT_ID=your_account@bank
QR_MERCHANT_NAME=MY STORE
QR_MERCHANT_CITY=PHNOM PENH
```

The tool sends nothing anywhere — a QR code is just text, and this splits it
into its labelled parts.

If it says the checksum is **invalid**, the text was cut off when you copied it.
Scan again and copy the whole thing.

### Test it before you rely on it

Ring up a small real sale — a dollar — choose QR, and scan the code with an
actual banking app. Either the money arrives or it does not; there is no middle
ground to guess about. **If it does not scan, use Option A.** A QR that looks
right on screen but does not resolve is worse than an honest picture.

### Using it at the till

1. Add the items to the cart as normal.
2. Tap **QR** in the payment row. The code appears with the total under it.
3. Turn the screen toward the customer, or use the **Customer screen** window.
4. Wait until the payment shows up **in your banking app**.
5. Only then press **Take payment**.

**The system does not know whether the money arrived.** Nothing in this project
contacts your bank. The cashier confirms it and records the sale. If an examiner
asks whether payment is verified, that is the answer — real verification needs a
merchant API agreement with the bank, which is outside a student project.

---

## Part 6 — Testing the API with Postman

Your project requires this, and it is also the fastest way to check the backend
works without clicking through the website.

1. Download Postman from <https://www.postman.com/downloads/>.
2. Click **Import**, choose `POS-API.postman_collection.json`.
3. Open **1. Auth → Login (Admin)** and click **Send**.
4. You get a token back — it is saved automatically for every other request.
5. Now try any other request. They will all work.

**What a token is:** proof that you logged in. Every protected request carries
it. Without it, the backend replies "401 Unauthorized".

**Try this to see roles working:** run **Login (Cashier)** — you need to have
created a cashier first — then try **Reports → Dashboard summary**. You get
**403 Forbidden**. The rule lives in the backend, so hiding buttons in the
website is not what protects your data.

---

## Every time you work on the project

You do not repeat the setup. Just:

1. Terminal 1: `cd backend` → `npm run dev`
2. Terminal 2: `cd frontend` → `npm run dev`
3. Open <http://localhost:5173>

Press **Ctrl+C** in a terminal to stop that program.

---

## When something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| `Cannot reach the server. Is the backend running?` | Terminal 1 is closed or crashed | Restart the backend |
| `[db] Could not connect to MySQL` | Wrong password, or MySQL is off | Check `DB_PASSWORD` in `.env`; start the MySQL service |
| `Invalid username or password` | Password not seeded | Run `npm run seed:passwords` |
| `EADDRINUSE: port 5000` | Backend already running elsewhere | Close the other terminal, or change `PORT` in `.env` |
| `npm: command not found` | Node.js not installed properly | Reinstall Node, open a fresh terminal |
| My products vanished after restarting | Almost always `reset.sql` was run, or an old copy of `schema.sql` that still had `DROP DATABASE` at the top | Check with `SELECT COUNT(*) FROM pos_system.products;` — see "Where your data actually lives" below |
| `ER_DUP_ENTRY` when adding a product | That SKU or barcode already exists | Use a different one |
| Page is blank and white | A frontend error | Press F12, read the red text in Console |
| `Cannot reach the server` **when opening from a phone or another PC** | See "Using it on a phone or tablet" below | Comment out `VITE_API_URL` in `frontend/.env` and restart |

**The rule for reading errors:** the useful line is usually the first or last
one, not the wall of text in between.

---

## Where your data actually lives

This confuses almost everybody once.

**Stopping the backend or the frontend does not delete anything.** Those are two
programs; your data is in MySQL, which is a third program running separately in
the background. Press Ctrl+C as often as you like — the database is untouched.

```
  Frontend  (Ctrl+C stops it)  ─┐
  Backend   (Ctrl+C stops it)  ─┤── none of these hold your data
                                │
  MySQL     (a Windows service) ─── your data is HERE, on disk
```

MySQL starts with Windows and keeps running whether or not your project is open.

### So why would products disappear?

There are only three real causes.

**1. You ran `reset.sql`, or an old `schema.sql` that began with
`DROP DATABASE`.** This is by far the most common. Rebuilding the database
"just to be safe" is exactly what deletes the work.

**2. You are looking at a different database.** If `DB_NAME` in `.env` was
changed, the app is reading a different set of tables.

**3. The product was deactivated, not deleted.** Removed products are hidden
from the list but still exist. Tick "include inactive" or check in Workbench.

### How to tell which

Run this in MySQL Workbench:

```sql
SELECT COUNT(*) AS products, (SELECT COUNT(*) FROM pos_system.sales) AS sales
FROM pos_system.products;
```

- Zero, right after you added items → the database really was wiped. Cause 1.
- Your products are listed but the app shows none → the app is looking
  elsewhere, or the products are inactive. Cause 2 or 3.

### Backing up before a demo

Worth doing the night before. From a terminal:

```bash
mysqldump -u root -p pos_system > backup.sql
```

To restore it:

```bash
mysql -u root -p pos_system < backup.sql
```

Copy `backend/uploads/` alongside it, or your product photos will not come back.

---

## Using it on a phone or tablet

This is how you demo the cashier screen on a touch device.

### 1. Find your computer's IP address

**Windows** — in a terminal:

```bash
ipconfig
```

Look for your **Wi-Fi** adapter and read its `IPv4 Address` — something like
`192.168.1.14`. Ignore adapters named VMware, VirtualBox, Hyper-V or WSL; those
are virtual and other devices cannot reach them.

**Mac** — `ipconfig getifaddr en0`

### 2. Start both programs so they accept network connections

The backend already does. For the frontend:

```bash
npm run dev -- --host
```

Vite then prints a **Network:** address. That is the one to open on the tablet.

### 3. Make sure `VITE_API_URL` is not pinned to localhost

Open `frontend/.env`. If it says:

```env
VITE_API_URL=http://localhost:5000/api
```

put a `#` in front of it:

```env
# VITE_API_URL=http://localhost:5000/api
```

**Then stop the frontend (Ctrl+C) and start it again.** Changes to `.env` are
only read at startup — this is the step people miss.

**Why this matters:** `localhost` always means "this device". On your laptop it
points at your backend. On the tablet it points at the tablet, which is running
nothing. With the line commented out, the app looks for the backend on the same
address the page came from, which is your laptop.

### 4. If it still cannot connect

- Both devices must be on the **same wifi network**. Phone data will not work.
- Windows Firewall may block port 5000. When Node first ran, Windows probably
  asked whether to allow it — if you clicked Block, allow it in
  **Windows Defender Firewall → Allow an app**.
- Test the backend directly: on the tablet's browser open
  `http://YOUR-IP:5000/api/health`. If that fails, the problem is the network or
  firewall, not the app.

---

## Rules to avoid losing work

1. **Never commit `.env` to Git.** It has your database password. `.gitignore`
   already blocks it — leave that alone.
2. **Never commit `node_modules/`.** It is thousands of files and anyone can
   recreate it with `npm install`.
3. **Back up two things together:** a MySQL dump *and* the
   `backend/uploads/` folder. The database stores the path to each photo; the
   folder stores the photo itself. One without the other gives you a broken
   catalogue.
4. **Commit often, with real messages.** "added product delete" beats "update".

---

## Starting over

**`schema.sql` is safe to run as many times as you like.** It creates whatever
is missing and leaves your data alone.

To genuinely wipe everything and begin again:

1. Run `database/reset.sql` — this deletes the whole database.
2. Run `database/schema.sql` — rebuilds the tables, staff and categories.
3. Run `npm run seed:passwords` from the backend folder.

To clear test **sales** but keep your products and staff, open `reset.sql` and
run only the three lines at the bottom.
