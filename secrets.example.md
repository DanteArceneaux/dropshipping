# Environment Variables Template
# Copy this file to .env and fill in your actual values.
# DO NOT COMMIT THE ACTUAL .env FILE TO VERSION CONTROL.

# -----------------------------------------------------------------------------
# CORE SERVICES (LLM & AI)
# -----------------------------------------------------------------------------
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# -----------------------------------------------------------------------------
# INFRASTRUCTURE (Database & Queues)
# -----------------------------------------------------------------------------
# Postgres
POSTGRES_USER="admin"
POSTGRES_PASSWORD="change_me_secure_password"
POSTGRES_DB="dropship_bot"
POSTGRES_HOST="postgres"
POSTGRES_PORT="5432"

# Redis
REDIS_URL="redis://redis:6379"

# -----------------------------------------------------------------------------
# E-COMMERCE PLATFORMS
# -----------------------------------------------------------------------------
# Shopify Admin API
SHOPIFY_ACCESS_TOKEN="shpat_..."
SHOPIFY_SHOP_URL="https://your-store.myshopify.com"
SHOPIFY_API_VERSION="2024-01"

# -----------------------------------------------------------------------------
# SCRAPING & DATA SOURCES
# -----------------------------------------------------------------------------
# Apify (TikTok/Instagram Scrapers)
APIFY_TOKEN="apify_api_..."

# Proxy Provider (Optional but recommended)
PROXY_URL="http://user:pass@host:port"

# -----------------------------------------------------------------------------
# MEDIA GENERATION
# -----------------------------------------------------------------------------
# Voice Synthesis
ELEVENLABS_API_KEY="eleven_..."

# Video Editing API
CREATOMATE_API_KEY="create_..."

