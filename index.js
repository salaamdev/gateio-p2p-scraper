// index.js
const {runScraper} = require('./scraper/scraper');

function startScrapingRegularly () {
    runScraper();
    setInterval(() => {
        runScraper();
    }, 60000);
}

startScrapingRegularly();