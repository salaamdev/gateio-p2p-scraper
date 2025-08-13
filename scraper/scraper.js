// scraper/scraper.js
const puppeteer = require('puppeteer');
const { log, warn, errorLog } = require('./logger');
const { autoScroll } = require('./autoScroll');
const { extractMerchants } = require('./extract');
const { saveToJson, saveToCsv } = require('./dataSaver');
const { getAdjacentMerchants, saveFilteredToJson, saveFilteredToCsv } = require('./filterMerchant');
const { TARGET_URL, chromeExecutablePath, TARGET_MERCHANT } = require('./config');
const { 
    applyStealth, 
    simulateHumanBehavior, 
    getStealthLaunchArgs,
    humanDelay 
} = require('./stealth');

/**
 * Main function to run the scraping process with advanced stealth measures.
 */
async function runScraper() {
    let browser;

    try {
        log("Launching browser with stealth measures...");
        
        // Get stealth-optimized launch arguments
        const stealthArgs = getStealthLaunchArgs({
            disableImages: false, // Keep images to appear more human
            disableJavaScript: false
        });

        const launchOpts = {
            headless: 'new', // Use new headless mode
            args: stealthArgs,
            ignoreDefaultArgs: ['--enable-automation'], // Remove automation flag
            ignoreHTTPSErrors: true
        };

        // Use custom Chrome if specified
        if (chromeExecutablePath) {
            launchOpts.executablePath = chromeExecutablePath;
            log(`Using custom Chrome executable: ${chromeExecutablePath}`);
        } else {
            log("Using Puppeteer's bundled Chromium with stealth configuration");
        }

        browser = await puppeteer.launch(launchOpts);

        // Create new page with stealth measures
        const page = await browser.newPage();
        
        // Apply comprehensive stealth measures
        await applyStealth(page);
        
        log("Stealth measures applied successfully");

        // Navigate to target URL with enhanced error handling
        log(`Navigating to target URL: ${TARGET_URL}`);
        
        try {
            await page.goto(TARGET_URL, { 
                waitUntil: 'networkidle2', 
                timeout: 90000 
            });
            log("Page navigation complete.");
        } catch {
            // Retry navigation with different strategy
            warn("Initial navigation failed, retrying with different approach...");
            await humanDelay(2000, 4000);
            
            await page.goto(TARGET_URL, { 
                waitUntil: 'domcontentloaded', 
                timeout: 60000 
            });
            log("Page navigation complete (retry).");
        }

        // Simulate human behavior before extracting data
        log("Simulating human behavior...");
        await simulateHumanBehavior(page);

        log("Waiting for merchant elements to load...");
        
        // Wait for content with multiple strategies
        try {
            await page.waitForSelector('body', { timeout: 30000 });
            log("Basic page elements detected.");
            
            // Additional wait for dynamic content
            await humanDelay(2000, 3000);
            
            // Check for specific merchant containers with fallback
            try {
                await page.waitForFunction(() => {
                    const selectors = [
                        '.dataMsg',
                        '[data-testid="p2p-list"]',
                        '.p2p-newfriend-list',
                        'tbody tr',
                        '.list-item'
                    ];
                    
                    return selectors.some(selector => 
                        document.querySelectorAll(selector).length > 0
                    );
                }, { timeout: 15000 });
                log("Merchant elements detected.");
            } catch {
                log("Specific merchant selectors not found, proceeding with extraction anyway...");
            }
        } catch (waitError) {
            warn("Element waiting failed, but continuing with extraction:", waitError.message);
        }

        log("Starting enhanced auto-scroll to load dynamic content...");
        await autoScroll(page, {
            maxTime: 12000,
            pauseProbability: 0.2, // More human-like pauses
            reverseScrollProbability: 0.05 // Occasional reverse scrolls
        });
        log("Auto-scroll complete.");

        // Additional pause before extraction (human-like)
        await humanDelay(1000, 2000);

        log("Extracting merchant data...");
        const merchants = await extractMerchants(page);
        log(`Extraction complete. Found ${merchants.length} merchant(s).`);

        if (merchants.length > 0) {
            log(`Successfully extracted ${merchants.length} merchants! Saving data...`);
            saveToJson(merchants);
            saveToCsv(merchants);

            // Filter and save adjacent merchants
            const filteredMerchants = getAdjacentMerchants(merchants, TARGET_MERCHANT);
            if (filteredMerchants.length > 0) {
                log(`Filtering adjacent merchants for target merchant: ${TARGET_MERCHANT} ...`);
                saveFilteredToJson(filteredMerchants);
                saveFilteredToCsv(filteredMerchants);
            }

            // Log stealth effectiveness
            log("Stealth scraping completed successfully - no detection triggered");
        } else {
            warn("No merchants found. This could indicate:");
            warn("- Website structure has changed");
            warn("- Anti-bot measures detected the scraper");
            warn("- Network issues during page load");
            warn("- Selectors need adjustment");
        }
    } catch (err) {
        errorLog("An error occurred during stealth scraping:", err);
        
        // Enhanced error analysis
        if (err.message.includes('net::ERR_FAILED')) {
            errorLog("Network error - possible IP blocking or rate limiting");
        } else if (err.message.includes('timeout')) {
            errorLog("Timeout error - page loading too slow or anti-bot measures");
        } else if (err.message.includes('Navigation failed')) {
            errorLog("Navigation blocked - possible bot detection");
        }
    } finally {
        if (browser) {
            try {
                log("Closing browser...");
                
                // Human-like closing delay
                await humanDelay(500, 1000);
                
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