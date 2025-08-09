// index.js
const { runScraper } = require('./scraper/scraper');
const { SCRAPE_INTERVAL_MS, validateConfig } = require('./scraper/config');

let intervalId;

function startScrapingRegularly() {
    validateConfig();
    runScraper();
    intervalId = setInterval(() => {
        runScraper();
    }, SCRAPE_INTERVAL_MS);
}

function shutdown() {
    if (intervalId) clearInterval(intervalId);
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startScrapingRegularly();