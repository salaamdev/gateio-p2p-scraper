// scraper/extract.js
const {errorLog} = require('./logger');

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
            // Adjust selectors to target the merchant containers
            const merchantElements = document.querySelectorAll('.mantine-1s8spa1 .dataMsg, .p2p-newfriend-list');

            merchantElements.forEach((merchant) => {
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

module.exports = {
    extractMerchants
};
