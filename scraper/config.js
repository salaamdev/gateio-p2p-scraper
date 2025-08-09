// scraper/config.js

// Any scraper-related configuration can live here.
// Prefer letting Puppeteer use its bundled Chromium. You can override with CHROME_EXECUTABLE env var.
const chromeExecutablePath = process.env.CHROME_EXECUTABLE || null;

module.exports = {
    URL: "https://www.gate.io/p2p/buy/USDT-KES",
    chromeExecutablePath
};
