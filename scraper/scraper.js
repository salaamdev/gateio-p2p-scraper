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

// Import retry logic and circuit breaker
const {
    retryBrowserLaunch,
    retryPageNavigation,
    retryElementWait,
    retryDataExtraction,
    BrowserLaunchError,
    ExtractionError,
    NoDataFoundError
} = require('./retryLogic');

const {
    getCircuitBreaker,
    getAllCircuitBreakerStats,
    CircuitBreakerOpenError
} = require('./circuitBreaker');

/**
 * Main function to run the scraping process with retry logic and circuit breaker.
 */
async function runScraper() {
    let browser;
    
    // Get circuit breakers for different operations
    const browserCircuit = getCircuitBreaker('BROWSER_LAUNCH');
    const pageCircuit = getCircuitBreaker('PAGE_OPERATIONS');
    const dataCircuit = getCircuitBreaker('DATA_EXTRACTION');

    try {
        log("Starting scraper with retry logic and circuit breaker protection...");
        
        // Browser launch with circuit breaker and retry logic
        browser = await browserCircuit.execute(async () => {
            return await retryBrowserLaunch(async () => {
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

                try {
                    return await puppeteer.launch(launchOpts);
                } catch (error) {
                    throw new BrowserLaunchError(`Failed to launch browser: ${error.message}`, error);
                }
            });
        }, 'browser launch');

        // Page creation and navigation with circuit breaker and retry logic
        const page = await pageCircuit.execute(async () => {
            return await retryPageNavigation(async () => {
                log("Creating new page and applying stealth measures...");
                
                const page = await browser.newPage();
                
                // Apply comprehensive stealth measures
                await applyStealth(page, {
                    userAgent: undefined, // Will use random user agent
                    language: undefined,  // Will use random language
                    timezone: undefined   // Will use random timezone
                });

                // Navigate to target URL
                log(`Navigating to: ${TARGET_URL}`);
                await page.goto(TARGET_URL, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000 // 30 second timeout
                });

                return page;
            });
        }, 'page navigation');

        // Human behavior simulation (not critical, so no circuit breaker)
        log("Simulating human behavior...");
        await simulateHumanBehavior(page);

        // Element waiting with circuit breaker and retry logic
        await pageCircuit.execute(async () => {
            return await retryElementWait(async () => {
                log("Waiting for merchant elements to load...");
                
                try {
                    // Wait for basic page structure
                    await page.waitForSelector('body', { timeout: 10000 });
                    log("Basic page elements detected.");
                    
                    // Add human delay
                    await humanDelay();
                    
                    // Wait for merchant containers or similar dynamic content
                    await page.waitForFunction(() => {
                        // Look for common container patterns
                        const containers = document.querySelectorAll(
                            'div[class*="container"], div[class*="list"], div[class*="item"], ' +
                            'div[class*="card"], div[class*="merchant"], div[class*="trader"]'
                        );
                        return containers.length > 0;
                    }, { timeout: 15000 });
                    
                    log("Merchant elements detected.");
                    
                } catch (error) {
                    throw new Error(`Failed to wait for elements: ${error.message}`);
                }
            });
        }, 'element waiting');

        // Auto-scroll (not critical, so basic error handling)
        try {
            log("Starting enhanced auto-scroll to load dynamic content...");
            await autoScroll(page);
            log("Auto-scroll complete.");
        } catch (error) {
            warn(`Auto-scroll encountered issues, continuing: ${error.message}`);
        }

        // Add delay before extraction
        await humanDelay();

        // Data extraction with circuit breaker and retry logic
        const merchantData = await dataCircuit.execute(async () => {
            return await retryDataExtraction(async () => {
                log("Extracting merchant data...");
                
                try {
                    const merchants = await extractMerchants(page);
                    
                    if (!merchants || merchants.length === 0) {
                        throw new NoDataFoundError("No merchant data found on the page");
                    }
                    
                    log(`Extraction complete. Found ${merchants.length} merchant(s).`);
                    return merchants;
                    
                } catch (error) {
                    if (error instanceof NoDataFoundError) {
                        throw error;
                    }
                    throw new ExtractionError(`Data extraction failed: ${error.message}`, error);
                }
            });
        }, 'data extraction');

        // Save data (not critical for circuit breaker, but with basic retry)
        if (merchantData && merchantData.length > 0) {
            log(`Successfully extracted ${merchantData.length} merchants! Saving data...`);
            
            try {
                await saveToJson(merchantData);
                await saveToCsv(merchantData);
            } catch (saveError) {
                errorLog("Failed to save data", saveError);
                // Don't fail the entire operation for save errors
            }

            // Filter and save adjacent merchants if target is specified
            if (TARGET_MERCHANT) {
                try {
                    const adjacentMerchants = getAdjacentMerchants(merchantData, TARGET_MERCHANT);
                    if (adjacentMerchants.length > 0) {
                        await saveFilteredToJson(adjacentMerchants);
                        await saveFilteredToCsv(adjacentMerchants);
                        log(`Saved ${adjacentMerchants.length} adjacent merchants for target: ${TARGET_MERCHANT}`);
                    }
                } catch (filterError) {
                    errorLog("Failed to filter and save adjacent merchants", filterError);
                }
            }
        }

        log("Stealth scraping completed successfully - no detection triggered");

        // Log circuit breaker statistics
        const circuitStats = getAllCircuitBreakerStats();
        log(`Circuit breaker statistics: ${JSON.stringify(circuitStats)}`);

    } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
            errorLog("Circuit breaker prevented operation", error);
        } else {
            errorLog("An error occurred during stealth scraping", error);
        }
        throw error;
    } finally {
        if (browser) {
            try {
                log("Closing browser...");
                await humanDelay(); // Human-like delay before closing
                await browser.close();
                log("Browser closed.");
            } catch (closeError) {
                errorLog("Error closing browser", closeError);
            }
        }
    }
}

module.exports = {
    runScraper
};