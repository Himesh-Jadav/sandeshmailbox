# Docker Setup — Sandesh (PhoneMail)

One command builds and starts the entire stack: **backend** (REST API + self-hosted SMTP server), **frontend** (Vite React + Nginx reverse proxy), and **MongoDB**.

---

## Quick Start (For anyone receiving the repo)

```bash
# 1. Clone the repo
git clone <repo-url>
cd sandesh

# 2. Copy the example env and fill in your keys
cp .env.example .env

# 3. Build and start everything
docker compose up --build

# 4. Open the app
#    Frontend:  http://localhost:3000
#    API:       http://localhost:5000/api/health
```

That's it. The first run takes a few minutes (pulling base images + installing deps). After that it's much faster.

> **Demo accounts** are auto-seeded on first run:
> - `+919876543210` / `password123` (Alice Sharma)
> - `+919876543211` / `password123` (Bob Verma)

---

## Prerequisites (one-time, per machine)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your OS.
2. Open it once so the Docker engine is running in the background.
3. Verify it worked:
   ```bash
   docker --version
   docker compose version
   ```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    docker compose                           │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │   frontend    │   │   backend     │   │    mongo       │   │
│  │  (Nginx:80)   │──▶│  (Node:5000)  │──▶│  (Mongo:27017) │   │
│  │   :3000→:80   │   │  (SMTP:2525)  │   │   mongo-data   │   │
│  └──────────────┘   │  uploads-data  │   └───────────────┘   │
│                      └──────────────┘                        │
│                                                             │
│                    sandesh-network (bridge)                  │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend** serves the React SPA and reverse-proxies `/api/*` requests to the backend
- **Backend** runs the Express API (port 5000) and a self-hosted SMTP server (port 2525)
- **MongoDB** stores all data; the `mongo-data` volume persists across restarts

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | No | `mongodb://mongo:27017/phonemail` | MongoDB connection string (Docker default works out of the box) |
| `JWT_SECRET` | **Yes** | `change-me-in-production` | Secret for signing JWT tokens |
| `MAIL_DOMAIN` | No | `sandesh.in` | Email domain for all accounts |
| `FRONTEND_PORT` | No | `3000` | Host port for the frontend |
| `BACKEND_PORT` | No | `5000` | Host port for the backend API |
| `SMTP_PORT` | No | `2525` | Host port for the SMTP server |
| `TELNYX_API_KEY` | Optional | — | Telnyx API key for SMS/Voice |
| `TELNYX_PHONE_NUMBER` | Optional | — | Your Telnyx phone number (E.164) |
| `TELNYX_CONNECTION_ID` | Optional | — | Telnyx Call Control App ID |
| `TELNYX_MESSAGING_PROFILE_ID` | Optional | — | Telnyx Messaging Profile ID |
| `PUBLIC_WEBHOOK_BASE_URL` | Optional | — | Public URL for Telnyx webhooks |
| `GROQ_API_KEY` | Optional | — | Groq API key (chatbot + spam + email assist) |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Groq model to use |
| `LOG_LEVEL` | No | `info` | Pino log level |

> **Telnyx and Groq are optional** — the app works without them (SMS/Voice features are disabled, AI features use fallbacks).

---

## Day-to-day commands

| What you want to do | Command |
|---|---|
| Start everything (no code changes) | `docker compose up` |
| Start everything (after code changes) | `docker compose up --build` |
| Start in background (detached) | `docker compose up -d` |
| Stop everything | `docker compose down` |
| Stop + wipe the database too | `docker compose down -v` |
| See what's running | `docker compose ps` |
| Tail logs for one service | `docker compose logs -f backend` |
| Tail logs for everything | `docker compose logs -f` |
| Open a shell inside a running container | `docker compose exec backend sh` |

---

## Updating after you change something

**Rule of thumb:** if you changed *code or dependencies*, rebuild. If you only changed data, you don't need to rebuild.

- **Changed backend or frontend code / added an npm package:**
  ```bash
  docker compose up --build
  ```
  Docker caches layers, so only changed images get rebuilt — usually fast.

- **Changed only `.env` values:**
  ```bash
  docker compose down
  docker compose up
  ```
  (No `--build` needed — env vars are read on start, not baked into the image.)

- **Changed `docker-compose.yml` itself:**
  ```bash
  docker compose down
  docker compose up --build
  ```

- **Want a completely clean slate** (fresh DB, no cached layers):
  ```bash
  docker compose down -v
  docker system prune -f
  docker compose up --build
  ```

- **Only rebuild one service:**
  ```bash
  docker compose up --build backend
  ```

---

## Project structure

```
sandesh/
├── backend/
│   ├── Dockerfile          ← Node 20 slim + dumb-init
│   ├── src/                ← Express API + SMTP server
│   ├── migrations/         ← migrate-mongo scripts
│   └── uploads/            ← Avatar storage (Docker volume)
├── frontend/
│   ├── Dockerfile          ← Multi-stage: Vite build → Nginx
│   ├── nginx.conf          ← Reverse proxy for /api → backend
│   └── src/                ← React + TypeScript app
├── docker-compose.yml      ← Orchestrates all 3 services
├── .env.example            ← Template for environment variables
└── .env                    ← Your actual config (git-ignored)
```

---

## Before submitting / judging

Run this exact sequence to simulate a fresh clone:

```bash
docker compose down -v
docker compose up --build
```

If this fails on a clean run, it will fail for anyone receiving the repo. Fix it first.

---

## Common issues

| Problem | Solution |
|---------|----------|
| `docker compose` not found | Older Docker installs use `docker-compose` (hyphenated). Try that. |
| Port already in use | Something on your machine uses the same port. Change `FRONTEND_PORT`, `BACKEND_PORT`, or `SMTP_PORT` in `.env`. |
| Containers can't reach MongoDB | Inside Docker, use the service name `mongo` as hostname, never `localhost`. |
| SMTP port 2525 not reachable from outside | Expected — the SMTP server is for internal closed-loop delivery. Note this in your demo. |
| `bcrypt` build fails | The backend uses `node:20-slim` (Debian) specifically because Alpine doesn't have pre-built bcrypt binaries. Don't switch to Alpine. |