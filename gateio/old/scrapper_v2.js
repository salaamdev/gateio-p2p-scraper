const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// --- Custom Logging System ---

// Ensure the logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, {recursive: true});
}

class Logger {
    constructor (filename) {
        this.logFile = path.join(logsDir, filename);
    }

    write (message) {
        const timestamp = new Date().toISOString();
        // Append message with a newline
        fs.appendFileSync(this.logFile, `[${ timestamp }] ${ message }\n`, 'utf8');
    }
}

// Create three logger instances for activity, warnings, and errors.
const activityLogger = new Logger('activity.log');
const warningLogger = new Logger('warnings.log');
const errorLogger = new Logger('errors.log');

// Helper functions for logging
function log (message) {
    activityLogger.write(`INFO: ${ message }`);
}

function warn (message) {
    warningLogger.write(`WARNING: ${ message }`);
}

function errorLog (message, err = null) {
    errorLogger.write(`ERROR: ${ message }${ err ? ` | Details: ${ err.stack || err }` : '' }`);
}

// --- End Custom Logging System ---

// Target URL
const URL = "https://www.gate.io/p2p/buy/USDT-KES";

// Main function to run the scraping process
async function runScraper () {
    let browser;

    try {
        log("Launching browser...");
        browser = await puppeteer.launch({
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
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
            warn("No merchants found. Verify that the selectors are correct or if the website structure has changed.");
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

/**
 * Extract merchant data from the page.
 * 
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @returns {Promise<Array>} - The list of merchant data.
 */
async function extractMerchants (page) {
    try {
        return await page.evaluate(() => {
            const merchantData = [];
            // Adjust selectors to target the merchant containers based on provided classes.
            const merchantElements = document.querySelectorAll('.mantine-1s8spa1 .dataMsg, .p2p-newfriend-list');

            merchantElements.forEach(merchant => {
                const name = merchant.querySelector('.markList-username')?.innerText.trim() || "N/A";
                const price = merchant.querySelector('[style*="font-weight: 700"]')?.innerText.trim() || "N/A";
                const currency = merchant.querySelector('[style*="font-weight: 500"]')?.innerText.trim() || "N/A";
                const sizeLimit = merchant.querySelector('[style*="color: var(--color-text-1)"] div:nth-child(2)')?.innerText.trim() || "N/A";
                const discount = merchant.querySelector('.p2p-discount-icon-txt, .p2p-discount-listicon')?.innerText.trim() || "N/A";

                merchantData.push({
                    "Merchant Name": name,
                    "Price": `${ price } ${ currency }`,
                    "Size/Limit": sizeLimit,
                    "Discount": discount
                });
            });

            return merchantData;
        });
    } catch (err) {
        errorLog("Error while extracting merchants:", err);
        return [];
    }
}

/**
 * Save data to a JSON file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToJson (data) {
    try {
        const filePath = path.join(__dirname, "../data/gateio_p2p_merchants.json");
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
        log(`Data successfully saved to JSON: ${ filePath }`);
    } catch (err) {
        errorLog("Error saving data to JSON:", err);
    }
}

/**
 * Save data to a CSV file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToCsv (data) {
    try {
        const filePath = path.join(__dirname, "../data/gateio_p2p_merchants.csv");
        const csvHeader = "Merchant Name,Price,Size/Limit,Discount\n";
        const csvRows = data.map(row =>
            `"${ row['Merchant Name'] }","${ row.Price }","${ row['Size/Limit'] }","${ row.Discount }"`
        ).join("\n");

        fs.writeFileSync(filePath, csvHeader + csvRows, "utf8");
        log(`Data successfully saved to CSV: ${ filePath }`);
    } catch (err) {
        errorLog("Error saving data to CSV:", err);
    }
}

/**
 * Automatically scroll the page to ensure that all dynamically loaded content is rendered.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 */
async function autoScroll (page) {
    try {
        await page.evaluate(async () => {
            await new Promise(resolve => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    } catch (err) {
        errorLog("Error during auto-scroll:", err);
    }
}

// Run the scraper
runScraper();
