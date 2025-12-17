FROM node:20-bookworm-slim

# System dependencies for:
# - Puppeteer / headless Chromium (scraping + Remotion rendering)
# - Remotion rendering (FFmpeg for encoding)
# - Fonts (caption rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Prisma schema early so @prisma/client postinstall can generate the client.
COPY prisma ./prisma

# Install deps (cacheable layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY tsconfig.json ./
COPY src ./src
COPY PROMPTS.md ./PROMPTS.md

# Ensure runtime directories exist (logs, rendered videos, generated audio)
RUN mkdir -p logs out public/audio

# Default entrypoint (docker-compose overrides per service)
CMD ["npm", "run", "brain"]

