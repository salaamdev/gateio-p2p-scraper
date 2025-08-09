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
            const start = Date.now();
            const MAX_MS = 15000;
            await new Promise((resolve) => {
                let lastHeight = document.body.scrollHeight;
                const distance = 200;
                const interval = setInterval(() => {
                    window.scrollBy(0, distance);
                    const newHeight = document.body.scrollHeight;
                    const timeExceeded = Date.now() - start > MAX_MS;
                    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
                    if (newHeight === lastHeight || timeExceeded || atBottom) {
                        clearInterval(interval);
                        resolve();
                    }
                    lastHeight = newHeight;
                }, 150);
            });
        });
    } catch (err) {
        errorLog("Error during auto-scroll:", err);
    }
}

module.exports = {
    autoScroll
};
