// src/index.js
const App = require('./app');

/**
 * Main Entry Point for Enhanced Gate.io P2P Scraper
 * Features:
 * - Enhanced Configuration Management
 * - Monitoring and Alerting System
 * - Restructured Project Architecture
 */

async function main() {
    try {
        console.log('🚀 Gate.io P2P Scraper - Enhanced Version');
        console.log('Features: Configuration Management, Monitoring, Alerting, Architecture');
        console.log('==========================================\n');

        // Create and start application
        const app = new App();
        await app.start();
        
        // Keep the application running
        console.log('✅ Application is running. Press Ctrl+C to stop.');
        
        // Optional: Setup development helpers
        if (process.env.NODE_ENV === 'development') {
            setupDevelopmentHelpers(app);
        }
        
    } catch (error) {
        console.error('💥 Application failed to start:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

/**
 * Setup development helpers and debugging tools
 */
function setupDevelopmentHelpers(app) {
    console.log('\n🛠️ Development mode helpers available:');
    console.log('- Use app.getStatus() to view application status');
    console.log('- Use app.getDashboard() to view monitoring dashboard');
    console.log('- Use app.testAlert("info", "message") to test alerts');
    console.log('- Use app.manualScrape() to run manual scrape');
    console.log('- Use app.forceMonitoring() to force monitoring cycle\n');
    
    // Make app available globally for debugging
    global.app = app;
}

// Handle CLI arguments
if (require.main === module) {
    const args = process.argv.slice(2);
    
    const runCLI = async () => {
        if (args.includes('--help') || args.includes('-h')) {
            console.log(`
Gate.io P2P Scraper - Enhanced Version

Usage: node src/index.js [options]

Options:
  --help, -h          Show this help message
  --config, -c        Show current configuration
  --test-config       Validate configuration
  --test-alert        Send test alert
  --dry-run          Run without actually scraping
  --version          Show version information

Environment Variables:
  NODE_ENV           Environment (development, staging, production)
  DEBUG              Enable debug logging
  TARGET_URL         Override target URL
  SCRAPE_INTERVAL_MS Override scraping interval
  
Examples:
  NODE_ENV=development node src/index.js
  DEBUG=true node src/index.js
  node src/index.js --test-config
            `);
            return;
        }
        
        if (args.includes('--version')) {
            const pkg = require('../package.json');
            console.log(`${pkg.name} v${pkg.version}`);
            return;
        }
        
        if (args.includes('--config') || args.includes('-c')) {
            const { configService } = require('./config');
            console.log('Current Configuration:');
            console.log(JSON.stringify(configService.getSummary(), null, 2));
            return;
        }
        
        if (args.includes('--test-config')) {
            console.log('🧪 Testing configuration...');
            try {
                const { configService } = require('./config');
                console.log('✅ Configuration is valid');
                console.log('Summary:', JSON.stringify(configService.getSummary(), null, 2));
            } catch (error) {
                console.error('❌ Configuration validation failed:', error.message);
                process.exit(1);
            }
            return;
        }
        
        if (args.includes('--test-alert')) {
            console.log('🧪 Testing alert system...');
            try {
                const app = new App();
                await app.services.monitoring.start();
                const result = await app.testAlert('info', 'Test alert from CLI');
                console.log('✅ Test alert sent:', result);
                await app.stop();
            } catch (error) {
                console.error('❌ Alert test failed:', error.message);
                process.exit(1);
            }
            return;
        }
        
        if (args.includes('--dry-run')) {
            console.log('🧪 Dry run mode - configuration and monitoring only');
            process.env.DRY_RUN = 'true';
        }
        
        // Start the application
        await main();
    };
    
    runCLI().catch(error => {
        console.error('💥 CLI error:', error.message);
        process.exit(1);
    });
}

module.exports = App;
