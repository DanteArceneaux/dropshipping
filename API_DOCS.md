# Internal API Documentation

This document describes the internal communication between services (or the frontend dashboard and the backend brain).

## Base URL
Local: `http://localhost:3000/api/v1`

## Authentication
Internal services communicate via a shared `INTERNAL_API_KEY` in headers:
`x-internal-auth: <your-secret-key>`

---

## 1. Product Agent Endpoints

### Trigger Manual Discovery
Start a search for products in a specific niche.
- **POST** `/agents/discovery/trigger`
- **Body:**
  ```json
  {
    "niche": "kitchen_gadgets",
    "source": "tiktok",
    "limit": 50
  }
  ```
- **Response:** `202 Accepted` (Returns `job_id`)

### Get Product Candidate
Retrieve details of a specific product being analyzed.
- **GET** `/products/{id}`
- **Response:**
  ```json
  {
    "id": "123-uuid",
    "status": "VETTED",
    "scores": {
      "viral": 85,
      "sentiment": 92
    },
    "sourcing": {
      "supplier_found": true,
      "cost": 4.50
    }
  }
  ```

### Approve for Listing
Manually override the AI and force a product to be listed.
- **POST** `/products/{id}/approve`
- **Body:**
  ```json
  {
    "override_price": 29.99,
    "marketing_angle": "gift_for_mom"
  }
  ```

---

## 2. System Status

### Health Check
- **GET** `/health`
- **Response:**
  ```json
  {
    "status": "ok",
    "services": {
      "database": "connected",
      "redis": "connected",
      "scraper": "idle"
    }
  }
  ```

### Queue Metrics
Get current load on the background workers.
- **GET** `/admin/queues`
- **Response:**
  ```json
  {
    "pending_jobs": 12,
    "active_jobs": 2,
    "failed_jobs": 0
  }
  ```

