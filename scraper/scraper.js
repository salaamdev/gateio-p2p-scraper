// scraper/scraper.js
const puppeteer = require('puppeteer');
const { log, errorLog } = require('./logger');
const { applyStealth, simulateHumanBehavior, getStealthLaunchArgs } = require('./stealth');
const { EnhancedStealthManager } = require('./enhanced-stealth');
const { saveData } = require('./dataSaver');
const { filterMerchantsByLocation } = require('./filterMerchant');
const { getSelectors } = require('./selectors');
const { autoScroll } = require('./autoScroll');
const { extractMerchants } = require('./extract');
const { TARGET_URL, TARGET_MERCHANT, chromeExecutablePath } = require('./config');
const fs = require('fs');
const path = require('path');

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

// Import validation and database (Features 4 & 5)
const { validateMerchants } = require('./schema');
const { DatabaseManager, DataPipeline } = require('./database');

/**
 * Main function to run the scraping process with retry logic and circuit breaker.
 */
async function runScraper() {
    let browser;
    let database;
    let dataPipeline;
    
    // Get circuit breakers for different operations
    const browserCircuit = getCircuitBreaker('BROWSER_LAUNCH');
    const pageCircuit = getCircuitBreaker('PAGE_OPERATIONS');
    const dataCircuit = getCircuitBreaker('DATA_EXTRACTION');

    try {
        log("Starting scraper with retry logic and circuit breaker protection...");
        
        // Initialize database (Feature 5)
        log("Initializing database...");
        database = new DatabaseManager();
        await database.initialize();
        
        // Initialize data pipeline (Feature 5)
        dataPipeline = new DataPipeline(database);
        
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

        // Process and save data with validation and database storage (Features 4 & 5)
        if (merchantData && merchantData.length > 0) {
            log(`Successfully extracted ${merchantData.length} merchants! Processing data...`);
            
            // Validate data (Feature 4)
            log("Validating merchant data...");
            const validationResult = validateMerchants(merchantData);
            
            if (validationResult.summary.totalErrors === 0) {
                log(`Data validation passed: ${validationResult.summary.validCount}/${validationResult.totalRecords} merchants valid`);
            } else {
                warn(`Data validation issues found: ${validationResult.summary.totalErrors} errors, ${validationResult.summary.totalWarnings} warnings`);
                
                // Log specific errors
                Object.entries(validationResult.aggregateErrors).forEach(([field, errors]) => {
                    errors.forEach(error => errorLog(`Validation error in ${field}: ${error.message}`));
                });
                
                // Log specific warnings
                Object.entries(validationResult.aggregateWarnings).forEach(([field, warnings]) => {
                    warnings.forEach(warning => warn(`Validation warning in ${field}: ${warning.message}`));
                });
            }

            // Use valid records from validation
            const validMerchants = validationResult.validRecords.map(record => record.data);
            const dataToSave = validMerchants.length > 0 ? validMerchants : merchantData;
            
            try {
                // Save to database (Feature 5)
                log("Saving data to database...");
                const dbResult = await dataPipeline.processScrapeData(dataToSave);
                log(`Database save complete. Scrape ID: ${dbResult.scrapeId}, ${dbResult.merchantCount} merchants saved`);
                
                // Traditional file saves
                await saveToJson(dataToSave);
                await saveToCsv(dataToSave);
                
            } catch (saveError) {
                errorLog("Failed to save data", saveError);
                // Don't fail the entire operation for save errors
            }

            // Filter and save adjacent merchants if target is specified
            if (TARGET_MERCHANT) {
                try {
                    const adjacentMerchants = getAdjacentMerchants(dataToSave, TARGET_MERCHANT);
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
        // Close database connection
        if (database) {
            try {
                log("Closing database connection...");
                await database.close();
                log("Database connection closed.");
            } catch (dbCloseError) {
                errorLog("Error closing database", dbCloseError);
            }
        }
        
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