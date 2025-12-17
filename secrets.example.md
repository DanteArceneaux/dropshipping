# Environment Secrets Template
Copy this file to `secrets.env` and fill in the values.

## Core
DATABASE_URL="postgresql://admin:change_me@localhost:5432/dropship_bot"
REDIS_URL="redis://localhost:6379"
LOG_LEVEL="info"

## AI / LLM
LLM_PROVIDER="openai" # Options: "openai", "gemini", "mock"
OPENAI_API_KEY="sk-..."

## Gemini / Google AI (optional)
GOOGLE_API_KEY="..."

## Google Cloud TTS (optional)
# If set, the file must exist. In Docker, mount it into the container.
GOOGLE_APPLICATION_CREDENTIALS="google-service-account.json"

## Sourcing
SERPAPI_KEY="your_serpapi_key_here"

## Scraper
# Set to 'false' to see the browser while scraping (useful for debugging)
PUPPETEER_HEADLESS="true"

## Shopify
SHOPIFY_SHOP_DOMAIN="your-shop.myshopify.com"
SHOPIFY_ACCESS_TOKEN="shpat_..."
