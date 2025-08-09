// scraper/config.js
require('dotenv').config();

// Prefer letting Puppeteer use its bundled Chromium. You can override with CHROME_EXECUTABLE env var.
const chromeExecutablePath = process.env.CHROME_EXECUTABLE || null;

const TARGET_URL = process.env.TARGET_URL || 'https://www.gate.io/p2p/buy/USDT-KES';
const SCRAPE_INTERVAL_MS = Number(process.env.SCRAPE_INTERVAL_MS || 60000);
const TARGET_MERCHANT = process.env.TARGET_MERCHANT || 'coinftw';

function validateConfig() {
    try {
        // quick URL validation
        // Use global.URL explicitly to avoid shadowing
        new global.URL(TARGET_URL);
    } catch {
        throw new Error('Invalid TARGET_URL provided in config/env.');
    }
}

module.exports = {
    TARGET_URL,
    chromeExecutablePath,
    SCRAPE_INTERVAL_MS,
    TARGET_MERCHANT,
    validateConfig,
};
