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

## API (so far)

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/catalogue` | Product catalogue, optionally with eligibility for a business profile |
| POST | `/api/quote` | Monthly and one-time price for a bundle, with eligibility and dependency checks |
| GET | `/api/lookup/gstin/:gstin` | Mock GSTIN lookup (format, checksum and registry status) |
| GET | `/api/lookup/udyam/:udyam` | Mock Udyam lookup |

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
