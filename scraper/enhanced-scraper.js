// scraper/enhanced-scraper.js
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
const fs = require('fs').promises;
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
 * Enhanced Scraper with Advanced Stealth Features:
 * - Human-Like Behavior Simulation
 * - User Agent Rotation
 * - Proxy Support for IP Rotation
 */
class EnhancedScraper {
    constructor(options = {}) {
        this.stealthManager = new EnhancedStealthManager({
            enableProxy: options.enableProxy !== false,
            enableUserAgentRotation: options.enableUserAgentRotation !== false,
            enableHumanBehavior: options.enableHumanBehavior !== false,
            proxies: options.proxies || [],
            proxyRotationInterval: options.proxyRotationInterval || 300000, // 5 minutes
            userAgentRotationInterval: options.userAgentRotationInterval || 600000, // 10 minutes
            ...options
        });
        
        this.browser = null;
        this.page = null;
        this.database = null;
        this.dataPipeline = null;
        this.sessionStartTime = Date.now();
        this.scrapeCount = 0;
        this.lastRotationTime = Date.now();
        
        // Circuit breakers for different operations
        this.browserCircuit = getCircuitBreaker('BROWSER_LAUNCH');
        this.pageCircuit = getCircuitBreaker('PAGE_OPERATIONS');
        this.dataCircuit = getCircuitBreaker('DATA_EXTRACTION');
        
        // Configuration
        this.config = {
            targetUrl: TARGET_URL,
            targetMerchant: TARGET_MERCHANT,
            chromeExecutablePath: chromeExecutablePath,
            humanBehaviorEnabled: true,
            autoScrollEnabled: true,
            validationEnabled: true,
            databaseEnabled: true,
            ...options
        };
        
        log('Enhanced scraper initialized with advanced stealth features');
    }

    /**
     * Initialize the enhanced scraper
     */
    async initialize() {
        try {
            log('Initializing enhanced scraper...');
            
            // Initialize database if enabled
            if (this.config.databaseEnabled) {
                log('Initializing database...');
                this.database = new DatabaseManager();
                await this.database.initialize();
                this.dataPipeline = new DataPipeline(this.database);
                log('Database initialized successfully');
            }
            
            log('Enhanced scraper initialization complete');
        } catch (error) {
            errorLog('Failed to initialize enhanced scraper:', error);
            throw error;
        }
    }

    /**
     * Launch browser with enhanced stealth measures
     */
    async launchBrowser() {
        return await this.browserCircuit.execute(async () => {
            return await retryBrowserLaunch(async () => {
                log('Launching browser with enhanced stealth measures...');
                
                // Get stealth-optimized launch arguments
                const stealthArgs = getStealthLaunchArgs({
                    disableImages: false,
                    disableJavaScript: false
                });

                // Apply proxy configuration to launch options
                let launchOpts = {
                    headless: 'new',
                    args: stealthArgs,
                    ignoreDefaultArgs: ['--enable-automation'],
                    ignoreHTTPSErrors: true,
                    defaultViewport: null // Let stealth manager handle viewport
                };

                // Apply proxy settings if enabled
                launchOpts = this.stealthManager.applyProxyToLaunchOptions(launchOpts);

                // Use custom Chrome if specified
                if (this.config.chromeExecutablePath) {
                    launchOpts.executablePath = this.config.chromeExecutablePath;
                    log(`Using custom Chrome executable: ${this.config.chromeExecutablePath}`);
                } else {
                    log('Using Puppeteer\'s bundled Chromium with enhanced stealth configuration');
                }

                try {
                    this.browser = await puppeteer.launch(launchOpts);
                    log('Browser launched successfully with enhanced stealth');
                    return this.browser;
                } catch (error) {
                    throw new BrowserLaunchError(`Failed to launch browser: ${error.message}`, error);
                }
            });
        }, 'enhanced browser launch');
    }

    /**
     * Create and configure a new page with enhanced stealth
     */
    async createStealthPage() {
        return await this.pageCircuit.execute(async () => {
            return await retryPageNavigation(async () => {
                log('Creating new page with enhanced stealth measures...');
                
                this.page = await this.browser.newPage();
                
                // Apply enhanced stealth measures
                await this.stealthManager.applyEnhancedStealth(this.page, {
                    userAgent: {
                        intelligent: true,
                        avoidRecent: true,
                        preferUnused: true
                    }
                });

                // Handle proxy authentication if needed
                await this.stealthManager.handleProxyAuthentication(this.page);
                
                // Additional stealth measures
                await this.applyAdditionalStealthMeasures();
                
                log('Enhanced stealth page created successfully');
                return this.page;
            });
        }, 'enhanced page creation');
    }

    /**
     * Apply additional stealth measures specific to this scraper
     */
    async applyAdditionalStealthMeasures() {
        try {
            // Set realistic navigation timing
            await this.page.evaluateOnNewDocument(() => {
                // Override performance timing to look more realistic
                const originalNow = performance.now;
                const offset = Math.random() * 1000;
                performance.now = function() {
                    return originalNow.call(performance) + offset;
                };
                
                // Mock realistic connection information
                Object.defineProperty(navigator, 'connection', {
                    get: () => ({
                        effectiveType: '4g',
                        rtt: 50 + Math.random() * 100,
                        downlink: 10 + Math.random() * 5,
                        saveData: false
                    }),
                    configurable: true
                });
            });

            // Set realistic request headers
            await this.page.setExtraHTTPHeaders({
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'cache-control': 'max-age=0'
            });

            // Handle beforeunload events like a real user
            await this.page.evaluateOnNewDocument(() => {
                window.addEventListener('beforeunload', (e) => {
                    // Simulate slight delay like a real browser
                    const start = Date.now();
                    while (Date.now() - start < 10) {
                        // Small blocking delay
                    }
                });
            });

            log('Additional stealth measures applied');
        } catch (error) {
            errorLog('Error applying additional stealth measures:', error);
        }
    }

    /**
     * Navigate to target URL with human-like behavior
     */
    async navigateToTarget() {
        return await this.pageCircuit.execute(async () => {
            return await retryPageNavigation(async () => {
                log(`Navigating to target URL: ${this.config.targetUrl}`);
                
                // Pre-navigation delay (like a user thinking)
                await this.humanDelay(1000, 2000);
                
                const navigationStart = Date.now();
                await this.page.goto(this.config.targetUrl, { 
                    waitUntil: 'networkidle2',
                    timeout: 45000 // Increased timeout for potential slow networks
                });
                
                const navigationTime = Date.now() - navigationStart;
                log(`Navigation completed in ${navigationTime}ms`);
                
                // Post-navigation delay (page loading reaction time)
                await this.humanDelay(800, 1500);
                
                // Simulate initial page scanning behavior
                if (this.config.humanBehaviorEnabled) {
                    log('Performing initial page scan...');
                    await this.stealthManager.simulateHumanBehavior(this.page, {
                        duration: 3000 + Math.random() * 4000,
                        includeReading: true,
                        includeDistraction: false
                    });
                }
                
                return this.page;
            });
        }, 'enhanced navigation');
    }

    /**
     * Wait for page elements with enhanced strategies
     */
    async waitForElements() {
        return await this.pageCircuit.execute(async () => {
            return await retryElementWait(async () => {
                log('Waiting for merchant elements with enhanced detection...');
                
                try {
                    // Wait for basic page structure
                    await this.page.waitForSelector('body', { timeout: 15000 });
                    log('Basic page elements detected');
                    
                    // Human reaction delay
                    await this.humanDelay(500, 1000);
                    
                    // Enhanced element waiting with multiple strategies
                    const elementDetected = await Promise.race([
                        // Strategy 1: Look for merchant containers
                        this.page.waitForFunction(() => {
                            const merchantSelectors = [
                                'div[class*="merchant"]',
                                'div[class*="trader"]',
                                'div[class*="order"]',
                                'div[class*="list-item"]',
                                'div[class*="card"]',
                                'tr[class*="row"]',
                                '[data-testid*="merchant"]',
                                '[data-testid*="order"]'
                            ];
                            
                            for (const selector of merchantSelectors) {
                                const elements = document.querySelectorAll(selector);
                                if (elements.length > 0) {
                                    // Check if elements contain relevant content
                                    for (const element of elements) {
                                        const text = element.textContent || '';
                                        if (text.includes('KES') || text.includes('USD') || /\d+(\.\d+)?/.test(text)) {
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        }, { timeout: 20000 }),
                        
                        // Strategy 2: Look for price indicators
                        this.page.waitForFunction(() => {
                            const priceIndicators = document.querySelectorAll('*');
                            for (const element of priceIndicators) {
                                const text = element.textContent || '';
                                if (/\d+[\.,]\d+\s*(KES|USD|USDT)/.test(text)) {
                                    return true;
                                }
                            }
                            return false;
                        }, { timeout: 20000 }),
                        
                        // Strategy 3: Fallback timeout
                        new Promise((resolve) => {
                            setTimeout(() => resolve(false), 25000);
                        })
                    ]);
                    
                    if (elementDetected) {
                        log('Merchant elements detected with enhanced strategies');
                    } else {
                        log('Element detection timed out, proceeding with extraction attempt');
                    }
                    
                } catch (error) {
                    throw new Error(`Enhanced element waiting failed: ${error.message}`);
                }
            });
        }, 'enhanced element waiting');
    }

    /**
     * Perform enhanced auto-scroll with human-like behavior
     */
    async performEnhancedAutoScroll() {
        try {
            log('Starting enhanced auto-scroll with human-like behavior...');
            
            // Pre-scroll behavior (user examining page)
            if (this.config.humanBehaviorEnabled) {
                await this.stealthManager.simulateHumanBehavior(this.page, {
                    duration: 2000,
                    includeReading: true,
                    includeScrolling: false,
                    includeDistraction: false
                });
            }
            
            // Enhanced auto-scroll
            if (this.config.autoScrollEnabled) {
                await autoScroll(this.page);
            }
            
            // Post-scroll behavior (reviewing loaded content)
            if (this.config.humanBehaviorEnabled) {
                await this.stealthManager.simulateHumanBehavior(this.page, {
                    duration: 1500,
                    includeReading: false,
                    includeScrolling: true,
                    includeDistraction: true
                });
            }
            
            log('Enhanced auto-scroll completed');
        } catch (error) {
            log(`Enhanced auto-scroll encountered issues, continuing: ${error.message}`);
        }
    }

    /**
     * Extract data with enhanced validation and processing
     */
    async extractData() {
        return await this.dataCircuit.execute(async () => {
            return await retryDataExtraction(async () => {
                log('Extracting merchant data with enhanced processing...');
                
                try {
                    // Pre-extraction behavior (final page review)
                    if (this.config.humanBehaviorEnabled) {
                        await this.stealthManager.simulateHumanBehavior(this.page, {
                            duration: 1000,
                            includeReading: true,
                            includeScrolling: false
                        });
                    }
                    
                    const extractionStart = Date.now();
                    const merchants = await extractMerchants(this.page);
                    const extractionTime = Date.now() - extractionStart;
                    
                    if (!merchants || merchants.length === 0) {
                        throw new NoDataFoundError('No merchant data found during enhanced extraction');
                    }
                    
                    log(`Enhanced extraction complete in ${extractionTime}ms. Found ${merchants.length} merchant(s)`);
                    return merchants;
                    
                } catch (error) {
                    if (error instanceof NoDataFoundError) {
                        throw error;
                    }
                    throw new ExtractionError(`Enhanced data extraction failed: ${error.message}`, error);
                }
            });
        }, 'enhanced data extraction');
    }

    /**
     * Process and save extracted data
     */
    async processAndSaveData(merchantData) {
        if (!merchantData || merchantData.length === 0) {
            log('No data to process');
            return;
        }

        log(`Processing ${merchantData.length} merchants...`);
        
        let processedData = merchantData;
        
        // Enhanced validation if enabled
        if (this.config.validationEnabled) {
            try {
                log('Performing enhanced data validation...');
                const validationResult = validateMerchants(merchantData);
                
                if (validationResult.summary.totalErrors === 0) {
                    log(`Enhanced validation passed: ${validationResult.summary.validCount}/${validationResult.totalRecords} merchants valid`);
                } else {
                    log(`Enhanced validation issues: ${validationResult.summary.totalErrors} errors, ${validationResult.summary.totalWarnings} warnings`);
                    
                    // Use only valid records
                    processedData = validationResult.validRecords.map(record => record.data);
                }
            } catch (validationError) {
                errorLog('Enhanced validation failed:', validationError);
            }
        }

        // Save to database if enabled
        if (this.config.databaseEnabled && this.dataPipeline) {
            try {
                log('Saving to database with enhanced tracking...');
                const dbResult = await this.dataPipeline.processScrapeData(processedData, {
                    sessionId: this.generateSessionId(),
                    stealthStats: this.stealthManager.getStealthStats(),
                    scrapeCount: this.scrapeCount,
                    extractionMethod: 'enhanced-stealth'
                });
                log(`Enhanced database save complete. Scrape ID: ${dbResult.scrapeId}, ${dbResult.merchantCount} merchants saved`);
            } catch (dbError) {
                errorLog('Enhanced database save failed:', dbError);
            }
        }

        // Traditional file saves with enhanced metadata
        try {
            await this.saveEnhancedJson(processedData);
            await this.saveEnhancedCsv(processedData);
        } catch (saveError) {
            errorLog('Enhanced file save failed:', saveError);
        }

        // Filter and save adjacent merchants if target specified
        if (this.config.targetMerchant) {
            try {
                const adjacentMerchants = this.getAdjacentMerchants(processedData, this.config.targetMerchant);
                if (adjacentMerchants.length > 0) {
                    await this.saveFilteredData(adjacentMerchants);
                    log(`Enhanced filtering: saved ${adjacentMerchants.length} adjacent merchants for target: ${this.config.targetMerchant}`);
                }
            } catch (filterError) {
                errorLog('Enhanced filtering failed:', filterError);
            }
        }
    }

    /**
     * Save data as JSON with enhanced metadata
     */
    async saveEnhancedJson(data) {
        const enhancedData = {
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId(),
            scrapeCount: this.scrapeCount,
            stealthStats: this.stealthManager.getStealthStats(),
            totalMerchants: data.length,
            targetUrl: this.config.targetUrl,
            extractionMethod: 'enhanced-stealth',
            merchants: data
        };

        const fileName = `enhanced-merchants-${new Date().toISOString().split('T')[0]}-${this.scrapeCount}.json`;
        const filePath = path.join(process.cwd(), 'data', fileName);
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(enhancedData, null, 2));
        
        log(`Enhanced JSON saved: ${fileName}`);
    }

    /**
     * Save data as CSV with enhanced metadata
     */
    async saveEnhancedCsv(data) {
        if (data.length === 0) return;

        // Create CSV with enhanced headers
        const headers = Object.keys(data[0]);
        const enhancedHeaders = [
            ...headers,
            'SessionId',
            'ScrapeCount',
            'ExtractionMethod',
            'Timestamp'
        ];

        const csvRows = [enhancedHeaders.join(',')];
        
        data.forEach((merchant, index) => {
            const row = headers.map(header => {
                const value = merchant[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            
            // Add enhanced metadata
            row.push(`"${this.generateSessionId()}"`);
            row.push(`"${this.scrapeCount}"`);
            row.push(`"enhanced-stealth"`);
            row.push(`"${new Date().toISOString()}"`);
            
            csvRows.push(row.join(','));
        });

        const fileName = `enhanced-merchants-${new Date().toISOString().split('T')[0]}-${this.scrapeCount}.csv`;
        const filePath = path.join(process.cwd(), 'data', fileName);
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, csvRows.join('\n'));
        
        log(`Enhanced CSV saved: ${fileName}`);
    }

    /**
     * Save filtered data for adjacent merchants
     */
    async saveFilteredData(adjacentMerchants) {
        const fileName = `adjacent-to-${this.config.targetMerchant}-${Date.now()}.json`;
        const filePath = path.join(process.cwd(), 'data', fileName);
        
        const enhancedFilteredData = {
            targetMerchant: this.config.targetMerchant,
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId(),
            totalAdjacent: adjacentMerchants.length,
            stealthStats: this.stealthManager.getStealthStats(),
            merchants: adjacentMerchants
        };
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(enhancedFilteredData, null, 2));
        
        log(`Enhanced filtered data saved: ${fileName}`);
    }

    /**
     * Get adjacent merchants around a target merchant
     */
    getAdjacentMerchants(merchants, targetName) {
        const targetIndex = merchants.findIndex(m => 
            m['Merchant Name'] && m['Merchant Name'].toLowerCase().includes(targetName.toLowerCase())
        );
        
        if (targetIndex === -1) {
            return [];
        }
        
        const start = Math.max(0, targetIndex - 2);
        const end = Math.min(merchants.length, targetIndex + 3);
        
        return merchants.slice(start, end);
    }

    /**
     * Check if rotation is needed and perform if necessary
     */
    async checkAndPerformRotation() {
        const now = Date.now();
        const timeSinceLastRotation = now - this.lastRotationTime;
        
        // Rotate based on time or scrape count
        if (timeSinceLastRotation > this.stealthManager.config.userAgentRotationInterval || 
            this.scrapeCount % 5 === 0) {
            
            log('Performing stealth rotation...');
            
            if (this.page) {
                // Apply new stealth configuration
                await this.stealthManager.applyEnhancedStealth(this.page, {
                    userAgent: {
                        intelligent: true,
                        avoidRecent: true,
                        preferUnused: true
                    }
                });
            }
            
            this.lastRotationTime = now;
            log('Stealth rotation completed');
        }
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        return `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Human-like delay with random variation
     */
    async humanDelay(min = 500, max = 1500) {
        const delay = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Run a single enhanced scrape operation
     */
    async runSingleScrape() {
        try {
            log('Starting enhanced scrape operation...');
            this.scrapeCount++;
            
            // Initialize if not already done
            if (!this.database && this.config.databaseEnabled) {
                await this.initialize();
            }
            
            // Launch browser if not already launched
            if (!this.browser) {
                await this.launchBrowser();
            }
            
            // Check for rotation needs
            await this.checkAndPerformRotation();
            
            // Create new stealth page
            await this.createStealthPage();
            
            // Navigate to target
            await this.navigateToTarget();
            
            // Wait for elements
            await this.waitForElements();
            
            // Perform enhanced auto-scroll
            await this.performEnhancedAutoScroll();
            
            // Final delay before extraction
            await this.humanDelay(1000, 2000);
            
            // Extract data
            const merchantData = await this.extractData();
            
            // Process and save data
            await this.processAndSaveData(merchantData);
            
            log('Enhanced scrape operation completed successfully');
            
            // Close page but keep browser for potential reuse
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            
            return {
                success: true,
                merchantCount: merchantData ? merchantData.length : 0,
                scrapeCount: this.scrapeCount,
                stealthStats: this.stealthManager.getStealthStats()
            };
            
        } catch (error) {
            errorLog('Enhanced scrape operation failed:', error);
            
            // Close page on error
            if (this.page) {
                try {
                    await this.page.close();
                } catch (closeError) {
                    errorLog('Error closing page after failure:', closeError);
                }
                this.page = null;
            }
            
            throw error;
        }
    }

    /**
     * Run continuous enhanced scraping
     */
    async runContinuousScraping(options = {}) {
        const {
            interval = 300000, // 5 minutes
            maxScrapes = 0, // 0 = unlimited
            onScrapeComplete = null,
            onError = null
        } = options;
        
        log(`Starting continuous enhanced scraping (interval: ${interval}ms, maxScrapes: ${maxScrapes || 'unlimited'})`);
        
        let scrapeCount = 0;
        
        while (maxScrapes === 0 || scrapeCount < maxScrapes) {
            try {
                const result = await this.runSingleScrape();
                
                if (onScrapeComplete) {
                    await onScrapeComplete(result);
                }
                
                scrapeCount++;
                
                if (maxScrapes > 0 && scrapeCount >= maxScrapes) {
                    log(`Completed ${maxScrapes} scrapes, stopping continuous operation`);
                    break;
                }
                
                log(`Waiting ${interval}ms before next enhanced scrape...`);
                await new Promise(resolve => setTimeout(resolve, interval));
                
            } catch (error) {
                errorLog('Error in continuous scraping:', error);
                
                if (onError) {
                    const shouldContinue = await onError(error, scrapeCount);
                    if (!shouldContinue) {
                        log('Stopping continuous scraping due to error handler');
                        break;
                    }
                }
                
                // Wait longer on error
                await new Promise(resolve => setTimeout(resolve, interval * 2));
            }
        }
        
        log('Continuous enhanced scraping completed');
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const sessionDuration = Date.now() - this.sessionStartTime;
        
        return {
            sessionDuration,
            scrapeCount: this.scrapeCount,
            avgScrapeTime: this.scrapeCount > 0 ? sessionDuration / this.scrapeCount : 0,
            stealthStats: this.stealthManager.getStealthStats(),
            circuitBreakerStats: getAllCircuitBreakerStats(),
            config: this.config
        };
    }

    /**
     * Clean shutdown of the enhanced scraper
     */
    async shutdown() {
        try {
            log('Shutting down enhanced scraper...');
            
            // Close page
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            
            // Close browser
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            
            // Close database
            if (this.database) {
                await this.database.close();
                this.database = null;
            }
            
            // Log final statistics
            const finalStats = this.getStats();
            log('Enhanced scraper shutdown complete');
            log(`Final session stats: ${JSON.stringify(finalStats, null, 2)}`);
            
        } catch (error) {
            errorLog('Error during enhanced scraper shutdown:', error);
        }
    }
}

/**
 * Legacy function for backward compatibility
 */
async function runScraper(options = {}) {
    const enhancedScraper = new EnhancedScraper(options);
    
    try {
        await enhancedScraper.initialize();
        const result = await enhancedScraper.runSingleScrape();
        return result;
    } finally {
        await enhancedScraper.shutdown();
    }
}

module.exports = {
    EnhancedScraper,
    runScraper
};
