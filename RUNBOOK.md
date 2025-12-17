# Operational Runbook & Troubleshooting Guide

This document outlines standard operating procedures (SOPs) for maintaining the autonomous dropshipping bot.

## 0. Quickstart (Local / Dev)

### Required files
- Create `secrets.env` from `secrets.example.md` (do **not** commit it).
- Optional (only if you want Google TTS): place `google-service-account.json` next to `secrets.env`.

### Start everything (Docker)
1. Build and start all services:
   - `docker compose up -d --build`
2. Watch workers:
   - `docker compose logs -f brain scraper`

### Local scripts (host machine)
- `npm run typecheck`
- `npm run video:test` (renders a standalone MP4 into `out/`)
- `npm run flow:test` (creates a test product and pushes it into the pipeline via Redis)

---

## 1. Infrastructure Operations

### Docker Management
**Issue:** Containers are unresponsive or crashed.
**Action:**
1. Check container status: `docker compose ps`
2. View logs for errors: `docker compose logs -f [service_name]`
3. Restart specific service: `docker compose restart [service_name]`
4. Hard reboot (if stuck): `docker compose down && docker compose up -d`

### Redis Queue Management
**Issue:** Job queue is stuck or processing duplicate jobs.
**Action:**
1. Access Redis CLI: `docker compose exec redis redis-cli`
2. Check queue lengths:
   - `LLEN queue:scrape`
   - `LLEN queue:discovery`
   - `LLEN queue:sourcing`
   - `LLEN queue:copywrite`
   - `LLEN queue:video`
   - `LLEN queue:dlq`
3. Inspect a job (example):
   - `LINDEX queue:copywrite 0`
4. DLQ payloads are JSON strings:
   - `LRANGE queue:dlq 0 10`
5. Flush all keys (WARNING: deletes all pending jobs): `FLUSHALL`

---

## 2. Scraper Troubleshooting

### HTTP 403 Forbidden / CAPTCHA
**Trigger:** YouTube rate limiting / bot detection.
**Resolution:**
1. Reduce scrape frequency / concurrency (run fewer jobs at once).
2. Ensure Puppeteer is running headless in production (`PUPPETEER_HEADLESS="true"`).
3. If search starts returning 0 results intermittently, retry the job (the system will requeue on failure).

### Selector Changes
**Trigger:** YouTube DOM changes cause 0 results or missing fields.
**Resolution:**
1. Inspect the YouTube search results page markup.
2. Update selectors in `src/services/scraper/youtube.ts`.
3. Rebuild containers: `docker compose up -d --build scraper brain`

---

## 3. API & Rate Limits

### Shopify API (429 Too Many Requests)
**Limit:** Leaky bucket algorithm (40 requests/bucket, refill rate 2/sec).
**Action:**
- The system automatically backs off (exponential backoff).
- If persistent: reduce listing frequency (fewer products per hour).

### OpenAI API (429 / Insufficient Quota)
**Action:**
- Check billing status on OpenAI dashboard.
- If hitting TPM limits, reduce concurrent jobs and/or switch SMART calls to a cheaper model.

### SerpApi (429 / no matches)
**Action:**
- Confirm the image URL is a direct image (YouTube thumbnails work well).
- Retry: Lens results can be intermittent.

---

## 4. Database Maintenance

### Postgres Connection Issues
**Action:**
- Verify credentials in `secrets.env` (host) and/or docker compose env vars.
- Check if volume is corrupt: `docker volume ls`.
- **Backup:** Run `pg_dump -U [user] [db_name] > backup.sql` before major updates.

---

## 5. Video Rendering Troubleshooting

### Remotion downloads Chrome / slow first render
**Cause:** Remotion downloads a headless Chromium build on first use.
**Action:** This is expected. Subsequent renders are faster due to caching.

### Audio 404 during render (Docker)
**Cause:** Dynamic audio files must be available to the Remotion bundle server.
**Action:** The renderer syncs generated audio into the bundle automatically; if you see this again, rebuild brain: `docker compose up -d --build brain`

