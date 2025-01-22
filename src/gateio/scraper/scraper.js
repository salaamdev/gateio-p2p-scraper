// scraper/scraper.js
const puppeteer = require('puppeteer');
const {log, warn, errorLog} = require('./logger');
const {autoScroll} = require('./autoScroll');
const {extractMerchants} = require('./extract');
const {saveToJson, saveToCsv} = require('./dataSaver');
const {URL, chromeExecutablePath} = require('./config');

/**
 * Main function to run the scraping process.
 */
async function runScraper () {
    let browser;

    try {
        log("Launching browser...");
        browser = await puppeteer.launch({
            executablePath: chromeExecutablePath,
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();
        log("Setting viewport to 1920x1080...");
        await page.setViewport({width: 1920, height: 1080});

        log(`Navigating to target URL: ${ URL }`);
        await page.goto(URL, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });
        log("Page navigation complete.");

        log("Waiting for merchant elements to load...");
        await page.waitForSelector('.mantine-1s8spa1', {timeout: 30000});
        log("Merchant elements detected.");

        // Scroll to load all merchants (handles dynamically loaded content)
        log("Starting auto-scroll to load dynamic content...");
        await autoScroll(page);
        log("Auto-scroll complete.");

        log("Extracting merchant data...");
        const merchants = await extractMerchants(page);
        log(`Extraction complete. Found ${ merchants.length } merchant(s).`);

        if (merchants.length > 0) {
            log(`Successfully extracted ${ merchants.length } merchants! Saving data...`);
            saveToJson(merchants);
            saveToCsv(merchants);
        } else {
            warn("No merchants found. Verify the selectors or if the website structure has changed.");
        }
    } catch (err) {
        errorLog("An error occurred during scraping:", err);
    } finally {
        if (browser) {
            log("Closing browser...");
            await browser.close();
            log("Browser closed.");
        }
    }
}

module.exports = {
    runScraper
};
