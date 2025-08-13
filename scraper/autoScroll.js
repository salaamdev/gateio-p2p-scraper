// scraper/autoScroll.js
const { errorLog, log } = require('./logger');

/**
 * Automatically scroll the page with human-like behavior to ensure that all 
 * dynamically loaded content is rendered while avoiding detection.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @param {Object} options - Scrolling options
 */
async function autoScroll(page, options = {}) {
    const {
        maxTime = 15000,
        minScrollDelay = 100,
        maxScrollDelay = 300,
        minPauseDelay = 500,
        maxPauseDelay = 1500,
        baseScrollDistance = 150,
        variationRange = 100,
        pauseProbability = 0.3,
        reverseScrollProbability = 0.1
    } = options;

    try {
        log('Starting human-like auto-scroll...');
        
        await page.evaluate(async (opts) => {
            const {
                maxTime,
                minScrollDelay,
                maxScrollDelay,
                minPauseDelay,
                maxPauseDelay,
                baseScrollDistance,
                variationRange,
                pauseProbability,
                reverseScrollProbability
            } = opts;

            const start = Date.now();
            let totalScrolled = 0;
            let lastHeight = document.body.scrollHeight;
            let consecutiveNoChange = 0;

            const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            
            const humanDelay = (min, max) => new Promise(resolve => 
                setTimeout(resolve, getRandomDelay(min, max))
            );

            while (Date.now() - start < maxTime) {
                // Calculate scroll distance with variation
                const scrollVariation = (Math.random() - 0.5) * variationRange;
                let scrollDistance = baseScrollDistance + scrollVariation;
                
                // Occasionally scroll in reverse (human-like behavior)
                if (Math.random() < reverseScrollProbability) {
                    scrollDistance = -Math.abs(scrollDistance) / 2; // Smaller reverse scrolls
                    // Reverse scroll
                    console.log('Reverse scroll');
                }

                // Perform scroll with easing
                const steps = 3 + Math.floor(Math.random() * 5); // 3-7 steps
                const stepDistance = scrollDistance / steps;
                
                for (let i = 0; i < steps; i++) {
                    window.scrollBy(0, stepDistance);
                    await humanDelay(20, 50); // Smooth scroll steps
                }

                totalScrolled += Math.abs(scrollDistance);

                // Variable delay between scroll actions
                await humanDelay(minScrollDelay, maxScrollDelay);

                // Random pauses (human-like reading behavior)
                if (Math.random() < pauseProbability) {
                    await humanDelay(minPauseDelay, maxPauseDelay);
                }

                // Check if we've reached the bottom or if content stopped loading
                const currentHeight = document.body.scrollHeight;
                const atBottom = window.innerHeight + window.scrollY >= currentHeight - 10;
                
                if (atBottom) {
                    // Try a few more small scrolls to trigger any lazy loading
                    for (let i = 0; i < 3; i++) {
                        window.scrollBy(0, 50);
                        await humanDelay(200, 400);
                    }
                    
                    // Final check
                    const finalHeight = document.body.scrollHeight;
                    if (finalHeight === currentHeight) {
                        console.log('Reached bottom and no new content loaded');
                        break;
                    }
                }

                // Track content loading progress
                if (currentHeight === lastHeight) {
                    consecutiveNoChange++;
                    if (consecutiveNoChange >= 5) {
                        console.log('No new content loaded after multiple scrolls');
                        break;
                    }
                } else {
                    consecutiveNoChange = 0;
                    lastHeight = currentHeight;
                }
            }

            // Scroll back to a random position (human-like)
            const finalScrollPosition = Math.random() * totalScrolled * 0.3; // Go back 0-30% of scrolled distance
            if (finalScrollPosition > 0) {
                window.scrollTo({
                    top: finalScrollPosition,
                    behavior: 'smooth'
                });
                await humanDelay(500, 1000);
            }

            console.log(`Auto-scroll completed. Total scrolled: ${totalScrolled}px`);
        }, {
            maxTime,
            minScrollDelay,
            maxScrollDelay,
            minPauseDelay,
            maxPauseDelay,
            baseScrollDistance,
            variationRange,
            pauseProbability,
            reverseScrollProbability
        });

        log('Human-like auto-scroll completed successfully');
    } catch (err) {
        errorLog("Error during auto-scroll:", err);
    }
}

/**
 * Simple scroll function for backwards compatibility
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 */
async function simpleScroll(page) {
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
        errorLog("Error during simple scroll:", err);
    }
}

module.exports = {
    autoScroll,
    simpleScroll
};
