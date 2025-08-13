# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

WORKDIR /app

# Install system dependencies for Chromium (per Puppeteer docs)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
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
      xdg-utils && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install app deps (this will also download Chromium used by Puppeteer)
RUN npm ci --omit=dev

COPY . .

# Ensure data/logs exist and are writable
RUN mkdir -p /app/data /app/logs && chown -R node:node /app

USER node

CMD ["npm", "start"]
