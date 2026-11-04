## 🚀 Live Demo

**[Open UdyamSaathi →](https://udyamsaathi-jl5n.onrender.com/start)**

Deployed on Render. Explore the Advisor, Quote and Smart KYC onboarding experience.

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
- CSV-backed mock registries and catalogue in `data/`
- Vitest for unit tests

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test
```

### With Docker

```bash
docker compose up --build    # http://localhost:3000
```

Orders, services and follow-ups are kept in a Docker volume (`udyam-data`), so they survive restarts. Settings come from `.env.local` if it exists.

## Screens

| Route | What the owner does |
| --- | --- |
| `/start` | Chat with the advisor (English or Hindi), get a bundle, tune it on the quote screen, finish KYC, place the order |
| `/track/:orderId` | Follow installation and activation without calling support; updates live as Accel works on the order |

## Accel back office (`/admin`)

Sign in with `ADMIN_PASSCODE` (default `accel-demo`).

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

## How the pieces fit

- **Advisor**: recommendations come from deterministic rules grounded in what the 368 activated leads bought per segment, so the same answers always give the same bundle. The LLM only does what it is good at: understanding free text and explaining the bundle in the owner's language. Prices always come from the quote engine, never from the model.
- **Smart KYC**: documents are read on the phone with tesseract.js (engine and language data are self-hosted). Only the extracted text goes to the server, where it is matched against the GST and Udyam registries and across documents. On the 12 specimen applicants it catches a cancelled GSTIN, unreadable photos, a missing Udyam certificate, a missing Udyam number, GSTINs that fail the checksum, an edited legal name and an address proof older than 90 days.
- **Orders and tracker**: orders are priced again on the server (the client's numbers are never trusted) and stored with an event log. Every change Accel makes is an event, and the owner's tracker polls for them.
- **Lead score**: a logistic regression trained on the quarter's leads at start-up (about half a second). On held-out leads it reaches an AUC of 0.72; the top 10% it ranks convert at about twice the average rate. Each score comes with the two factors that raised it most.
- **Storage**: a JSON file behind a small store module (`lib/store.ts`). Everything goes through that module, so it can move to Postgres without touching routes or screens.

## LLM

Set `LLM_PROVIDER` (gemini, groq, openai or anthropic) and `LLM_API_KEY` in `.env.local`. Without a key everything still works on rules. Open `/api/llm-status` to check the key and model are working.

## Data

| File | What it is |
| --- | --- |
| `data/product_catalogue.csv` | 25 products with prices, setup fees, contracts, eligibility rules and dependencies |
| `data/smb_leads.csv` | 5,000 leads for one quarter, with funnel stage and outcomes |
| `data/mock_gstin_registry.csv` | Mock GST registry backing the GSTIN lookup |
| `data/mock_udyam_registry.csv` | Mock Udyam registry backing the Udyam lookup |

## Privacy

Identifiers are treated as if they were real: only what each step needs is collected, identifiers are masked in logs and API responses, and KYC starts only after an explicit consent screen.

## Team

- Gursimar Singh
- Shreyash Gupta
