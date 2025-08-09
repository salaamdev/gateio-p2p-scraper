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
            // Container candidates; site may change class names over time
            const containers = document.querySelectorAll(
                '.mantine-1s8spa1 .dataMsg, .p2p-newfriend-list, [data-testid="p2p-list"] .dataMsg'
            );

            containers.forEach((merchant) => {
                const text = (sel) => merchant.querySelector(sel)?.textContent?.trim() || 'N/A';
                const name = text('.markList-username, [data-testid="merchant-name"]');
                const priceRaw = text('[style*="font-weight: 700"], [data-testid="price"]');
                const currency = text('[style*="font-weight: 500"], [data-testid="currency"]');
                const sizeLimit = text('[style*="color: var(--color-text-1)"] div:nth-child(2), [data-testid="limit"]');
                const discount = text('.p2p-discount-icon-txt, .p2p-discount-listicon, [data-testid="discount"]');

                const numericPrice = (() => {
                    const m = priceRaw.replace(/[,\s]/g, '').match(/([0-9]*\.?[0-9]+)/);
                    return m ? Number(m[1]) : null;
                })();

                merchantData.push({
                    'Merchant Name': name,
                    Price: `${priceRaw} ${currency}`.trim(),
                    'PriceNumeric': numericPrice,
                    'Size/Limit': sizeLimit,
                    Discount: discount,
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
