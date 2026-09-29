<p align="center">
  <img src="https://img.shields.io/badge/संदेश-Sandesh-FF6B35?style=for-the-badge&labelColor=1a1a2e&logoColor=white" alt="Sandesh Badge" height="40"/>
</p>

<h1 align="center">📬 Sandesh — Phone-Number-Based Email</h1>

<p align="center">
  <strong>Your phone number is your email address.</strong><br/>
  A privacy-first, self-hosted webmail platform where <code>9876543210@sandesh.in</code> is a real, working inbox.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/MongoDB-7.0-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/SMTP-Self--Hosted-FF6B35?style=flat-square" alt="SMTP"/>
  <img src="https://img.shields.io/badge/E2EE-TweetNaCl-8B5CF6?style=flat-square" alt="E2EE"/>
  <img src="https://img.shields.io/badge/License-Private-gray?style=flat-square" alt="License"/>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-environment-variables">Environment</a> •
  <a href="#-project-structure">Structure</a>
</p>

---

## 🎯 What is Sandesh?

**Sandesh** (संदेश — Hindi for "message") is a full-stack webmail platform that transforms phone numbers into fully functional email addresses. Instead of registering a traditional email, users simply use their phone number — `+919876543210` becomes `9876543210@sandesh.in`.

The platform features a **self-implemented SMTP server** (no third-party email SaaS like SendGrid, Mailgun, or AWS SES), **client-side end-to-end encryption**, **AI-powered features**, and three distinct signup channels (Web OTP, Voice IVR, and SMS).

> Built for the **Alphastack Buildathon** — a 7-day hackathon by a team of 3.

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git

### One-Command Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd sandesh

# 2. Copy environment template
cp .env.example .env

# 3. Build and start the entire stack
docker compose up --build

# 4. Open in your browser
#    🌐 Frontend:  http://localhost:3000
#    🔌 API:       http://localhost:5000/api/health
```

> **Demo accounts** are automatically seeded on first run:
>
> | Account | Phone | Password | Email Address |
> |---------|-------|----------|---------------|
> | Alice Sharma | `+919876543210` | `password123` | `9876543210@sandesh.in` |
> | Bob Verma | `+919876543211` | `password123` | `9876543211@sandesh.in` |

---

## ✨ Features

### 📧 Core Email System
- **Self-hosted SMTP Server** — Real RFC 5321 compliant mail daemon running on port 2525, using `smtp-server`, `mailparser`, and `nodemailer`. Zero external email SaaS dependencies.
- **Gmail-style Inbox** — Three-pane layout with sidebar navigation, thread list, and message view. Compose, reply, forward, and manage conversations.
- **Threaded Conversations** — Messages are automatically grouped into conversational threads with chronological message history.
- **File Attachments** — Upload and send files up to 20 MB. Attachments are stored via MongoDB GridFS with streaming download/inline preview support.
- **Real-time Sync** — Inbox auto-refreshes every 3 seconds via React Query polling for near-instant message delivery visibility.

### 🔐 Security & Privacy
- **End-to-End Encryption (E2EE)** — Client-side encryption using `tweetnacl` (Curve25519 key exchange + XSalsa20-Poly1305 authenticated encryption). The server never sees plaintext message bodies.
- **Client-Side Key Generation** — Keypairs are generated in the browser. Private keys never leave the device (stored in IndexedDB/localStorage).
- **Password Security** — Passwords hashed with `bcrypt` (10 salt rounds). Passwords never travel over SMS or voice calls.
- **JWT Authentication** — Stateless session management with signed JSON Web Tokens.

### 📱 Three Signup Doors
| Door | Channel | How It Works |
|------|---------|-------------|
| 🌐 **Web + OTP** | Website | Enter phone → receive OTP via SMS → set password → inbox ready |
| 📞 **Voice IVR** | Phone Call | Call the Telnyx number → press 1 → skeleton account created → finish setup on web |
| 💬 **SMS Keyword** | Text Message | Text `SIGNUP` to the linked number → skeleton account created → finish setup on web |

All three doors converge on the same `User` collection, keyed by normalized E.164 phone number.

### 🤖 AI-Powered Features
- **AI Email Drafting** — Compose emails with AI assistance powered by Groq (Qwen 3.8-27B model).
- **Spam Detection** — Intelligent spam filtering using LLM-based content analysis with a comprehensive evaluation suite.
- **FAQ Chatbot** — In-app AI chatbot for user support and frequently asked questions.

### 🎨 User Experience
- **Sandesh Design Language** — Custom-built UI with Tailwind CSS, Framer Motion animations, and Lucide icons.
- **Profile Management** — Editable display names, avatar uploads, and public key management.
- **Search & Filter** — Real-time thread search with instant filtering across all conversations.
- **Responsive Layout** — Foldable sidebar, adaptive panels, and mobile-friendly design.
- **Email Templates** — Pre-built email templates for common communication patterns.

---

## 🏗 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Compose Stack                       │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │    frontend       │  │    backend        │  │    mongo      │  │
│  │  (Nginx → :80)    │─▶│  (Express → :5000)│─▶│  (Mongo 7.0) │  │
│  │  Host → :3000     │  │  (SMTP   → :2525) │  │  :27017      │  │
│  └──────────────────┘  │  uploads volume    │  │  data volume  │  │
│                         └──────────────────┘  └──────────────┘  │
│                                                                 │
│                     sandesh-network (bridge)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Mail Flow Architecture

```
Compose Email ──▶ POST /api/mail/send ──▶ nodemailer (localhost:2525)
                                                │
                                    ┌───────────▼───────────┐
                                    │  Self-Hosted SMTP      │
                                    │  Server (port 2525)    │
                                    │                        │
                                    │  onRcptTo → verify     │
                                    │  recipient in DB       │
                                    │                        │
                                    │  onData → mailparser   │
                                    │  → save to MongoDB     │
                                    │  → GridFS attachments  │
                                    └───────────┬───────────┘
                                                │
                          Recipient reads via REST GET /api/mail/threads
```

### E2EE Encryption Flow

```
Sender Browser                    Server                    Recipient Browser
     │                              │                              │
     │  1. Fetch recipient's        │                              │
     │     public key ─────────────▶│                              │
     │◀────────────── publicKey ────│                              │
     │                              │                              │
     │  2. Encrypt body with        │                              │
     │     nacl.box() locally       │                              │
     │                              │                              │
     │  3. Send ciphertext ────────▶│  4. Store ciphertext         │
     │     (server never sees       │     (never decrypts)         │
     │      plaintext)              │                              │
     │                              │  5. Deliver ciphertext ─────▶│
     │                              │                              │
     │                              │     6. Decrypt with          │
     │                              │        nacl.box.open()       │
     │                              │        locally               │
```

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|-----------|---------|
| **Node.js 20 LTS** | Runtime environment |
| **Express 4** | REST API framework |
| **Mongoose 8** | MongoDB ODM |
| **smtp-server** | Self-hosted SMTP daemon (RFC 5321) |
| **mailparser** | MIME stream parsing (RFC 2822) |
| **nodemailer** | SMTP client for internal mail relay |
| **bcrypt** | Password hashing (10 salt rounds) |
| **jsonwebtoken** | JWT session management |
| **zod** | Request validation |
| **libphonenumber-js** | Phone number normalization (E.164) |
| **multer** | Multipart file upload handling |
| **Groq SDK** | AI features (drafting, spam, FAQ) |
| **pino** | Structured JSON logging |
| **migrate-mongo** | Database migration management |
| **mongodb-memory-server** | Local dev fallback (WiredTiger) |

### Frontend

| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **TypeScript 5.5** | Type safety |
| **Vite 5** | Build tooling & dev server |
| **Tailwind CSS 3** | Utility-first styling |
| **@tanstack/react-query** | Server state & data fetching |
| **react-router-dom 6** | Client-side routing |
| **react-hook-form + zod** | Form handling & validation |
| **Framer Motion** | Animations & transitions |
| **Lucide React** | Icon library |
| **tweetnacl** | Client-side E2EE (Curve25519 + XSalsa20-Poly1305) |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| **Docker + Docker Compose** | Containerized deployment |
| **Nginx** | Static file serving & reverse proxy |
| **MongoDB 7.0** | Document database + GridFS |
| **Telnyx** | SMS & Voice IVR telephony |

---

## 📡 API Reference

### Authentication — `/api/auth`

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/check` | `{ phone }` | Check if phone number exists and password status |
| `POST` | `/api/auth/setup-token` | `{ phone }` | Generate a setup token for web registration |
| `POST` | `/api/auth/set-password` | `{ setupToken, password }` | Set password for new/skeleton user; returns JWT |
| `POST` | `/api/auth/login` | `{ phone, password }` | Authenticate and receive JWT session token |

### User Profile — `/api/me`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/me` | Bearer JWT | Get current user profile and email address |
| `PATCH` | `/api/me/profile` | Bearer JWT | Update display name, avatar, or public key |

### Mail — `/api/mail`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/mail/threads` | Bearer JWT | List all conversation threads (sorted by latest) |
| `GET` | `/api/mail/threads/:id` | Bearer JWT | Get thread messages; resets unread count |
| `POST` | `/api/mail/send` | Bearer JWT | Send email via internal SMTP (multipart/form-data) |
| `GET` | `/api/mail/verify-recipient` | Bearer JWT | Verify recipient exists before sending |
| `GET` | `/api/mail/attachments/:id` | — | Stream attachment from GridFS |

### Telephony Webhooks

| Method | Endpoint | Provider | Description |
|--------|----------|----------|-------------|
| `POST` | `/voice/incoming` | Telnyx | IVR welcome prompt with `<Gather>` |
| `POST` | `/voice/menu` | Telnyx | Create skeleton account on keypress |
| `POST` | `/sms/incoming` | Telnyx | Handle `SIGNUP` keyword, create account |

### FAQ — `/api/faq`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/faq/ask` | Bearer JWT | Ask the AI chatbot a question |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health check |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | No | `mongodb://mongo:27017/phonemail` | MongoDB connection string |
| `JWT_SECRET` | **Yes** | `change-me-in-production` | Secret for signing JWT tokens |
| `MAIL_DOMAIN` | No | `sandesh.in` | Email domain for all accounts |
| `FRONTEND_PORT` | No | `3000` | Host port for the web UI |
| `BACKEND_PORT` | No | `5000` | Host port for the API server |
| `SMTP_PORT` | No | `2525` | Host port for the SMTP server |
| `TELNYX_API_KEY` | Optional | — | Telnyx API key for SMS/Voice features |
| `TELNYX_PHONE_NUMBER` | Optional | — | Your Telnyx phone number (E.164) |
| `TELNYX_CONNECTION_ID` | Optional | — | Telnyx Call Control App ID |
| `TELNYX_MESSAGING_PROFILE_ID` | Optional | — | Telnyx Messaging Profile ID |
| `PUBLIC_WEBHOOK_BASE_URL` | Optional | — | Public URL for Telnyx webhook callbacks |
| `GROQ_API_KEY` | Optional | — | Groq API key for AI features |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Groq model identifier |
| `LOG_LEVEL` | No | `info` | Pino log level (`fatal` / `error` / `warn` / `info` / `debug` / `trace`) |

> **Note:** Telnyx and Groq credentials are **optional**. The app works without them — SMS/Voice features will be disabled and AI features use graceful fallbacks.

---

## 📂 Project Structure

```
sandesh/
├── backend/
│   ├── Dockerfile                 # Node 20 slim + dumb-init for graceful shutdown
│   ├── package.json               # Backend dependencies
│   ├── migrate-mongo-config.js    # Database migration configuration
│   ├── migrations/                # Versioned schema migrations
│   ├── spam-eval/                 # Spam detection evaluation suite
│   │   ├── dataset.json           # Test dataset for spam classifier
│   │   └── eval.js                # Evaluation runner
│   ├── src/
│   │   ├── index.js               # App entry — Express + SMTP server bootstrap
│   │   ├── models/
│   │   │   ├── User.js            # User schema (phone, auth, E2EE keys)
│   │   │   ├── Thread.js          # Conversation thread schema
│   │   │   ├── Message.js         # Email message schema (with GridFS refs)
│   │   │   ├── EmailTemplate.js   # Reusable email templates
│   │   │   ├── FaqItem.js         # FAQ knowledge base entries
│   │   │   └── OtpVerification.js # OTP token tracking
│   │   ├── routes/
│   │   │   ├── auth.routes.js     # Authentication endpoints
│   │   │   ├── mail.routes.js     # Mail CRUD + attachment streaming
│   │   │   ├── me.routes.js       # User profile management
│   │   │   ├── faq.routes.js      # AI FAQ chatbot endpoint
│   │   │   └── webhook.routes.js  # Telnyx SMS/Voice webhook handlers
│   │   ├── services/
│   │   │   ├── auth.service.js    # Auth logic (bcrypt, JWT, OTP)
│   │   │   ├── mail.service.js    # Mail composition, threading, GridFS
│   │   │   ├── smtp.service.js    # SMTP server setup & MIME processing
│   │   │   ├── telnyx.service.js  # Telnyx SMS/Voice integration
│   │   │   ├── groq.service.js    # Groq AI chatbot service
│   │   │   ├── groqEmail.service.js # AI email drafting assistant
│   │   │   ├── spam.service.js    # LLM-based spam detection
│   │   │   └── token.service.js   # JWT token management
│   │   ├── middleware/            # Auth middleware, error handlers
│   │   └── utils/                 # Phone normalization, shared helpers
│   └── uploads/                   # Avatar storage (Docker volume)
│
├── frontend/
│   ├── Dockerfile                 # Multi-stage: Vite build → Nginx
│   ├── nginx.conf                 # Reverse proxy (/api → backend:5000)
│   ├── package.json               # Frontend dependencies
│   ├── vite.config.ts             # Vite configuration
│   ├── tailwind.config.js         # Tailwind CSS configuration
│   ├── tsconfig.json              # TypeScript configuration
│   └── src/
│       ├── App.tsx                # Router & AuthProvider
│       ├── main.tsx               # React DOM entry point
│       ├── index.css              # Global styles & Tailwind imports
│       ├── pages/
│       │   ├── LoginPage.tsx      # Phone + OTP + password authentication
│       │   ├── DashboardPage.tsx  # Main 3-pane email dashboard
│       │   ├── ProfilePage.tsx    # User profile & settings
│       │   ├── PrivacyPage.tsx    # Privacy policy page
│       │   └── TermsPage.tsx      # Terms of service page
│       ├── components/
│       │   ├── mail/              # Email UI components
│       │   │   ├── SandeshSidebar.tsx      # Foldable navigation sidebar
│       │   │   ├── SandeshThreadList.tsx   # Conversation list with search
│       │   │   ├── SandeshEmailView.tsx    # Message thread viewer
│       │   │   ├── SandeshComposeModal.tsx # Email composition dialog
│       │   │   ├── SandeshAiDraftModal.tsx # AI email drafting assistant
│       │   │   ├── NewChatModal.tsx        # Quick compose modal
│       │   │   ├── SendBar.tsx            # Reply input bar
│       │   │   ├── ChatStream.tsx         # Real-time message stream
│       │   │   ├── ConfirmDialog.tsx      # Confirmation dialogs
│       │   │   └── E2eeVerificationModal.tsx # E2EE key verification
│       │   ├── auth/              # Authentication components
│       │   ├── landing/           # Landing page visuals
│       │   ├── layout/            # Layout wrappers
│       │   ├── faq/               # FAQ chatbot components
│       │   ├── showcase/          # Feature showcase components
│       │   ├── common/            # Shared UI elements
│       │   └── ui/                # Base UI primitives
│       ├── context/               # React context (AuthContext)
│       └── lib/                   # API client, React Query setup
│
├── scripts/
│   └── dev.js                     # Development runner (concurrent backend + frontend)
│
├── docs/
│   └── phonemail-prd.md           # Product Requirements Document
│
├── docker-compose.yml             # 3-service orchestration (mongo, backend, frontend)
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
├── agents.md                      # AI agent development guidelines
├── design.md                      # System design document
├── docker.md                      # Docker setup & operations guide
├── prd.md                         # Product requirements document
└── package.json                   # Root workspace configuration
```

---

## 🐳 Docker Operations

### Day-to-Day Commands

| Action | Command |
|--------|---------|
| Start everything | `docker compose up` |
| Start with rebuild | `docker compose up --build` |
| Start in background | `docker compose up -d` |
| Stop everything | `docker compose down` |
| Stop + wipe database | `docker compose down -v` |
| View running containers | `docker compose ps` |
| Tail backend logs | `docker compose logs -f backend` |
| Tail all logs | `docker compose logs -f` |
| Shell into backend | `docker compose exec backend sh` |
| Rebuild one service only | `docker compose up --build backend` |

### When to Rebuild

| What Changed | Action |
|-------------|--------|
| Source code or npm packages | `docker compose up --build` |
| `.env` values only | `docker compose down && docker compose up` |
| `docker-compose.yml` | `docker compose down && docker compose up --build` |
| Need a completely clean slate | `docker compose down -v && docker system prune -f && docker compose up --build` |

---

## 🧪 Local Development (Without Docker)

```bash
# Terminal 1 — Start MongoDB locally (or use Atlas)
mongod --dbPath ./backend/.mongo-data

# Terminal 2 — Start the backend
cd backend
cp .env.example .env   # Configure your values
npm install
npm run dev            # Runs on :5000 with --watch

# Terminal 3 — Start the frontend
cd frontend
npm install
npm run dev            # Runs on :5173 (Vite dev server)
```

Or use the root dev script that runs both concurrently:

```bash
npm run dev
```

> **Fallback mode:** If no MongoDB connection is available, the backend automatically starts an embedded `mongodb-memory-server` with WiredTiger engine, persisting data to `./backend/.mongo-data/`. Demo accounts are auto-seeded.

---

## 📊 Data Models

### User
```javascript
{
  phone: "+919876543210",        // Unique, E.164 — IS the email local-part
  passwordHash: "$2b$10$...",    // bcrypt hash (null for skeleton accounts)
  hasSetPassword: true,          // false until web setup is complete
  createdVia: "web",             // "web" | "ivr" | "sms"
  aliasIds: [],                  // Custom email aliases
  displayName: "Alice Sharma",
  profilePictureUrl: null,
  publicKey: "base64...",        // E2EE public key (tweetnacl)
  createdAt: "2026-09-28T..."
}
```

### Thread
```javascript
{
  participants: [ObjectId, ObjectId],
  participantEmails: ["9876543210@sandesh.in", "9876543211@sandesh.in"],
  subject: "Project Update",
  lastMessage: { text: "...", from: ObjectId, createdAt: Date, hasAttachments: false },
  lastMessageAt: "2026-09-29T...",
  unreadCounts: { "<userId>": 2 }
}
```

### Message
```javascript
{
  threadId: ObjectId,
  from: ObjectId,
  fromEmail: "9876543210@sandesh.in",
  to: [ObjectId],
  toEmails: ["9876543211@sandesh.in"],
  subject: "Project Update",
  text: "Hey, here's the latest...",   // Ciphertext when E2EE is active
  html: "<p>Hey, here's the latest...</p>",
  attachments: [{ filename: "report.pdf", gridFsId: ObjectId, contentType: "application/pdf", size: 204800 }],
  readBy: [ObjectId],
  createdAt: "2026-09-29T..."
}
```

---

## 🔒 Security Considerations

| Aspect | Implementation |
|--------|---------------|
| **Password Hashing** | bcrypt with 10 salt rounds |
| **Session Tokens** | Signed JWTs with configurable secret |
| **Input Validation** | All request bodies validated with Zod schemas |
| **E2EE** | Client-side tweetnacl (Curve25519 + XSalsa20-Poly1305) |
| **Private Key Storage** | Browser-only (IndexedDB/localStorage) — never sent to server |
| **Telephony Security** | Passwords never travel over SMS or voice calls |
| **SMTP Scope** | Closed-loop only (`@sandesh.in` ↔ `@sandesh.in`), no internet federation |
| **File Upload Limits** | 30 MB max via Nginx `client_max_body_size` |
| **Signal Handling** | `dumb-init` for proper PID 1 signal forwarding in Docker |

> ⚠️ **Known Trade-off:** Clearing browser storage or switching devices loses the E2EE private key permanently. This is the same trade-off made by Signal and WhatsApp — there is no key recovery mechanism without breaking the end-to-end guarantee.

---

## 🧩 Design Decisions

| Decision | Chosen Approach | Why |
|----------|----------------|-----|
| **SMTP Engine** | Custom `smtp-server` + `nodemailer` on port 2525 | Meets hackathon requirement of "No Third-Party Email SaaS" |
| **Port 2525** (not 25) | Non-standard SMTP port | Port 25 is blocked by most cloud providers and ISPs |
| **Attachment Storage** | MongoDB GridFS | Avoids 16 MB BSON limit with Base64; supports chunked streaming |
| **Read Protocol** | REST API (not IMAP/POP3) | IMAP adds massive complexity with zero benefit for a webmail client |
| **Real-time Updates** | React Query polling (3s) | Resilient, stateless, auto-reconnects; simpler than WebSockets |
| **SMS Provider** | Telnyx | Unified SMS + Voice API with better free-tier capabilities |
| **AI Backend** | Groq (Qwen 3.8-27B) | Fast inference, generous free tier, good quality |
| **Dev DB Fallback** | mongodb-memory-server | Zero-config local dev experience without external MongoDB |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker compose` not found | Try `docker-compose` (hyphenated) for older Docker installations |
| Port already in use | Change `FRONTEND_PORT`, `BACKEND_PORT`, or `SMTP_PORT` in `.env` |
| Containers can't reach MongoDB | Use the service name `mongo` as hostname (not `localhost`) inside Docker |
| SMTP port 2525 unreachable externally | Expected — SMTP is for internal closed-loop delivery only |
| `bcrypt` build fails | The backend uses `node:20-slim` (Debian), not Alpine. Don't switch base images. |
| AI features not working | Ensure `GROQ_API_KEY` is set in `.env`. Features gracefully degrade without it. |
| SMS/Voice not working | Ensure Telnyx credentials and `PUBLIC_WEBHOOK_BASE_URL` are configured |

---

## 👥 Team

Built with ❤️ for the **Alphastack Buildathon** (7-day hackathon)

| Role | Owns |
|------|------|
| **Engineer 1** | SMTP server, message/thread storage, GridFS attachments, spam detection |
| **Engineer 2** | Auth (OTP + password), schema design, Telnyx (SMS + Voice), AI integration |
| **Engineer 3** | React frontend — login, inbox, compose/reply, thread view, profile, settings |

---

## 📄 Documentation

| Document | Description |
|----------|-------------|
| [`prd.md`](prd.md) | Full Product Requirements Document |
| [`design.md`](design.md) | System Architecture & Design Document |
| [`docker.md`](docker.md) | Docker Setup & Operations Guide |
| [`agents.md`](agents.md) | AI Agent Development Guidelines |
| [`.env.example`](.env.example) | Environment Variable Template |

---

<p align="center">
  <strong>संदेश</strong> — Every phone number deserves an inbox.<br/>
  <sub>Built with Node.js, React, MongoDB, and a lot of ☕ in 7 days.</sub>
</p>
