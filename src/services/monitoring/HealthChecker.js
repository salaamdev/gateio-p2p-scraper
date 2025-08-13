// src/services/monitoring/HealthChecker.js
const fs = require('fs');
const path = require('path');

/**
 * Health Checking Service
 * Monitors system health, application health, and external dependencies
 */
class HealthChecker {
    constructor(config = {}) {
        this.config = {
            checkInterval: config.checkInterval || 60000, // 1 minute
            timeout: config.timeout || 30000, // 30 seconds
            retries: config.retries || 3,
            ...config
        };
        
        this.checks = new Map();
        this.healthStatus = new Map();
        this.isRunning = false;
        this.checkInterval = null;
        this.dependencies = new Map();
        
        // Register built-in health checks
        this.registerBuiltInChecks();
    }

    /**
     * Register built-in health checks
     */
    registerBuiltInChecks() {
        // System health checks
        this.registerCheck('system.memory', this.checkSystemMemory.bind(this));
        this.registerCheck('system.disk', this.checkDiskSpace.bind(this));
        this.registerCheck('system.cpu', this.checkCPUUsage.bind(this));
        
        // Application health checks
        this.registerCheck('app.uptime', this.checkAppUptime.bind(this));
        this.registerCheck('app.memory', this.checkAppMemory.bind(this));
        
        // File system checks
        this.registerCheck('filesystem.logs', this.checkLogDirectory.bind(this));
        this.registerCheck('filesystem.data', this.checkDataDirectory.bind(this));
        this.registerCheck('filesystem.database', this.checkDatabaseFile.bind(this));
        
        // Browser health checks
        this.registerCheck('browser.availability', this.checkBrowserAvailability.bind(this));
        
        console.log('✅ Built-in health checks registered');
    }

    /**
     * Register a custom health check
     */
    registerCheck(name, checkFunction, config = {}) {
        this.checks.set(name, {
            name,
            check: checkFunction,
            config: {
                timeout: config.timeout || this.config.timeout,
                retries: config.retries || this.config.retries,
                critical: config.critical || false,
                ...config
            }
        });
        
        // Initialize status
        this.healthStatus.set(name, {
            name,
            status: 'unknown',
            lastCheck: null,
            lastSuccess: null,
            lastFailure: null,
            consecutiveFailures: 0,
            message: 'Not yet checked'
        });
    }

    /**
     * Register an external dependency
     */
    registerDependency(name, config) {
        this.dependencies.set(name, {
            name,
            type: config.type || 'http',
            url: config.url,
            timeout: config.timeout || 10000,
            critical: config.critical || false,
            ...config
        });
        
        // Register as a health check
        this.registerCheck(`dependency.${name}`, 
            () => this.checkDependency(name), 
            { critical: config.critical }
        );
    }

    /**
     * Start health checking
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Health checking already running');
            return;
        }

        this.isRunning = true;
        
        // Run initial check
        this.runAllChecks();
        
        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.runAllChecks();
        }, this.config.checkInterval);

        console.log(`✅ HealthChecker started (interval: ${this.config.checkInterval}ms)`);
    }

    /**
     * Stop health checking
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        console.log('✅ HealthChecker stopped');
    }

    /**
     * Run all registered health checks
     */
    async runAllChecks() {
        const checkPromises = [];
        
        for (const [name, checkInfo] of this.checks) {
            checkPromises.push(this.runSingleCheck(name, checkInfo));
        }
        
        await Promise.allSettled(checkPromises);
        
        // Update overall health status
        this.updateOverallHealth();
    }

    /**
     * Run a single health check
     */
    async runSingleCheck(name, checkInfo) {
        const status = this.healthStatus.get(name);
        const startTime = Date.now();
        
        try {
            // Run check with timeout
            const result = await this.withTimeout(
                checkInfo.check(),
                checkInfo.config.timeout
            );
            
            // Update status on success
            status.status = 'healthy';
            status.lastCheck = startTime;
            status.lastSuccess = startTime;
            status.consecutiveFailures = 0;
            status.message = result.message || 'Check passed';
            status.details = result.details || {};
            status.duration = Date.now() - startTime;
            
        } catch (error) {
            // Update status on failure
            status.status = 'unhealthy';
            status.lastCheck = startTime;
            status.lastFailure = startTime;
            status.consecutiveFailures++;
            status.message = error.message || 'Check failed';
            status.error = error.stack;
            status.duration = Date.now() - startTime;
            
            console.error(`❌ Health check failed: ${name} - ${error.message}`);
        }
        
        this.healthStatus.set(name, status);
    }

    /**
     * Execute function with timeout
     */
    async withTimeout(promise, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            promise
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timer));
        });
    }

    /**
     * Update overall health status
     */
    updateOverallHealth() {
        let overallStatus = 'healthy';
        let criticalIssues = 0;
        let totalIssues = 0;
        
        for (const [name, status] of this.healthStatus) {
            if (status.status === 'unhealthy') {
                totalIssues++;
                
                const checkInfo = this.checks.get(name);
                if (checkInfo && checkInfo.config.critical) {
                    criticalIssues++;
                }
            }
        }
        
        if (criticalIssues > 0) {
            overallStatus = 'critical';
        } else if (totalIssues > 0) {
            overallStatus = 'degraded';
        }
        
        this.healthStatus.set('_overall', {
            name: '_overall',
            status: overallStatus,
            lastCheck: Date.now(),
            criticalIssues,
            totalIssues,
            totalChecks: this.checks.size
        });
    }

    /**
     * Built-in health checks
     */
    
    async checkSystemMemory() {
        const os = require('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const usagePercent = (usedMem / totalMem) * 100;
        
        if (usagePercent > 90) {
            throw new Error(`System memory usage critical: ${usagePercent.toFixed(1)}%`);
        }
        
        if (usagePercent > 80) {
            return {
                message: `System memory usage high: ${usagePercent.toFixed(1)}%`,
                details: { usagePercent, totalMem, freeMem, usedMem }
            };
        }
        
        return {
            message: `System memory usage normal: ${usagePercent.toFixed(1)}%`,
            details: { usagePercent, totalMem, freeMem, usedMem }
        };
    }

    async checkDiskSpace() {
        try {
            const stats = fs.statSync(process.cwd());
            // Note: This is a simplified check. In production, you'd use a library
            // like 'statvfs' or 'df' to get actual disk space information
            
            return {
                message: 'Disk space check passed (simplified)',
                details: { note: 'Full disk space checking requires additional dependencies' }
            };
        } catch (error) {
            throw new Error(`Cannot access current directory: ${error.message}`);
        }
    }

    async checkCPUUsage() {
        const os = require('os');
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        const usage = (loadAvg[0] / cpuCount) * 100;
        
        if (usage > 90) {
            throw new Error(`CPU usage critical: ${usage.toFixed(1)}%`);
        }
        
        return {
            message: `CPU usage: ${usage.toFixed(1)}%`,
            details: { usage, loadAvg, cpuCount }
        };
    }

    async checkAppUptime() {
        const uptime = process.uptime();
        const uptimeHours = uptime / 3600;
        
        return {
            message: `Application uptime: ${uptimeHours.toFixed(1)} hours`,
            details: { uptime, uptimeHours }
        };
    }

    async checkAppMemory() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (usagePercent > 90) {
            throw new Error(`Application memory usage critical: ${usagePercent.toFixed(1)}%`);
        }
        
        return {
            message: `Application memory usage: ${usagePercent.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB)`,
            details: { heapUsedMB, heapTotalMB, usagePercent, memUsage }
        };
    }

    async checkLogDirectory() {
        const logDir = path.join(process.cwd(), 'logs');
        
        try {
            const stats = fs.statSync(logDir);
            if (!stats.isDirectory()) {
                throw new Error('Logs path exists but is not a directory');
            }
            
            // Check write permissions
            fs.accessSync(logDir, fs.constants.W_OK);
            
            return {
                message: 'Log directory is accessible and writable',
                details: { path: logDir }
            };
        } catch (error) {
            throw new Error(`Log directory check failed: ${error.message}`);
        }
    }

    async checkDataDirectory() {
        const dataDir = path.join(process.cwd(), 'data');
        
        try {
            const stats = fs.statSync(dataDir);
            if (!stats.isDirectory()) {
                throw new Error('Data path exists but is not a directory');
            }
            
            // Check write permissions
            fs.accessSync(dataDir, fs.constants.W_OK);
            
            return {
                message: 'Data directory is accessible and writable',
                details: { path: dataDir }
            };
        } catch (error) {
            throw new Error(`Data directory check failed: ${error.message}`);
        }
    }

    async checkDatabaseFile() {
        const dbPath = path.join(process.cwd(), 'data', 'merchants.db');
        
        try {
            const stats = fs.statSync(dbPath);
            const sizeKB = stats.size / 1024;
            
            return {
                message: `Database file accessible (${sizeKB.toFixed(1)}KB)`,
                details: { path: dbPath, size: stats.size, sizeKB }
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    message: 'Database file does not exist (will be created on first run)',
                    details: { path: dbPath, exists: false }
                };
            }
            throw new Error(`Database file check failed: ${error.message}`);
        }
    }

    async checkBrowserAvailability() {
        try {
            // This is a simplified check. In a real implementation,
            // you might try to launch a browser instance to verify it works
            const puppeteer = require('puppeteer');
            
            // Check if puppeteer is available
            if (!puppeteer) {
                throw new Error('Puppeteer not available');
            }
            
            return {
                message: 'Browser (Puppeteer) is available',
                details: { puppeteerVersion: require('puppeteer/package.json').version }
            };
        } catch (error) {
            throw new Error(`Browser availability check failed: ${error.message}`);
        }
    }

    async checkDependency(name) {
        const dependency = this.dependencies.get(name);
        if (!dependency) {
            throw new Error(`Unknown dependency: ${name}`);
        }
        
        if (dependency.type === 'http') {
            return this.checkHttpDependency(dependency);
        }
        
        throw new Error(`Unknown dependency type: ${dependency.type}`);
    }

    async checkHttpDependency(dependency) {
        // This would require adding an HTTP client like axios or fetch
        // For now, return a placeholder
        return {
            message: `HTTP dependency check not implemented: ${dependency.url}`,
            details: { dependency }
        };
    }

    /**
     * Get health status for a specific check
     */
    getCheckStatus(name) {
        return this.healthStatus.get(name);
    }

    /**
     * Get overall health status
     */
    getOverallHealth() {
        return this.healthStatus.get('_overall');
    }

    /**
     * Get all health statuses
     */
    getAllStatuses() {
        const statuses = {};
        for (const [name, status] of this.healthStatus) {
            statuses[name] = status;
        }
        return statuses;
    }

    /**
     * Get health summary
     */
    getHealthSummary() {
        const overall = this.getOverallHealth();
        const checks = this.getAllStatuses();
        
        // Remove overall from individual checks
        delete checks._overall;
        
        const summary = {
            overall: overall?.status || 'unknown',
            timestamp: Date.now(),
            statistics: {
                total: Object.keys(checks).length,
                healthy: 0,
                unhealthy: 0,
                unknown: 0
            },
            checks: {}
        };
        
        // Count statuses and build summary
        for (const [name, status] of Object.entries(checks)) {
            summary.statistics[status.status]++;
            summary.checks[name] = {
                status: status.status,
                lastCheck: status.lastCheck,
                message: status.message,
                consecutiveFailures: status.consecutiveFailures
            };
        }
        
        return summary;
    }

    /**
     * Check if system is healthy
     */
    isHealthy() {
        const overall = this.getOverallHealth();
        return overall?.status === 'healthy';
    }

    /**
     * Check if system has critical issues
     */
    hasCriticalIssues() {
        const overall = this.getOverallHealth();
        return overall?.status === 'critical';
    }

    /**
     * Get unhealthy checks
     */
    getUnhealthyChecks() {
        const unhealthy = {};
        for (const [name, status] of this.healthStatus) {
            if (name !== '_overall' && status.status === 'unhealthy') {
                unhealthy[name] = status;
            }
        }
        return unhealthy;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            checksRegistered: this.checks.size,
            dependenciesRegistered: this.dependencies.size,
            lastFullCheck: this.healthStatus.get('_overall')?.lastCheck
        };
    }
}

module.exports = HealthChecker;
