// scraper/autoScroll.js
const {errorLog} = require('./logger');

/**
 * Automatically scroll the page to ensure that all dynamically loaded content is rendered.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 */
async function autoScroll (page) {
    try {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
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

module.exports = {
    autoScroll
};
