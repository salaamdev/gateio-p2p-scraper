// index.js - Enhanced Gate.io P2P Scraper with Advanced Stealth Features
const { runScraper } = require('./scraper/scraper');
const { EnhancedScraper } = require('./scraper/enhanced-scraper');
const { SCRAPE_INTERVAL_MS, validateConfig } = require('./scraper/config');
const { log, errorLog } = require('./scraper/logger');

/**
 * Enhanced Gate.io P2P Scraper with Advanced Stealth Features
 * 
 * Features implemented:
 * 1. Human-Like Behavior Simulation
 * 2. User Agent Rotation  
 * 3. Proxy Support for IP Rotation
 * 4. Enhanced browser fingerprinting protection
 * 5. Comprehensive monitoring and statistics
 */

let intervalId;
let enhancedScraper;

/**
 * Enhanced scraping configuration
 */
const ENHANCED_CONFIG = {
    enableProxy: false, // Set to true and configure proxies for production
    enableUserAgentRotation: true,
    enableHumanBehavior: true,
    humanBehaviorEnabled: true,
    autoScrollEnabled: true,
    validationEnabled: true,
    databaseEnabled: true,
    
    // Proxy configuration (configure for production use)
    proxies: [
        // Example proxy configuration:
        // { host: 'proxy1.example.com', port: 8080, username: 'user', password: 'pass' },
        // { host: 'proxy2.example.com', port: 3128 }
    ],
    
    // Rotation intervals
    proxyRotationInterval: 300000,      // 5 minutes
    userAgentRotationInterval: 600000   // 10 minutes
};

/**
 * Start regular scraping with enhanced stealth features
 */
async function startEnhancedScrapingRegularly() {
    try {
        validateConfig();
        log('Starting enhanced Gate.io P2P scraper with advanced stealth features...');
        
        // Initialize enhanced scraper
        enhancedScraper = new EnhancedScraper(ENHANCED_CONFIG);
        await enhancedScraper.initialize();
        
        // Run first scrape
        log('Performing initial enhanced scrape...');
        await enhancedScraper.runSingleScrape();
        
        // Start continuous scraping
        log(`Setting up continuous enhanced scraping (interval: ${SCRAPE_INTERVAL_MS}ms)`);
        
        await enhancedScraper.runContinuousScraping({
            interval: SCRAPE_INTERVAL_MS,
            maxScrapes: 0, // Unlimited
            onScrapeComplete: async (result) => {
                log(`✅ Enhanced scrape completed: ${result.merchantCount} merchants found`);
                
                // Log stealth statistics periodically
                if (result.scrapeCount % 5 === 0) {
                    const stats = enhancedScraper.getStats();
                    log(`📊 Enhanced scraper statistics (after ${result.scrapeCount} scrapes):`);
                    log(`   - Session duration: ${Math.round(stats.sessionDuration / 1000)}s`);
                    log(`   - Average scrape time: ${Math.round(stats.avgScrapeTime)}ms`);
                    log(`   - User agents used: ${stats.stealthStats.userAgentStats.usedUserAgents}`);
                    log(`   - Proxies available: ${stats.stealthStats.proxyStats.availableProxies}`);
                }
            },
            onError: async (error, scrapeCount) => {
                errorLog(`Enhanced scraping error (scrape ${scrapeCount}):`, error);
                
                // Determine if we should continue
                if (error.message.includes('ECONNREFUSED') || 
                    error.message.includes('net::ERR_INTERNET_DISCONNECTED')) {
                    log('Network error detected, will retry after longer delay...');
                    return true; // Continue
                }
                
                if (scrapeCount < 3) {
                    log('Early error, will retry...');
                    return true; // Continue for first few attempts
                }
                
                log('Multiple errors detected, stopping continuous scraping');
                return false; // Stop
            }
        });
        
    } catch (error) {
        errorLog('Failed to start enhanced scraping:', error);
        throw error;
    }
}

/**
 * Start legacy scraping (backward compatibility)
 */
function startLegacyScrapingRegularly() {
    validateConfig();
    log('Starting legacy scraping mode...');
    
    runScraper();
    intervalId = setInterval(() => {
        runScraper();
    }, SCRAPE_INTERVAL_MS);
}

/**
 * Clean shutdown
 */
async function shutdown() {
    log('Shutting down scraper...');
    
    try {
        // Clear interval if using legacy mode
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        
        // Shutdown enhanced scraper if active
        if (enhancedScraper) {
            await enhancedScraper.shutdown();
            enhancedScraper = null;
        }
        
        log('Scraper shutdown completed successfully');
    } catch (error) {
        errorLog('Error during shutdown:', error);
    } finally {
        process.exit(0);
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        const useEnhanced = !args.includes('--legacy');
        
        if (useEnhanced) {
            log('🚀 Starting Enhanced Mode with Stealth Features');
            log('   Features: User Agent Rotation, Human Behavior, Proxy Support');
            log('   Use --legacy flag to disable enhanced features');
            await startEnhancedScrapingRegularly();
        } else {
            log('🔄 Starting Legacy Mode');
            log('   Enhanced stealth features disabled');
            startLegacyScrapingRegularly();
        }
        
    } catch (error) {
        errorLog('Failed to start scraper:', error);
        await shutdown();
    }
}

// Signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
    errorLog('Uncaught exception:', error);
    shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    errorLog('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown();
});

// Start the application
main();