# Environment Secrets Template
Copy this file to `.env` and fill in the values.

## Core
DATABASE_URL="postgresql://user:password@localhost:5432/dropshipping_db"
REDIS_URL="redis://localhost:6379"
LOG_LEVEL="info"

## AI / LLM
OPENAI_API_KEY="sk-..."

## Sourcing
SERPAPI_KEY="your_serpapi_key_here"

## Scraper
# Set to 'false' to see the browser while scraping (useful for debugging)
PUPPETEER_HEADLESS="true"

## Shopify
SHOPIFY_SHOP_DOMAIN="your-shop.myshopify.com"
SHOPIFY_ACCESS_TOKEN="shpat_..."
