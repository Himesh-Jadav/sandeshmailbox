# AGENTS.md — PhoneMail

You are working on **PhoneMail**, a phone-number-as-email webmail app built
for a 7-day hackathon (Alphastack Buildathon). Full spec:
`docs/phonemail-prd.md` in this repo (copy the published PRD into this path
before starting).

## Current phase — read this before doing anything else

We are building **one milestone at a time**. Right now:

**IN SCOPE:**
- Web-only account creation (Door A: phone → OTP → set password)
- Password-based login for returning users (OTP is only for initial setup,
  never for regular login)
- A protected "inbox shell" page the user lands on after login — layout and
  routing only, no real mail yet

**OUT OF SCOPE — do not build yet, do not stub with TODOs that suggest it's
next, do not add routes/fields for it "to save time later":**
- IVR (Door B) and SMS-keyword (Door C) signup
- The actual SMTP server (`smtp-server`/`mailparser`/`nodemailer`)
- Compose, reply, threads, attachments, aliases
- End-to-end encryption (tweetnacl)

Stay inside current-phase scope even if the PRD describes later phases in
detail. Ask before expanding scope rather than building ahead.

## Repo structure

```
/backend
  /src
    /models        # Mongoose schemas
    /routes         # Express route handlers, one file per resource
    /services       # Twilio, business logic — no Express req/res here
    /middleware
    index.js
  /migrations       # migrate-mongo files — see "Database changes" below
  migrate-mongo-config.js
  .env.example
  package.json
/frontend
  /src
    /pages
    /components
    /lib            # api client, react-query setup
  package.json
/docs
  phonemail-prd.md
AGENTS.md
```

Backend and frontend are separate npm projects with their own
`package.json` — no shared root package.json, no monorepo tooling. Keep it
simple for a 7-day build.

## Stack (this phase only)

**Backend:** Express, mongoose, migrate-mongo, bcrypt, jsonwebtoken,
libphonenumber-js, zod, twilio SDK, dotenv, cors, pino.
**Frontend:** React + Vite + TypeScript, Tailwind, react-router-dom,
@tanstack/react-query, react-hook-form + zod resolvers.

Do not add `smtp-server`, `mailparser`, `nodemailer`, `tweetnacl`, `multer`,
or `socket.io` yet — those belong to later phases per the PRD.

## Conventions

- ES modules (`type: module` in package.json), `async/await` everywhere,
  no callback-style code.
- Every request body validated with `zod` before it touches a service or
  model. Reject with 400 + the zod error, don't let bad input reach Mongo.
- No secrets in code, ever — everything sensitive comes from `.env`, and
  `.env.example` must be kept in sync (keys present, values blank/placeholder).
- Routes stay thin: parse + validate input → call a service function →
  shape the response. Business logic (Twilio calls, password hashing,
  token issuance) lives in `/services`, not in route handlers, so it can
  be unit-tested without spinning up Express.
- Store `phone` as full E.164 everywhere in the backend and DB. Only strip
  the country code when generating a display address, via one shared util
  — never duplicate that string-slicing logic.

## Environment variables (.env.example must list all of these)

```
MONGODB_URI=
JWT_SECRET=
MAIL_DOMAIN=phonemail.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

(Twilio phone number, textbee, and SMTP-related vars are not needed until
the IVR/SMS/SMTP phases — don't add them to `.env.example` yet, it signals
scope that isn't real yet.)

## API contract — this phase

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/check` | `{ phone }` | `{ exists, hasSetPassword }` |
| POST | `/api/auth/otp/start` | `{ phone }` | `{ success: true }` |
| POST | `/api/auth/otp/verify` | `{ phone, code }` | `{ setupToken }` on success |
| POST | `/api/auth/set-password` | `{ setupToken, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ phone, password }` | `{ token, user }` |
| GET | `/api/me` | (Bearer token) | `{ user }` — protected route test |

`setupToken` is a short-lived JWT (10 min, `{ phone, scope: 'set-password' }`)
issued right after OTP verification. It proves "this phone was just
OTP-verified" so `/set-password` doesn't need the OTP resent. Reject it if
expired or `scope` doesn't match.

## Database changes — migrations, not ad-hoc schema edits

Use **migrate-mongo**, not direct Mongoose schema changes applied by hand.
Every schema-affecting change (new collection, new field, new index) is its
own migration file under `/backend/migrations`, with `up` and `down`.

Why: migrate-mongo tracks applied migrations in a `changelog` collection in
Mongo itself. If something breaks, you can see exactly which migration ran
last and which one is pending — so a DB-related error points at a specific,
named file and a specific stage, not "somewhere in the schema." Run with
`npx migrate-mongo up` / `down`; never hand-edit collections outside a
migration once the User model exists.

Naming: `YYYYMMDDHHmmss-short-description.js` (migrate-mongo generates this
timestamp prefix automatically via `npx migrate-mongo create <description>`
— always use that command, don't hand-name files).

## Models — this phase

Only `User` exists this phase:

```js
{
  phone: String,              // unique, E.164
  passwordHash: String | null,
  hasSetPassword: Boolean,
  createdVia: 'web' | 'ivr' | 'sms',  // always 'web' this phase
  aliasIds: [String],         // present in schema, unused this phase
  displayName: String,
  profilePictureUrl: String | null,
  publicKey: String | null,   // present in schema, unused this phase
  createdAt: Date
}
```

`Thread` and `Message` models are NOT created this phase — they belong to
the SMTP phase. Don't scaffold them "for later."

## Debugging expectations

When something fails, report: which route/service function, which
migration state (`npx migrate-mongo status` output), and the actual error
— not just "auth isn't working." This repo is small enough that vague
failure reports are avoidable.