// src/services/monitoring/MonitoringService.js
const MetricsCollector = require('./MetricsCollector');
const HealthChecker = require('./HealthChecker');
const AlertManager = require('./AlertManager');

/**
 * Main Monitoring Service
 * Orchestrates metrics collection, health checking, and alerting
 */
class MonitoringService {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled !== false,
            interval: config.interval || 60000, // 1 minute
            metrics: config.metrics || {},
            health: config.health || {},
            alerting: config.alerting || {},
            ...config
        };
        
        this.isRunning = false;
        this.monitoringInterval = null;
        this.startTime = Date.now();
        
        // Initialize components
        this.metricsCollector = new MetricsCollector(this.config.metrics);
        this.healthChecker = new HealthChecker(this.config.health);
        this.alertManager = new AlertManager(this.config.alerting);
        
        // Bind methods
        this.handleScraperEvent = this.handleScraperEvent.bind(this);
        this.handleBrowserEvent = this.handleBrowserEvent.bind(this);
        this.handleDatabaseEvent = this.handleDatabaseEvent.bind(this);
        
        console.log('✅ MonitoringService initialized');
    }

    /**
     * Start monitoring service
     */
    async start() {
        if (!this.config.enabled) {
            console.log('⚠️ Monitoring service disabled by configuration');
            return;
        }

        if (this.isRunning) {
            console.log('⚠️ Monitoring service already running');
            return;
        }

        try {
            // Start components
            this.metricsCollector.start();
            this.healthChecker.start();
            
            // Start main monitoring loop
            this.monitoringInterval = setInterval(() => {
                this.runMonitoringCycle();
            }, this.config.interval);
            
            this.isRunning = true;
            
            console.log(`✅ MonitoringService started (interval: ${this.config.interval}ms)`);
            
            // Run initial monitoring cycle
            await this.runMonitoringCycle();
            
        } catch (error) {
            console.error('❌ Failed to start MonitoringService:', error.message);
            throw error;
        }
    }

    /**
     * Stop monitoring service
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            // Stop main monitoring loop
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            
            // Stop components
            this.metricsCollector.stop();
            this.healthChecker.stop();
            
            this.isRunning = false;
            
            console.log('✅ MonitoringService stopped');
            
        } catch (error) {
            console.error('❌ Error stopping MonitoringService:', error.message);
        }
    }

    /**
     * Run a complete monitoring cycle
     */
    async runMonitoringCycle() {
        try {
            // Collect current metrics
            const metrics = this.metricsCollector.getMetricsSummary();
            
            // Get health status
            const healthStatus = this.healthChecker.getHealthSummary();
            
            // Evaluate alert rules
            if (this.config.alerting.enabled) {
                await this.alertManager.evaluateRules(metrics, healthStatus);
            }
            
            // Log monitoring summary (if debug enabled)
            if (this.config.debug) {
                this.logMonitoringSummary(metrics, healthStatus);
            }
            
        } catch (error) {
            console.error('❌ Error in monitoring cycle:', error.message);
            
            // Record monitoring error
            this.metricsCollector.incrementCounter('monitoring.errors.count');
        }
    }

    /**
     * Handle scraper events
     */
    handleScraperEvent(event) {
        const { type, data = {} } = event;
        
        switch (type) {
            case 'scraper.start':
                this.metricsCollector.incrementCounter('scraper.runs.total');
                break;
                
            case 'scraper.success':
                this.metricsCollector.incrementCounter('scraper.runs.success');
                this.metricsCollector.recordGauge('scraper.duration.last', data.duration);
                this.metricsCollector.recordGauge('scraper.merchants.count', data.merchantCount);
                this.metricsCollector.incrementCounter('scraper.merchants.scraped', data.merchantCount);
                break;
                
            case 'scraper.error':
                this.metricsCollector.incrementCounter('scraper.runs.failed');
                this.metricsCollector.incrementCounter('scraper.errors.count');
                if (data.duration) {
                    this.metricsCollector.recordGauge('scraper.duration.last', data.duration);
                }
                break;
                
            case 'scraper.retry':
                this.metricsCollector.incrementCounter('scraper.retries.count');
                break;
                
            case 'page.load':
                this.metricsCollector.incrementCounter('scraper.pages.loaded');
                if (data.loadTime) {
                    this.metricsCollector.recordGauge('scraper.pages.loadTime', data.loadTime);
                }
                break;
                
            case 'memory.peak':
                if (data.memoryUsage) {
                    this.metricsCollector.recordGauge('scraper.memory.peak', data.memoryUsage);
                }
                break;
        }
    }

    /**
     * Handle browser events
     */
    handleBrowserEvent(event) {
        const { type, data = {} } = event;
        
        switch (type) {
            case 'browser.launch':
                this.metricsCollector.recordGauge('browser.instances.active', data.activeInstances || 1);
                break;
                
            case 'browser.close':
                this.metricsCollector.recordGauge('browser.instances.active', data.activeInstances || 0);
                break;
                
            case 'browser.crash':
                this.metricsCollector.incrementCounter('browser.crashes.count');
                break;
                
            case 'browser.timeout':
                this.metricsCollector.incrementCounter('browser.timeouts.count');
                break;
                
            case 'page.open':
                this.metricsCollector.recordGauge('browser.pages.open', data.openPages || 1);
                break;
                
            case 'page.close':
                this.metricsCollector.recordGauge('browser.pages.open', data.openPages || 0);
                break;
                
            case 'browser.memory':
                if (data.memoryUsage) {
                    this.metricsCollector.recordGauge('browser.memory.usage', data.memoryUsage);
                }
                break;
        }
    }

    /**
     * Handle database events
     */
    handleDatabaseEvent(event) {
        const { type, data = {} } = event;
        
        switch (type) {
            case 'database.query.start':
                this.metricsCollector.incrementCounter('database.queries.total');
                break;
                
            case 'database.query.success':
                this.metricsCollector.incrementCounter('database.queries.success');
                if (data.duration) {
                    this.metricsCollector.recordGauge('database.query.duration', data.duration);
                }
                break;
                
            case 'database.query.error':
                this.metricsCollector.incrementCounter('database.queries.failed');
                if (data.duration) {
                    this.metricsCollector.recordGauge('database.query.duration', data.duration);
                }
                break;
                
            case 'database.size':
                if (data.sizeBytes) {
                    this.metricsCollector.recordGauge('database.size.bytes', data.sizeBytes);
                }
                break;
        }
    }

    /**
     * Handle circuit breaker events
     */
    handleCircuitBreakerEvent(event) {
        const { type, data = {} } = event;
        
        switch (type) {
            case 'circuitBreaker.open':
                this.metricsCollector.incrementCounter('circuitBreaker.opens.count');
                break;
                
            case 'circuitBreaker.close':
                this.metricsCollector.incrementCounter('circuitBreaker.closes.count');
                break;
                
            case 'circuitBreaker.halfOpen':
                // Record state change
                break;
                
            case 'circuitBreaker.metrics':
                if (data.failureRate !== undefined) {
                    this.metricsCollector.recordGauge('circuitBreaker.failureRate', data.failureRate);
                }
                if (data.requestVolume !== undefined) {
                    this.metricsCollector.recordGauge('circuitBreaker.requestVolume', data.requestVolume);
                }
                break;
        }
    }

    /**
     * Log monitoring summary
     */
    logMonitoringSummary(metrics, healthStatus) {
        console.log('\n=== Monitoring Summary ===');
        console.log(`Timestamp: ${new Date(metrics.timestamp).toISOString()}`);
        console.log(`Uptime: ${(metrics.uptime / 1000 / 60).toFixed(1)} minutes`);
        
        // System metrics
        console.log('\nSystem:');
        console.log(`  Memory: ${metrics.system['memory.usage']?.toFixed(1) || 'N/A'}%`);
        console.log(`  CPU: ${metrics.system['cpu.usage']?.toFixed(1) || 'N/A'}%`);
        console.log(`  Load: ${metrics.system['loadavg.1m']?.toFixed(2) || 'N/A'}`);
        
        // Application metrics
        console.log('\nApplication:');
        console.log(`  Process Memory: ${(metrics.gauges['process.memory.rss'] / 1024 / 1024)?.toFixed(1) || 'N/A'}MB`);
        console.log(`  Heap Used: ${(metrics.gauges['process.memory.heapUsed'] / 1024 / 1024)?.toFixed(1) || 'N/A'}MB`);
        
        // Scraper metrics
        console.log('\nScraper:');
        console.log(`  Total Runs: ${metrics.counters['scraper.runs.total'] || 0}`);
        console.log(`  Success: ${metrics.counters['scraper.runs.success'] || 0}`);
        console.log(`  Failed: ${metrics.counters['scraper.runs.failed'] || 0}`);
        console.log(`  Last Duration: ${metrics.scraper['duration.last']?.toFixed(1) || 'N/A'}ms`);
        
        // Health status
        console.log('\nHealth:');
        console.log(`  Overall: ${healthStatus.overall}`);
        console.log(`  Healthy Checks: ${healthStatus.statistics.healthy}`);
        console.log(`  Unhealthy Checks: ${healthStatus.statistics.unhealthy}`);
        
        console.log('=========================\n');
    }

    /**
     * Get comprehensive monitoring status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime,
            config: this.config,
            components: {
                metricsCollector: this.metricsCollector.getStatus(),
                healthChecker: this.healthChecker.getStatus(),
                alertManager: this.alertManager.getStatus()
            }
        };
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return this.metricsCollector.getMetricsSummary();
    }

    /**
     * Get health status
     */
    getHealth() {
        return this.healthChecker.getHealthSummary();
    }

    /**
     * Get alert statistics
     */
    getAlerts() {
        return this.alertManager.getStatistics();
    }

    /**
     * Get comprehensive dashboard data
     */
    getDashboardData() {
        return {
            timestamp: Date.now(),
            status: this.getStatus(),
            metrics: this.getMetrics(),
            health: this.getHealth(),
            alerts: this.getAlerts(),
            overview: {
                isHealthy: this.healthChecker.isHealthy(),
                hasCriticalIssues: this.healthChecker.hasCriticalIssues(),
                activeAlerts: this.alertManager.getActiveCooldowns(),
                uptime: Date.now() - this.startTime
            }
        };
    }

    /**
     * Force a monitoring cycle (for testing)
     */
    async forceMonitoringCycle() {
        await this.runMonitoringCycle();
    }

    /**
     * Reset all metrics (for testing)
     */
    resetMetrics() {
        this.metricsCollector.reset();
    }

    /**
     * Test alert system
     */
    async testAlert(severity = 'info', message = 'Test alert') {
        const testAlert = {
            id: `test_${Date.now()}`,
            rule: 'manual_test',
            severity,
            message,
            timestamp: Date.now(),
            metrics: this.getMetrics(),
            healthStatus: this.getHealth(),
            channels: ['email'],
            metadata: {
                hostname: require('os').hostname(),
                environment: process.env.NODE_ENV || 'development',
                test: true
            }
        };
        
        return await this.alertManager.sendAlert(testAlert);
    }

    /**
     * Get event handlers for external systems
     */
    getEventHandlers() {
        return {
            scraper: this.handleScraperEvent,
            browser: this.handleBrowserEvent,
            database: this.handleDatabaseEvent,
            circuitBreaker: this.handleCircuitBreakerEvent
        };
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        await this.stop();
        console.log('✅ MonitoringService destroyed');
    }
}

module.exports = MonitoringService;
