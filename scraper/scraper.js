// scraper/scraper.js
const puppeteer = require('puppeteer');
const {log, warn, errorLog} = require('./logger');
const {autoScroll} = require('./autoScroll');
const {extractMerchants} = require('./extract');
const {saveToJson, saveToCsv} = require('./dataSaver');
const {getAdjacentMerchants, saveFilteredToJson, saveFilteredToCsv} = require('./filterMerchant');
const {URL, chromeExecutablePath} = require('./config');

/**
 * Main function to run the scraping process.
 */
async function runScraper () {
    let browser;

    try {
        log("Launching browser...");
        const launchOpts = {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        };
        if (chromeExecutablePath) {
            launchOpts.executablePath = chromeExecutablePath;
            log(`Using custom Chrome executable: ${chromeExecutablePath}`);
        } else {
            log("Using Puppeteer's bundled Chromium (no CHROME_EXECUTABLE provided)");
        }
        browser = await puppeteer.launch(launchOpts);

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

            // Filter and save adjacent merchants
            const filteredMerchants = getAdjacentMerchants(merchants);
            if (filteredMerchants.length > 0) {
                log(`Filtering adjacent merchants for coinftw...`);
                saveFilteredToJson(filteredMerchants);
                saveFilteredToCsv(filteredMerchants);
            }
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