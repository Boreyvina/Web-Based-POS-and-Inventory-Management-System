# Hosting this on Vercel

Read this before you start. Vercel can host most of this system, but not all of
it, and knowing which parts up front will save you an evening.

---

## What Vercel can and cannot do

| Part | On Vercel | Notes |
|---|---|---|
| Frontend (React) | Yes, easily | This is exactly what Vercel is for |
| Backend (Express) | Yes, with one change | Runs as a serverless function |
| MySQL database | **No** | Vercel does not host databases. You need one elsewhere |
| Product photo uploads | **No, not as written** | See the section below |

The config files are already in the project: `backend/vercel.json`,
`frontend/vercel.json` and `backend/api/index.js`.

---

## The upload problem, explained

This is the part that surprises people, so it is worth understanding rather
than working around blindly.

Your backend currently saves product photos to `backend/uploads/products/`.
That works on your laptop because your laptop has a disk that stays put.

**A Vercel function has no disk that stays put.** It starts up, answers a
request, and disappears. Anything written to a file vanishes with it, and the
next request may well be answered by a completely different instance that never
saw your file. So uploads will appear to work and then the images will 404.

You have three honest options.

### Option A — do not deploy uploads (simplest)

Deploy the system without photo upload, and use the image URL field with images
hosted elsewhere. Everything else works. For a project demo this is often
enough, and it is defensible: "file storage needs a service Vercel does not
provide, so it is out of scope for this deployment."

### Option B — use a storage service

Vercel Blob, Cloudinary, Amazon S3, or similar. Instead of writing to disk, the
upload endpoint sends the file to the service and stores the returned URL. It is
about thirty lines of change in `upload.controller.js` and `config/upload.js`.

Ask me and I will write it — say which service you have signed up for.

### Option C — host the backend somewhere with a real disk

Railway, Render or Fly.io run your Express app as an ordinary long-lived
program, disk and all, with no code changes. Frontend on Vercel, backend there.

**This is what I would suggest.** Your app is written as a normal server, and
running it as one avoids both the upload problem and the connection limits
described below.

---

## Step 1 — a hosted MySQL database

You need a MySQL database on the internet. Options that have had free tiers:
Aiven, Railway, TiDB Cloud, Clever Cloud. Check what they currently offer, as
free tiers change often.

Whichever you pick, you will get four values: a host, a port, a username and a
password.

Then load your schema into it:

```bash
mysql -h YOUR_HOST -P YOUR_PORT -u YOUR_USER -p YOUR_DB < database/schema.sql
```

If the host blocks command-line access, most providers have a web console where
you can paste the contents of `schema.sql` instead.

Then create the admin password. The seeding script reads the same `.env`, so
point it at the hosted database temporarily and run:

```bash
cd backend && npm run seed:passwords
```

**Two settings you will need in production:**

```env
DB_SSL=true        # hosted databases require an encrypted connection
DB_POOL_SIZE=2     # see the warning below
```

### The connection limit warning

Free database tiers often allow only 5–20 connections at once. Each Vercel
function instance opens its own pool, and Vercel may run many instances. Ten
instances with a pool of ten each is a hundred connections, and your database
will start refusing them.

`DB_POOL_SIZE=2` keeps this under control. The code already defaults to 2 when
it detects it is running on Vercel.

---

## Step 2 — deploy the backend

1. Push the project to GitHub. Check that `.env` is **not** in the repository —
   `.gitignore` already excludes it, but look before you push.
2. In Vercel, **Add New → Project**, pick your repository.
3. Set **Root Directory** to `backend`.
4. Under **Environment Variables**, add every value from your `.env`:

   | Name | Value |
   |---|---|
   | `DB_HOST` | your database host |
   | `DB_PORT` | usually 3306 |
   | `DB_USER` | your database user |
   | `DB_PASSWORD` | your database password |
   | `DB_NAME` | your database name |
   | `DB_SSL` | `true` |
   | `DB_POOL_SIZE` | `2` |
   | `JWT_SECRET` | a fresh long random string, **not** the one from your laptop |
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | your frontend URL, added after step 3 |
   | `STORE_NAME`, `STORE_ADDRESS`, `STORE_PHONE`, `CURRENCY` | your shop details |

5. Deploy, then open `https://your-backend.vercel.app/api/health`. You should
   see the API responding. If it fails, the Vercel **Logs** tab shows why —
   usually a wrong database value.

**Generate a new JWT_SECRET for production.** If your development secret ever
appeared in a screenshot or a commit, anyone with it can forge an admin token.

---

## Step 3 — deploy the frontend

1. **Add New → Project** on the same repository again.
2. Set **Root Directory** to `frontend`.
3. Add one environment variable:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-backend.vercel.app/api` |

4. Deploy.

Then go back to the **backend** project, set `CLIENT_URL` to your frontend's
address, and redeploy it so CORS accepts the requests.

> Note: `VITE_` variables are read at build time, not run time. Changing one
> means redeploying the frontend, not just restarting it.

---

## Step 4 — check it properly

Do not just load the home page. Walk through the things that touch the database:

1. Sign in as admin.
2. Add a category and a product.
3. Ring up a sale on the till.
4. Open Reports and confirm the sale is there.
5. Receive a delivery on an order and check the batch appears.

If sign-in works but everything else fails, it is almost always `CLIENT_URL`
and CORS. If nothing works at all, it is the database connection.

---

## Things that behave differently once deployed

**Cold starts.** A function that has not been used for a while takes a second
or two to wake up. The first request after a quiet period feels slow. This is
normal for serverless and worth mentioning if an examiner notices.

**The customer display still works**, because it uses a browser feature rather
than the server.

**Receipt printing still works** — it is the browser's print function.

**QR payments still work**, since the code is generated from settings.

**Uploads do not.** See the section at the top.

---

## Before you demo from a deployed site

**Have a local fallback ready.** Conference wifi fails, free tiers sleep, and a
deployment that worked last night can be down at 9am. Bring the project running
on your laptop as a backup and you will never need it.

Do not delete your local database once you deploy. Keep both.
