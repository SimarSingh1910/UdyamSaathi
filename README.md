## 🚀 Live Demo

**[Open UdyamSaathi →](https://udyam-saathi-henna.vercel.app/)**

Deployed on Vercel. Explore the Advisor, Quote and Smart KYC onboarding experience.

## 👥 Team Outliers

- Shreyash Gupta
- Gursimar Chauhan

**Netaji Subhas University of Technology (NSUT)**

# UdyamSaathi

A digital-first acquisition and onboarding journey that lets a small business owner discover the right Accel Business bundle, buy it and get it activated, on a phone and in their preferred language.

Built for **YTL Hackathon 2026, Enterprise Track A: Project Udyam Digital**. All businesses, people, identifiers and figures in `data/` are synthetic and fictional.

## Journey

1. **Advisor**: a conversational assistant asks about the business (type, size, sites, current setup) and recommends a bundle from the catalogue, explaining why in plain language.
2. **Quote and checkout**: one transparent monthly price, with add-ons the owner can toggle.
3. **Smart KYC**: GSTIN and Udyam lookups, document upload with extraction and validation, and a clear consent screen.
4. **Tracker**: an order status view the owner can check instead of calling support.

## Tech

- Next.js (App Router) + TypeScript, one app for the mobile UI and the API routes
- PostgreSQL with Drizzle ORM (an embedded PostgreSQL, PGlite, when no server is configured)
- CSV-backed mock registries and the starting catalogue in `data/`
- Vitest for unit tests

## Getting started

```bash
npm install
cp .env.example .env.local   # set UDYAM_ENCRYPTION_KEY (openssl rand -hex 32)
npm run dev        # http://localhost:3000
npm test
```

With no `DATABASE_URL`, the app runs on an embedded PostgreSQL stored in `.data/pglite`, so nothing else needs installing. To use a PostgreSQL server (local, Neon, Supabase, Render), set `DATABASE_URL`; tables are created on start.

### With Docker

```bash
docker compose up --build    # http://localhost:3000
```

This starts the app and a PostgreSQL 17 container; data lives in the `udyam-pg` volume and survives restarts. Settings come from `.env.local` if it exists (set `UDYAM_ENCRYPTION_KEY` there, and `POSTGRES_PASSWORD` for anything beyond local use).

### Demo mode

`DEMO_MODE` (on in development, off in production unless set to `1`) turns the app into an evaluator-friendly demo:

- The home page (`/`) has two cards: **I run a business** opens `/start`; **I work at Accel** shows the back-office passcode (masked, with an eye to reveal it) and signs straight in.
- Phone checks still send the real code, but the fixed code `123456` (`PHONE_DEMO_CODE`) is also accepted.
- The back office starts with 8 sample orders at different stages, 2 help requests and 3 lead follow-ups (added once per database).

Never use it for a real launch: the passcode is on a public page and anyone can pass the phone check.

## Screens

| Route | What the owner does |
| --- | --- |
| `/` | Demo home: choose the business owner or the Accel staff side |
| `/start` | Chat with the advisor (English or Hindi), get a bundle, tune it on the quote screen, finish KYC, place the order |
| `/track/:orderId` | Follow installation and activation without calling support; updates live as Accel works on the order |

## WhatsApp

The whole `/start` journey also runs as a WhatsApp chat: advisor (typed or voice notes), bundle with buttons to switch products on or off, consent, KYC from document photos, contact, phone check and order, plus `STATUS`, `START OVER`, `LANGUAGE`, `STOP` and a hand-off to a person at any point. It uses the same rules, quote engine, KYC checks and order store as the web app (`lib/whatsapp/bot.ts`).

- **Without credentials (demo mode)**: open `/whatsapp` for a simulator that talks to the real bot. Type `hi`, and `SAMPLE K08` at the KYC step to use a specimen applicant.
- **Going live**: create a Meta app with the WhatsApp product, fill in the `WHATSAPP_*` settings in `.env.local`, and register `https://<your-host>/api/whatsapp/webhook` (with `WHATSAPP_VERIFY_TOKEN`), subscribed to `messages`. Webhooks are rejected unless they carry a valid signature from `WHATSAPP_APP_SECRET`. Set `PUBLIC_BASE_URL` so order messages include a tracking link.
- Document photos sent on WhatsApp are read on the server (the same tesseract.js engine as the browser), in memory, and dropped; the extracted text is held in memory for at most 30 minutes and never written to the store.

## Phone verification

Before anyone calls a number, the owner proves it is theirs and chooses how:

| Method | How it works | Needs |
| --- | --- | --- |
| SMS code | 6-digit code by text message, delivered by 2Factor.in | `TWOFACTOR_API_KEY` + `TWOFACTOR_SMS_TEMPLATE` (approved DLT template) |
| Voice-call code | An automated call reads the 6-digit code out, delivered by 2Factor.in | `TWOFACTOR_API_KEY` |
| WhatsApp code | Sent with an approved authentication template | WhatsApp Cloud API settings and `WHATSAPP_OTP_TEMPLATE` |
| Missed call (optional) | Owner rings `MISSED_CALL_NUMBER`; the provider calls `/api/verify/missed-call?secret=…` with the caller's number | `MISSED_CALL_NUMBER`, `MISSED_CALL_WEBHOOK_SECRET` |

Codes are generated and checked by the app (providers only deliver them): each lasts 10 minutes and allows 5 tries. A number can start 3 checks per 10 minutes, and one IP 10 per hour. The web form gets a 30-minute signed token that `/api/orders` and `/api/requests` require. On WhatsApp, the chat's own number counts as verified; a different number goes through the same check. Without providers, demo mode shows the code on screen (on in development; set `PHONE_VERIFY_DEMO=1` for a hosted demo). In production with neither a provider nor demo mode, no method is available and orders can't be placed.

## Accel back office (`/admin`)

Sign in with `ADMIN_PASSCODE` (default `accel-demo`); in demo mode the home page signs you in.

| Page | What Accel staff do |
| --- | --- |
| Orders | See every customer's order and status, filter by stage, book installation (date and engineer), update each product, add notes the customer sees, cancel. Headline metrics sit next to the Apr–Jun baseline |
| Leads & requests | Owners who asked for help during KYC, plus leads that dropped out last quarter ranked by a lead score; assign to a partner and record the outcome |
| Services | Add, edit, hide or delete products, prices and eligibility rules; the advisor and quote use the change straight away |

Phone numbers are masked in the back office; revealing one is written to the order's history.

## API

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/advisor/parse` | Understands a free-text description of the business (LLM, with a keyword fallback that also handles Hindi) |
| POST | `/api/advisor/recommend` | Recommends a bundle with a reason per product, prices it and writes a plain-language pitch |
| GET | `/api/catalogue` | Product catalogue, optionally with eligibility for a business profile |
| POST | `/api/quote` | Monthly and one-time price for a bundle, with eligibility and dependency checks |
| POST | `/api/kyc/verify` | Checks OCR text from the 4 KYC documents against each other and the registries (needs consent) |
| GET | `/api/lookup/gstin/:gstin` | Mock GSTIN lookup (format, checksum and registry status) |
| GET | `/api/lookup/udyam/:udyam` | Mock Udyam lookup |
| GET | `/api/verify` | Which phone checks are available (live, demo or off) |
| POST | `/api/verify/start` | Starts a WhatsApp-code or missed-call check |
| POST | `/api/verify/check` | Checks a WhatsApp code and returns a phone token |
| GET | `/api/verify/status` | Polled while waiting for a missed call; returns the token once it arrives |
| GET/POST | `/api/verify/missed-call` | Webhook for the missed-call provider |
| GET/POST | `/api/whatsapp/webhook` | Meta webhook: registration check and incoming messages |
| GET/POST | `/api/whatsapp/simulate` | Demo-mode simulator backend (off when WhatsApp is connected) |

## How the pieces fit

- **Advisor**: recommendations come from deterministic rules grounded in what the 368 activated leads bought per segment, so the same answers always give the same bundle. The LLM only does what it is good at: understanding free text and explaining the bundle in the owner's language. Prices always come from the quote engine, never from the model.
- **Smart KYC**: documents are read on the phone with tesseract.js (engine and language data are self-hosted). Only the extracted text goes to the server, where it is matched against the GST and Udyam registries and across documents. On the 12 specimen applicants it catches a cancelled GSTIN, unreadable photos, a missing Udyam certificate, a missing Udyam number, GSTINs that fail the checksum, an edited legal name and an address proof older than 90 days.
- **Orders and tracker**: orders are priced again on the server (the client's numbers are never trusted) and stored with an event log. Every change Accel makes is an event, and the owner's tracker polls for them.
- **Lead score**: a logistic regression trained on the quarter's leads at start-up (about half a second). On held-out leads it reaches an AUC of 0.72; the top 10% it ranks convert at about twice the average rate. Each score comes with the two factors that raised it most.
- **Storage**: PostgreSQL through Drizzle ORM. Routes and screens only call the store module (`lib/store.ts`); tables are in `lib/db/schema.ts`. Order and lead updates lock the row, so two staff edits can't overwrite each other, and code checks count every attempt even when guesses arrive at once.

## LLM

Set `LLM_PROVIDER` (gemini, groq, openai or anthropic) and `LLM_API_KEY` in `.env.local`. Without a key everything still works on rules. Open `/api/llm-status` to check the key and model are working.

## Data

| File | What it is |
| --- | --- |
| `data/product_catalogue.csv` | 25 products with prices, setup fees, contracts, eligibility rules and dependencies |
| `data/smb_leads.csv` | 5,000 leads for one quarter, with funnel stage and outcomes |
| `data/mock_gstin_registry.csv` | Mock GST registry backing the GSTIN lookup |
| `data/mock_udyam_registry.csv` | Mock Udyam registry backing the Udyam lookup |

## Database

| Setting | Database |
| --- | --- |
| `DATABASE_URL` set | That PostgreSQL server (add `?sslmode=require` for hosted ones) |
| Not set | Embedded PostgreSQL (PGlite) in `.data/pglite`; tests use an in-memory one |

- **Migrations**: SQL files in `drizzle/`, applied automatically on start. After changing `lib/db/schema.ts`, run `npm run db:generate` and commit the new file. `npm run db:studio` opens a data browser.
- **First start**: an empty database is filled once, from an existing `.data/store.json` if there is one (the JSON store used before PostgreSQL; the file is left untouched), otherwise with the catalogue from `data/product_catalogue.csv`.
- **Encryption**: phone numbers and WhatsApp conversations are encrypted per value with AES-256-GCM using `UDYAM_ENCRYPTION_KEY`; phone checks keep only a keyed hash. Keep the key safe: without it these values can't be read.

## Privacy

Identifiers are treated as if they were real: only what each step needs is collected, identifiers are masked in logs and API responses, and KYC starts only after an explicit consent screen.

## Team

- Gursimar Singh
- Shreyash Gupta
