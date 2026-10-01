# RapidPestHelp — Google Ads Landing Page

A conversion-first, static landing page built for Google Ads Search traffic
(lead generation by phone call and form submission).

## Files

```
quick-pest-services/
├── index.html                 # main landing page (hero + quote form + services + FAQ)
├── thank-you.html             # form confirmation page = Google Ads conversion page
├── css/styles.css             # mobile-first stylesheet, no frameworks, no web fonts
├── js/config.js               # ← THE ONE FILE TO EDIT (form endpoint lives here)
├── js/main.js                 # validation, submission, dataLayer events, access gate
├── server.js                  # production Node server (static site + /api/lead)
├── api/lead.js                # Vercel serverless function for POST /api/lead
├── lib/lead-handler.js        # shared backend: validation, origin/CORS, SMTP delivery
├── .env.example               # every environment variable, documented
├── assets/img/favicon.svg
└── assets/img/pest-control-technician.svg
```

Static front end plus a small Node backend that emails every lead to the
business inbox. `npm install && npm start` runs it locally; on Vercel the
`api/` function is picked up automatically.

## 1. Lead delivery backend (form → server → email)

The browser posts to the **relative** path `/api/lead` (`js/config.js`), so no
host name, Vercel URL or localhost is hardcoded anywhere — it works on the
final custom domain as soon as that domain serves this project.

```json
{
  "full_name": "...",
  "phone": "...",
  "email": "...",
  "zip": "...",
  "service": "Termite Control",
  "message": "..."
}
```

### Environment variables to set at deploy time

| Variable | Required | Purpose |
|---|---|---|
| `SMTP_HOST` | yes | SMTP server (`smtp.gmail.com` for Gmail) |
| `SMTP_PORT` | yes | `587` (STARTTLS) or `465` (implicit TLS) |
| `SMTP_USER` | yes | SMTP login — for Gmail, the full address |
| `SMTP_PASS` | yes | SMTP password — for Gmail use an **App Password**, not the account password |
| `LEAD_TO_EMAIL` | no | Lead inbox (defaults to `syedshahab9721@gmail.com`) |
| `LEAD_FROM_EMAIL` | no | From address (defaults to `SMTP_USER`, which Gmail requires) |
| `LEAD_FROM_NAME` | no | From display name (default `RapidPestHelp Website`) |
| `SMTP_SECURE` | no | `true` only for port 465; auto-detected otherwise |
| `ALLOWED_ORIGINS` | no | Comma-separated origins allowed to POST cross-origin. Leave empty when page + API share one domain (the normal case) |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | no | Per-IP throttling (default 8 requests / 10 min) |

Copy `.env.example` → `.env` for local development (`server.js` reads it).
`.env` is git-ignored; on Vercel/Render/Railway set the same names in the
platform dashboard. **No credential is ever sent to the browser.**

### Deployment options

- **Vercel** — deploy this folder as the project root: `api/lead.js` becomes
  `POST /api/lead` and the static files are served as-is. Add the variables
  above under Project → Settings → Environment Variables.
- **Any Node host** — `npm install && npm start`; `server.js` serves the pages
  and the API from one origin. Add the same variables in the platform env.

### Behaviour

- Same-origin requests always pass; a cross-origin request is only accepted if
  its origin is listed in `ALLOWED_ORIGINS` (otherwise `403` with no CORS
  headers). Preflight `OPTIONS` is handled.
- Server-side validation returns `422` with per-field errors.
- The `200` response is sent **only after the SMTP server accepts the email**.
  SMTP failures return `502` and the visitor sees an error with the phone
  number instead of a false confirmation.
- Missing SMTP credentials return `503` and are logged — never a fake success.
- Emails are plain-text + HTML with all form fields, and `Reply-To` set to the
  visitor so the business can reply directly.

Verified end to end: browser form submit → `POST /api/lead` → real SMTP
transaction → accepted message containing every field → client-side redirect
to `/thank-you.html`; plus the failure mode (SMTP unavailable → error message,
no redirect, button re-enabled).

## 2. Install Google Ads tracking

Nothing is invented in this codebase — no tag ID, conversion ID, label or GTM
container exists yet. Every page carries marked placeholders:

**In `<head>` of `index.html` and `thank-you.html`:**

```html
<!-- GOOGLE ADS TAG WILL BE INSERTED HERE -->
```

Paste the real `gtag.js` snippet there (the same one on both pages).

**In `<head>` of `thank-you.html` — this is the conversion page:**

```html
<!-- GOOGLE ADS CONVERSION EVENT WILL BE INSERTED HERE -->
```

Paste the conversion event snippet Google Ads generates for the conversion
action, e.g. `gtag('event', 'conversion', { send_to: 'AW-.../...' })` with the
real values from the client's account.

**Site-wide events** (`index.html` head) use the marker
`GOOGLE ADS CONVERSION EVENT WILL BE INSERTED HERE (site-wide)`.

### dataLayer events already wired

`js/main.js` pushes clean events — no PII in them:

```js
dataLayer.push({ event: 'form_submission', form_name: 'quote_request_form',
                 service_selected: 'Termite Control', form_location: 'hero' });

dataLayer.push({ event: 'phone_click', phone_number: '+18449372204',
                 cta_location: 'hero' });   // header | hero | faq | final_cta |
                                            // sticky_bar | thank_you | footer
```

Every `tel:` link carries `data-cta-location`, so phone-click tracking can be
switched on from Google Ads or GTM later **without touching any markup**.

## 3. Thank-you page behaviour

- Reachable only after a successful form submission: `main.js` sets a
  `sessionStorage` flag on submit and bounces direct visits back to `index.html`
  (it fails open if storage is blocked, so a real conversion is never lost).
- No meta refresh, no automatic redirect away from the page after submission.
- No form on the page, `noindex, nofollow`, and it stays clean for the
  page-load conversion.
- Add `<link rel="canonical">` and `og:image` (absolute `https://` URLs) once
  the production domain exists — placeholders are commented in the `<head>`.

## Testing checklist

Run the real stack (a plain static file server would leave `/api/lead`
unavailable):

```bash
cd quick-pest-services
npm install
cp .env.example .env    # then fill in real SMTP values
npm start               # http://localhost:3000
```

1. `http://localhost:3000/` loads with no console errors.
2. Desktop and mobile layouts (mobile gets a sticky Call / Get a Quote bar).
3. Every CTA works: "Get a Quote" scrolls to the form, all phone buttons
   dial `tel:+18449372204`.
4. Submitting the empty form shows inline field errors and does not navigate.
5. Invalid email / phone / ZIP are rejected; valid data returns `POST /api/lead → 200`
   and redirects to `/thank-you.html` — and the lead arrives in `LEAD_TO_EMAIL`.
6. Opening `thank-you.html` directly in a new tab returns you to `index.html`.
7. `thank-you.html` after a real submission shows the confirmation + Call Now.
8. With SMTP misconfigured, the form shows the error banner and stays on the
   page — it must never show a success that was not delivered.

## Deployment notes

- **Vercel:** deploy the `quick-pest-services` folder as the project root
  (static files + `api/lead.js`), then add the environment variables.
- **Any Node host (Render, Railway, Fly, VPS):** `npm install && npm start`,
  add the same environment variables.
- A **static-only** host (Netlify without functions) cannot deliver email —
  pair it with the `server.js` backend instead.
- The repository root also contains other, unrelated client sites — do not
  publish the repository root for this project.
