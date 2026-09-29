# Docker Setup — PhoneMail

This project runs fully via Docker Compose. No manual dependency installs, no dashboard clicking — one command builds and starts everything: backend (API + self-hosted SMTP server), frontend, and MongoDB.

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

## First-time project setup

1. Clone the repo and go into it:
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. Copy the example env file and fill in real values (Twilio/MSG91/textbee keys, JWT secret, etc.):
   ```bash
   cp .env.example .env
   ```
   > `.env` is git-ignored — never commit real keys. `.env.example` should always have placeholder values so anyone can see what's required.

3. Build and start everything:
   ```bash
   docker compose up --build
   ```
   First run takes a few minutes (pulling base images + installing deps). After that it's much faster.

4. Once it's up:
   - Frontend: `http://localhost:3000` (adjust to whatever port you exposed)
   - Backend API: `http://localhost:5000` (adjust to your port)
   - MongoDB: running internally on the Docker network, no need to touch it directly

5. Stop everything:
   ```bash
   docker compose down
   ```

---

## Project structure this expects

```
/
├── backend/
│   ├── Dockerfile
│   └── ... (Node/Express + SMTP server, port 2525)
├── frontend/
│   ├── Dockerfile
│   └── ... (React app)
├── docker-compose.yml
├── .env.example
└── .env            (not committed)
```

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

**Rule of thumb:** if you changed *code or dependencies*, rebuild. If you only changed data (e.g. testing with the DB), you don't need to rebuild.

- **Changed backend or frontend code / added an npm package:**
  ```bash
  docker compose up --build
  ```
  This rebuilds only the images whose source changed — Docker caches layers, so it's usually fast.

- **Changed only `.env` values:**
  ```bash
  docker compose down
  docker compose up
  ```
  (No `--build` needed — env vars are re-read on start, not baked into the image.)

- **Changed `docker-compose.yml` itself** (e.g. added a new service, changed ports):
  ```bash
  docker compose down
  docker compose up --build
  ```

- **Want a completely clean slate** (fresh DB, no cached layers, as if cloning fresh):
  ```bash
  docker compose down -v
  docker system prune -f
  docker compose up --build
  ```
  Use this before final judging to make sure it genuinely works from zero.

- **Only rebuild one service** (faster than rebuilding everything):
  ```bash
  docker compose up --build backend
  ```

---

## Before submitting / judging

Run this exact sequence to simulate what a judge will experience:

```bash
docker compose down -v
docker compose up --build
```

If this fails on a clean run, it will fail for the judges too. Fix it before the deadline, not during the demo.

---

## Common issues

- **`docker compose` not found** → older Docker installs use the hyphenated `docker-compose` instead. Try that if the spaced version fails.
- **Port already in use** → something on your machine (a local Mongo, another server) is using the same port. Either stop it, or change the port mapping in `docker-compose.yml` (left side of `"3000:3000"` is the host port — change that).
- **Containers can't reach MongoDB** → inside Docker, use the service name from `docker-compose.yml` (e.g. `mongo`) as the hostname, never `localhost`. `mongodb://mongo:27017/phonemail`, not `mongodb://localhost:27017/phonemail`.
- **SMTP port 2525 not reachable from outside** → this is expected/fine for judging on a laptop; note it clearly in the README/demo script so it's not a surprise mid-demo.