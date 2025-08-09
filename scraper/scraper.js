// scraper/scraper.js
const puppeteer = require('puppeteer');
const {log, warn, errorLog} = require('./logger');
const {autoScroll} = require('./autoScroll');
const {extractMerchants} = require('./extract');
const {saveToJson, saveToCsv} = require('./dataSaver');
const {getAdjacentMerchants, saveFilteredToJson, saveFilteredToCsv} = require('./filterMerchant');
const {TARGET_URL, chromeExecutablePath, TARGET_MERCHANT} = require('./config');

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
    log("Setting viewport to 1280x800...");
    await page.setViewport({width: 1280, height: 800});

    log(`Navigating to target URL: ${ TARGET_URL }`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 90000 });
        log("Page navigation complete.");

    log("Waiting for merchant elements to load...");
    // Note: Keep selectors centralized in extract.js; here we just wait for a high-level container.
    await page.waitForSelector('body', {timeout: 30000});
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
            const filteredMerchants = getAdjacentMerchants(merchants, TARGET_MERCHANT);
            if (filteredMerchants.length > 0) {
                log(`Filtering adjacent merchants for target merchant: ${TARGET_MERCHANT} ...`);
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
            try {
                log("Closing browser...");
                await browser.close();
                log("Browser closed.");
            } catch (closeErr) {
                errorLog('Error closing browser', closeErr);
            }
        }
    }
}

module.exports = {
    runScraper
};