const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Target URL
const URL = "https://www.gate.io/p2p/buy/USDT-KES";

// Main function to run the scraping process
async function runScraper () {
    let browser;

    try {
        console.log("Launching browser...");
        browser = await puppeteer.launch({
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();
        await page.setViewport({width: 1366, height: 768});

        console.log("Navigating to target URL...");
        await page.goto(URL, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("Waiting for merchant elements to load...");
        await page.waitForSelector('.mantine-1s8spa1', {timeout: 30000});

        // Scroll to load all merchants (handles dynamically loaded content)
        await autoScroll(page);

        console.log("Extracting merchant data...");
        const merchants = await extractMerchants(page);

        if (merchants.length > 0) {
            console.log(`Successfully extracted ${ merchants.length } merchants!`);
            saveToJson(merchants);
            saveToCsv(merchants);
        } else {
            console.warn("No merchants found. Verify that the selectors are correct or if the website structure has changed.");
        }
    } catch (error) {
        console.error("An error occurred during scraping:", error);
    } finally {
        if (browser) {
            await browser.close();
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
    return await page.evaluate(() => {
        const merchantData = [];
        // Adjusted selectors to target the merchant containers based on provided classes.
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
}

/**
 * Save data to a JSON file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToJson (data) {
    const filePath = path.join(__dirname, "../data/gateio_p2p_merchants.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
    console.log(`Data saved to JSON: ${ filePath }`);
}

/**
 * Save data to a CSV file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToCsv (data) {
    const filePath = path.join(__dirname, "../data/gateio_p2p_merchants.csv");
    const csvHeader = "Merchant Name,Price,Size/Limit,Discount\n";
    const csvRows = data.map(row =>
        `"${ row['Merchant Name'] }","${ row.Price }","${ row['Size/Limit'] }","${ row.Discount }"`
    ).join("\n");

    fs.writeFileSync(filePath, csvHeader + csvRows, "utf8");
    console.log(`Data saved to CSV: ${ filePath }`);
}

/**
 * Automatically scroll the page to ensure that all dynamically loaded content is rendered.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 */
async function autoScroll (page) {
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
}

// Run the scraper
runScraper();
