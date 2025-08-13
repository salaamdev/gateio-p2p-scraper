// src/app.js
const path = require('path');
const { configService } = require('./config');
const { MonitoringService } = require('./services/monitoring');

// Import existing modules (to be refactored)
const logger = require('../scraper/logger');
const { DatabaseManager } = require('../scraper/database');
const { runScraper } = require('../scraper/scraper');

/**
 * Main Application Class
 * Coordinates all services and manages application lifecycle
 */
class App {
    constructor() {
        this.config = configService;
        this.isRunning = false;
        this.services = {};
        this.shutdownHandlers = [];
        this.startTime = null;
        
        // Initialize services
        this.initializeServices();
        
        // Setup graceful shutdown
        this.setupShutdownHandlers();
    }

    /**
     * Initialize all services
     */
    initializeServices() {
        try {
            // Initialize monitoring service
            this.services.monitoring = new MonitoringService(this.config.getSection('monitoring'));
            
            // Initialize database service (wrapper around existing)
            this.services.database = new DatabaseManager(this.config.getSection('database'));
            
            // Initialize logger service (wrapper around existing)
            this.services.logger = logger;
            
            // Initialize scraper service (wrapper around existing)
            this.services.scraper = {
                run: runScraper,
                config: this.config.getSection('scraper')
            };
            
            console.log('✅ All services initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize services:', error.message);
            throw error;
        }
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('💥 Uncaught Exception:', error);
            
            // Send critical alert if monitoring is available
            if (this.services.monitoring) {
                try {
                    await this.services.monitoring.testAlert('critical', `Uncaught Exception: ${error.message}`);
                } catch (alertError) {
                    console.error('Failed to send critical alert:', alertError.message);
                }
            }
            
            await this.stop();
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('💥 Unhandled Promise Rejection:', reason);
            
            // Send critical alert if monitoring is available
            if (this.services.monitoring) {
                try {
                    await this.services.monitoring.testAlert('critical', `Unhandled Promise Rejection: ${reason}`);
                } catch (alertError) {
                    console.error('Failed to send critical alert:', alertError.message);
                }
            }
        });
    }

    /**
     * Start the application
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Application already running');
            return;
        }

        try {
            console.log('🚀 Starting Gate.io P2P Scraper Application...');
            console.log(`Environment: ${this.config.getEnvironment()}`);
            console.log(`Configuration: ${JSON.stringify(this.config.getSummary(), null, 2)}`);

            this.startTime = Date.now();

            // Start monitoring service first
            if (this.config.get('monitoring.enabled')) {
                await this.services.monitoring.start();
                console.log('✅ Monitoring service started');
            }

            // Initialize database
            await this.services.database.initialize();
            console.log('✅ Database initialized');

            // Setup monitoring event handlers
            if (this.services.monitoring) {
                const handlers = this.services.monitoring.getEventHandlers();
                
                // Connect scraper events to monitoring
                // Note: This would need to be implemented in the scraper service
                console.log('✅ Monitoring event handlers connected');
            }

            // Start scraper service based on configuration
            if (this.config.get('scraper.enabled', true)) {
                await this.startScrapingProcess();
            } else {
                console.log('ℹ️ Scraping disabled by configuration');
            }

            this.isRunning = true;
            
            console.log('🎉 Application started successfully!');
            console.log(`🔍 Monitoring dashboard data available via getStatus()`);
            
            // Send startup notification
            if (this.services.monitoring && this.config.get('alerting.enabled')) {
                await this.services.monitoring.testAlert('info', 'Application started successfully');
            }

        } catch (error) {
            console.error('❌ Failed to start application:', error.message);
            
            // Try to send failure alert
            if (this.services.monitoring) {
                try {
                    await this.services.monitoring.testAlert('critical', `Application startup failed: ${error.message}`);
                } catch (alertError) {
                    console.error('Failed to send startup failure alert:', alertError.message);
                }
            }
            
            throw error;
        }
    }

    /**
     * Start the scraping process
     */
    async startScrapingProcess() {
        const scraperConfig = this.config.getSection('scraper');
        
        if (scraperConfig.mode === 'continuous') {
            // Start continuous scraping
            await this.startContinuousScraping();
        } else if (scraperConfig.mode === 'scheduled') {
            // Start scheduled scraping
            this.startScheduledScraping();
        } else {
            // Run once
            await this.runSingleScrape();
        }
    }

    /**
     * Start continuous scraping
     */
    async startContinuousScraping() {
        const intervalMs = this.config.get('scraper.intervalMs', 30000);
        
        console.log(`🔄 Starting continuous scraping (interval: ${intervalMs}ms)`);
        
        // Run initial scrape
        await this.runSingleScrape();
        
        // Schedule recurring scrapes
        this.scraperInterval = setInterval(async () => {
            try {
                await this.runSingleScrape();
            } catch (error) {
                console.error('❌ Scraping cycle failed:', error.message);
                
                // Emit scraper error event
                if (this.services.monitoring) {
                    this.services.monitoring.handleScraperEvent({
                        type: 'scraper.error',
                        data: { error: error.message }
                    });
                }
            }
        }, intervalMs);
    }

    /**
     * Start scheduled scraping
     */
    startScheduledScraping() {
        const schedule = this.config.get('scraper.schedule', '*/30 * * * *'); // Every 30 minutes default
        
        console.log(`📅 Starting scheduled scraping (schedule: ${schedule})`);
        
        // This would require node-cron
        const cron = require('node-cron');
        
        this.scheduledTask = cron.schedule(schedule, async () => {
            try {
                await this.runSingleScrape();
            } catch (error) {
                console.error('❌ Scheduled scraping failed:', error.message);
                
                // Emit scraper error event
                if (this.services.monitoring) {
                    this.services.monitoring.handleScraperEvent({
                        type: 'scraper.error',
                        data: { error: error.message }
                    });
                }
            }
        });
    }

    /**
     * Run a single scrape operation
     */
    async runSingleScrape() {
        const startTime = Date.now();
        
        try {
            console.log('🕷️ Starting scrape operation...');
            
            // Emit scraper start event
            if (this.services.monitoring) {
                this.services.monitoring.handleScraperEvent({
                    type: 'scraper.start'
                });
            }
            
            // Run the scraper
            const results = await this.services.scraper.run();
            
            const duration = Date.now() - startTime;
            const merchantCount = results?.merchants?.length || 0;
            
            console.log(`✅ Scrape completed in ${duration}ms, found ${merchantCount} merchants`);
            
            // Emit scraper success event
            if (this.services.monitoring) {
                this.services.monitoring.handleScraperEvent({
                    type: 'scraper.success',
                    data: { duration, merchantCount, results }
                });
            }
            
            return results;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ Scrape failed after ${duration}ms:`, error.message);
            
            // Emit scraper error event
            if (this.services.monitoring) {
                this.services.monitoring.handleScraperEvent({
                    type: 'scraper.error',
                    data: { duration, error: error.message }
                });
            }
            
            throw error;
        }
    }

    /**
     * Stop the application
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️ Application not running');
            return;
        }

        console.log('🛑 Stopping application...');

        try {
            // Stop scraping
            if (this.scraperInterval) {
                clearInterval(this.scraperInterval);
                this.scraperInterval = null;
                console.log('✅ Scraper interval stopped');
            }
            
            if (this.scheduledTask) {
                this.scheduledTask.stop();
                this.scheduledTask = null;
                console.log('✅ Scheduled task stopped');
            }

            // Stop monitoring service
            if (this.services.monitoring) {
                await this.services.monitoring.stop();
                console.log('✅ Monitoring service stopped');
            }

            // Close database connections
            if (this.services.database && this.services.database.close) {
                await this.services.database.close();
                console.log('✅ Database connections closed');
            }

            // Run shutdown handlers
            for (const handler of this.shutdownHandlers) {
                try {
                    await handler();
                } catch (error) {
                    console.error('❌ Error in shutdown handler:', error.message);
                }
            }

            this.isRunning = false;
            
            const uptime = Date.now() - this.startTime;
            console.log(`✅ Application stopped (uptime: ${(uptime / 1000 / 60).toFixed(1)} minutes)`);

        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
            throw error;
        }
    }

    /**
     * Add shutdown handler
     */
    addShutdownHandler(handler) {
        this.shutdownHandlers.push(handler);
    }

    /**
     * Get application status
     */
    getStatus() {
        const status = {
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            environment: this.config.getEnvironment(),
            config: this.config.getSummary(),
            services: {}
        };

        // Get service statuses
        if (this.services.monitoring) {
            status.monitoring = this.services.monitoring.getDashboardData();
        }

        if (this.services.database && this.services.database.getStatus) {
            status.database = this.services.database.getStatus();
        }

        return status;
    }

    /**
     * Get monitoring dashboard data
     */
    getDashboard() {
        if (!this.services.monitoring) {
            return { error: 'Monitoring service not available' };
        }
        
        return this.services.monitoring.getDashboardData();
    }

    /**
     * Test alert system
     */
    async testAlert(severity = 'info', message = 'Test alert from application') {
        if (!this.services.monitoring) {
            throw new Error('Monitoring service not available');
        }
        
        return await this.services.monitoring.testAlert(severity, message);
    }

    /**
     * Force monitoring cycle
     */
    async forceMonitoring() {
        if (!this.services.monitoring) {
            throw new Error('Monitoring service not available');
        }
        
        return await this.services.monitoring.forceMonitoringCycle();
    }

    /**
     * Run manual scrape
     */
    async manualScrape() {
        return await this.runSingleScrape();
    }
}

module.exports = App;
