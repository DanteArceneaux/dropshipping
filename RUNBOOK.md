# Operational Runbook & Troubleshooting Guide

This document outlines standard operating procedures (SOPs) for maintaining the autonomous dropshipping bot.

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
2. Check queue length: `LLEN job_queue`
3. Flush all keys (WARNING: deletes all pending jobs): `FLUSHALL`
4. Inspect specific job: `LINDEX job_queue 0`

---

## 2. Scraper Troubleshooting

### HTTP 403 Forbidden / CAPTCHA
**Trigger:** High request volume to TikTok/AliExpress.
**Resolution:**
1. **Rotate Proxies:** Ensure the proxy rotation middleware is active.
   - Check `PROXY_LIST` env var.
   - Verify provider (BrightData/Smartproxy) bandwidth.
2. **Increase Delays:** Edit `scraping_config.json` to increase `min_delay` between requests.
3. **Browser Fingerprints:** Regenerate user-agent headers in the scraper service.

### Selector Changes
**Trigger:** Scraper returns `null` for fields like `price` or `title`.
**Resolution:**
1. Inspect the target site manually (Inspect Element).
2. Update the CSS/XPath selectors in `src/scrapers/definitions.ts`.
3. Redeploy the scraper container.

---

## 3. API & Rate Limits

### Shopify API (429 Too Many Requests)
**Limit:** Leaky bucket algorithm (40 requests/bucket, refill rate 2/sec).
**Action:**
- The system automatically backs off (exponential backoff).
- If persistent: Check if `SHOPIFY_SYNC_INTERVAL` is too aggressive (default: 5 mins).

### OpenAI API (429 / Insufficient Quota)
**Action:**
- Check billing status on OpenAI dashboard.
- If hitting TPM (Tokens Per Minute) limits, implement a queue throttle in `src/llm/client.ts`.
- Switch to a fallback model (e.g., `gpt-3.5-turbo`) in `config.ts` temporarily.

---

## 4. Database Maintenance

### Postgres Connection Issues
**Action:**
- Verify credentials in `.env`.
- Check if volume is corrupt: `docker volume ls`.
- **Backup:** Run `pg_dump -U [user] [db_name] > backup.sql` before major updates.

