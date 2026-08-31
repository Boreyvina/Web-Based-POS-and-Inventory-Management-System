# POS & Inventory — Frontend

React 18 + Vite + Tailwind CSS + Chart.js.

## Setup

```bash
npm install
cp .env.example .env     # point VITE_API_URL at your backend
npm run dev              # http://localhost:5173
```

The backend must be running first (`cd ../backend && npm run dev`).

To open the till on a phone or tablet on the same wifi:

```bash
npm run dev -- --host
```

then browse to the printed network address. Set `VITE_API_URL` to your
computer's LAN IP (not `localhost`) so the tablet can reach the API.

## Structure

```
src/
├── api/            axios client (token interceptor) + one function per endpoint
├── context/        AuthContext — who is signed in
├── components/
│   ├── ui/         Button, Field, Modal, Toast, Feedback primitives
│   ├── charts/     Chart.js registration + the four chart components
│   ├── Layout.jsx  sidebar (desktop) / bottom bar (tablet)
│   └── ProtectedRoute.jsx
├── pages/
│   ├── Login.jsx
│   └── admin/      Dashboard, Products, and the product/stock/category modals
└── utils/format.js money, number and date formatting
```

## Design decisions

- **Figures are monospace with tabular numerals** (`.tnum`). Prices, totals and
  stock counts line up in columns, which is what makes a price list scannable.
- **Navigation is a sidebar on desktop and a bottom bar on tablet.** A cashier
  holding a tablet reaches the bottom of the screen, not the top left.
- **Tap targets are 44px minimum** (`size="lg"` buttons are 56px) for touch use.
- **One accent colour.** Teal for actions, amber for reorder warnings, red for
  destructive. Nothing else is coloured, so a warning actually reads as one.

## Product photos

`ImageUpload` sends the file to the backend the moment it is chosen, then keeps
the returned path in form state. Uploading on selection rather than on save
means the preview you see is the file that actually reached the server.

The camera opens directly on phones (`capture="environment"`), so stock can be
photographed while it is being entered. Drag-and-drop works on desktop.

Images are stored as relative paths and resolved against the API origin by
`utils/image.js`, so moving the backend to a real domain needs no data changes.

## Routes

| Path | Who | Screen |
|---|---|---|
| `/login` | anyone | Sign in |
| `/shop` | anyone | Guest product list *(stage 4)* |
| `/admin` | admin | Dashboard |
| `/admin/products` | admin | Product CRUD, stock, categories |
| `/admin/sales` | admin | All transactions *(stage 4)* |
| `/admin/reports` | admin | Reports + export *(stage 4)* |
| `/cashier` | cashier | Checkout *(stage 4)* |
| `/cashier/sales` | cashier | Own sales *(stage 4)* |
| `/cashier/products` | cashier | Read-only catalogue *(stage 4)* |

`ProtectedRoute` hides pages a role cannot use. That is convenience only — the
backend re-checks the role on every request, and that is what actually protects
the data.
