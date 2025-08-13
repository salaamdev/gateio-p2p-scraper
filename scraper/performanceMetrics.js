// scraper/performanceMetrics.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Performance Metrics Collection System
 * 
 * Features:
 * - System resource monitoring (CPU, Memory, Disk)
 * - Application performance tracking
 * - Custom metric collection
 * - Real-time monitoring
 * - Historical data storage
 * - Performance alerts and thresholds
 * - Metric aggregation and analysis
 * - Performance reporting
 */

/**
 * Metric Types
 */
const METRIC_TYPES = {
    COUNTER: 'counter',
    GAUGE: 'gauge',
    HISTOGRAM: 'histogram',
    TIMER: 'timer',
    RATE: 'rate'
};

/**
 * Metric Categories
 */
const METRIC_CATEGORIES = {
    SYSTEM: 'system',
    APPLICATION: 'application',
    SCRAPING: 'scraping',
    DATABASE: 'database',
    NETWORK: 'network',
    BUSINESS: 'business',
    CUSTOM: 'custom'
};

/**
 * Base Metric Class
 */
class Metric {
    constructor(name, type, options = {}) {
        this.name = name;
        this.type = type;
        this.category = options.category || METRIC_CATEGORIES.CUSTOM;
        this.description = options.description || '';
        this.unit = options.unit || '';
        this.tags = options.tags || {};
        this.timestamps = [];
        this.values = [];
        this.maxDataPoints = options.maxDataPoints || 1000;
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }

    record(value, timestamp = Date.now()) {
        this.values.push(value);
        this.timestamps.push(timestamp);
        this.updatedAt = timestamp;

        // Keep only the latest data points
        if (this.values.length > this.maxDataPoints) {
            this.values.shift();
            this.timestamps.shift();
        }

        this.onRecord?.(value, timestamp);
    }

    getValue() {
        return this.values.length > 0 ? this.values[this.values.length - 1] : null;
    }

    getValues(count = null) {
        if (count === null) return [...this.values];
        return this.values.slice(-count);
    }

    getStatistics() {
        if (this.values.length === 0) {
            return {
                count: 0,
                min: null,
                max: null,
                mean: null,
                median: null,
                sum: null,
                variance: null,
                stdDev: null
            };
        }

        const sorted = [...this.values].sort((a, b) => a - b);
        const count = this.values.length;
        const sum = this.values.reduce((a, b) => a + b, 0);
        const mean = sum / count;
        
        const variance = this.values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
        const stdDev = Math.sqrt(variance);
        
        const median = count % 2 === 0 
            ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
            : sorted[Math.floor(count / 2)];

        return {
            count,
            min: sorted[0],
            max: sorted[count - 1],
            mean,
            median,
            sum,
            variance,
            stdDev,
            latest: this.getValue(),
            oldest: this.values[0]
        };
    }

    reset() {
        this.values = [];
        this.timestamps = [];
        this.updatedAt = Date.now();
    }

    toJSON() {
        return {
            name: this.name,
            type: this.type,
            category: this.category,
            description: this.description,
            unit: this.unit,
            tags: this.tags,
            statistics: this.getStatistics(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * Counter Metric - monotonically increasing value
 */
class Counter extends Metric {
    constructor(name, options = {}) {
        super(name, METRIC_TYPES.COUNTER, options);
        this.count = 0;
    }

    increment(value = 1) {
        this.count += value;
        this.record(this.count);
        return this.count;
    }

    getValue() {
        return this.count;
    }

    reset() {
        this.count = 0;
        super.reset();
    }
}

/**
 * Gauge Metric - arbitrary value that can go up and down
 */
class Gauge extends Metric {
    constructor(name, options = {}) {
        super(name, METRIC_TYPES.GAUGE, options);
        this.value = 0;
    }

    set(value) {
        this.value = value;
        this.record(value);
        return value;
    }

    increment(value = 1) {
        this.value += value;
        this.record(this.value);
        return this.value;
    }

    decrement(value = 1) {
        this.value -= value;
        this.record(this.value);
        return this.value;
    }

    getValue() {
        return this.value;
    }
}

/**
 * Histogram Metric - tracks distribution of values
 */
class Histogram extends Metric {
    constructor(name, options = {}) {
        super(name, METRIC_TYPES.HISTOGRAM, options);
        this.buckets = options.buckets || [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100];
        this.bucketCounts = new Array(this.buckets.length + 1).fill(0);
        this.totalCount = 0;
        this.totalSum = 0;
    }

    observe(value) {
        this.record(value);
        this.totalCount++;
        this.totalSum += value;

        // Find the appropriate bucket
        let bucketIndex = this.buckets.findIndex(bucket => value <= bucket);
        if (bucketIndex === -1) {
            bucketIndex = this.buckets.length; // Overflow bucket
        }
        this.bucketCounts[bucketIndex]++;
    }

    getPercentile(percentile) {
        if (this.values.length === 0) return null;
        
        const sorted = [...this.values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    getBucketCounts() {
        return this.buckets.map((bucket, index) => ({
            bucket,
            count: this.bucketCounts[index],
            percentage: this.totalCount > 0 ? (this.bucketCounts[index] / this.totalCount) * 100 : 0
        }));
    }

    getStatistics() {
        const baseStats = super.getStatistics();
        return {
            ...baseStats,
            totalCount: this.totalCount,
            totalSum: this.totalSum,
            mean: this.totalCount > 0 ? this.totalSum / this.totalCount : 0,
            p50: this.getPercentile(50),
            p90: this.getPercentile(90),
            p95: this.getPercentile(95),
            p99: this.getPercentile(99),
            buckets: this.getBucketCounts()
        };
    }

    reset() {
        super.reset();
        this.bucketCounts.fill(0);
        this.totalCount = 0;
        this.totalSum = 0;
    }
}

/**
 * Timer Metric - measures duration
 */
class Timer extends Metric {
    constructor(name, options = {}) {
        super(name, METRIC_TYPES.TIMER, options);
        this.activeTimers = new Map();
    }

    start(label = 'default') {
        const startTime = Date.now();
        this.activeTimers.set(label, startTime);
        return startTime;
    }

    end(label = 'default') {
        const startTime = this.activeTimers.get(label);
        if (!startTime) {
            throw new Error(`Timer with label '${label}' was not started`);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.activeTimers.delete(label);
        this.record(duration);
        
        return duration;
    }

    time(fn, label = 'default') {
        if (typeof fn !== 'function') {
            throw new Error('First argument must be a function');
        }

        const startTime = this.start(label);
        try {
            const result = fn();
            
            // Handle promises
            if (result && typeof result.then === 'function') {
                return result
                    .then(value => {
                        this.end(label);
                        return value;
                    })
                    .catch(error => {
                        this.end(label);
                        throw error;
                    });
            }
            
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }

    async timeAsync(fn, label = 'default') {
        if (typeof fn !== 'function') {
            throw new Error('First argument must be a function');
        }

        const startTime = this.start(label);
        try {
            const result = await fn();
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }

    getActiveTimers() {
        return Array.from(this.activeTimers.entries()).map(([label, startTime]) => ({
            label,
            startTime,
            elapsed: Date.now() - startTime
        }));
    }
}

/**
 * Rate Metric - measures rate of events over time
 */
class Rate extends Metric {
    constructor(name, options = {}) {
        super(name, METRIC_TYPES.RATE, options);
        this.windowSize = options.windowSize || 60000; // 1 minute default
        this.events = [];
    }

    mark(timestamp = Date.now()) {
        this.events.push(timestamp);
        this.cleanupOldEvents(timestamp);
        
        const rate = this.getRate(timestamp);
        this.record(rate, timestamp);
        
        return rate;
    }

    cleanupOldEvents(currentTime) {
        const cutoff = currentTime - this.windowSize;
        this.events = this.events.filter(timestamp => timestamp > cutoff);
    }

    getRate(timestamp = Date.now()) {
        this.cleanupOldEvents(timestamp);
        return (this.events.length / this.windowSize) * 1000; // events per second
    }

    reset() {
        super.reset();
        this.events = [];
    }
}

/**
 * System Metrics Collector
 */
class SystemMetricsCollector {
    constructor(options = {}) {
        this.options = {
            interval: options.interval || 5000, // 5 seconds
            enabled: options.enabled !== false,
            ...options
        };

        this.metrics = {
            cpuUsage: new Gauge('system_cpu_usage', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'CPU usage percentage',
                unit: 'percent'
            }),
            memoryUsage: new Gauge('system_memory_usage', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'Memory usage in bytes',
                unit: 'bytes'
            }),
            memoryUsagePercent: new Gauge('system_memory_usage_percent', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'Memory usage percentage',
                unit: 'percent'
            }),
            freeMemory: new Gauge('system_free_memory', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'Free memory in bytes',
                unit: 'bytes'
            }),
            loadAverage: new Gauge('system_load_average', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'System load average',
                unit: 'load'
            }),
            uptime: new Gauge('system_uptime', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'System uptime in seconds',
                unit: 'seconds'
            }),
            processMemory: new Gauge('process_memory_usage', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Process memory usage in bytes',
                unit: 'bytes'
            }),
            processUptime: new Gauge('process_uptime', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Process uptime in seconds',
                unit: 'seconds'
            }),
            activeHandles: new Gauge('process_active_handles', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Number of active handles',
                unit: 'count'
            }),
            eventLoopLag: new Gauge('event_loop_lag', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Event loop lag in milliseconds',
                unit: 'milliseconds'
            })
        };

        this.intervalId = null;
        this.lastCpuUsage = process.cpuUsage();
        this.lastCheck = Date.now();
    }

    start() {
        if (!this.options.enabled || this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.collect();
        }, this.options.interval);

        // Collect initial metrics
        this.collect();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    collect() {
        try {
            this.collectSystemMetrics();
            this.collectProcessMetrics();
            this.collectEventLoopLag();
        } catch (error) {
            console.error('Failed to collect system metrics:', error);
        }
    }

    collectSystemMetrics() {
        // Memory metrics
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;

        this.metrics.memoryUsage.set(usedMemory);
        this.metrics.memoryUsagePercent.set(memoryUsagePercent);
        this.metrics.freeMemory.set(freeMemory);

        // Load average (Unix-like systems only)
        try {
            const loadAvg = os.loadavg();
            this.metrics.loadAverage.set(loadAvg[0]); // 1-minute load average
        } catch (loadError) {
            // Load average not available on this platform
        }

        // System uptime
        this.metrics.uptime.set(os.uptime());

        // CPU usage
        this.collectCpuUsage();
    }

    collectCpuUsage() {
        const currentUsage = process.cpuUsage();
        const currentTime = Date.now();
        
        if (this.lastCpuUsage) {
            const timeDiff = currentTime - this.lastCheck;
            const userDiff = currentUsage.user - this.lastCpuUsage.user;
            const sysDiff = currentUsage.system - this.lastCpuUsage.system;
            
            // Convert to percentage
            const totalDiff = userDiff + sysDiff;
            const cpuPercent = (totalDiff / (timeDiff * 1000)) * 100; // timeDiff is in ms, but cpuUsage is in microseconds
            
            this.metrics.cpuUsage.set(Math.min(cpuPercent, 100)); // Cap at 100%
        }
        
        this.lastCpuUsage = currentUsage;
        this.lastCheck = currentTime;
    }

    collectProcessMetrics() {
        // Process memory
        const memUsage = process.memoryUsage();
        this.metrics.processMemory.set(memUsage.rss);

        // Process uptime
        this.metrics.processUptime.set(process.uptime());

        // Active handles and requests
        if (process._getActiveHandles) {
            this.metrics.activeHandles.set(process._getActiveHandles().length);
        }
    }

    collectEventLoopLag() {
        const start = Date.now();
        setImmediate(() => {
            const lag = Date.now() - start;
            this.metrics.eventLoopLag.set(lag);
        });
    }

    getMetrics() {
        const result = {};
        for (const [name, metric] of Object.entries(this.metrics)) {
            result[name] = metric.toJSON();
        }
        return result;
    }
}

/**
 * Performance Metrics Manager
 */
class PerformanceMetrics {
    constructor(options = {}) {
        this.options = {
            enableSystemMetrics: options.enableSystemMetrics !== false,
            systemMetricsInterval: options.systemMetricsInterval || 5000,
            maxMetrics: options.maxMetrics || 1000,
            persistenceEnabled: options.persistenceEnabled !== false,
            persistenceInterval: options.persistenceInterval || 60000, // 1 minute
            dataDirectory: options.dataDirectory || path.join(process.cwd(), 'data', 'metrics'),
            ...options
        };

        this.metrics = new Map();
        this.systemCollector = null;
        this.persistenceTimer = null;
        this.alerts = new Map();
        this.thresholds = new Map();

        this.initializeSystemMetrics();
        this.initializePersistence();
    }

    initializeSystemMetrics() {
        if (this.options.enableSystemMetrics) {
            this.systemCollector = new SystemMetricsCollector({
                interval: this.options.systemMetricsInterval
            });
            this.systemCollector.start();

            // Register system metrics
            for (const [name, metric] of Object.entries(this.systemCollector.metrics)) {
                this.metrics.set(name, metric);
            }
        }
    }

    initializePersistence() {
        if (this.options.persistenceEnabled) {
            this.persistenceTimer = setInterval(() => {
                this.persistMetrics();
            }, this.options.persistenceInterval);
        }
    }

    /**
     * Metric registration and management
     */
    registerMetric(name, metric) {
        if (this.metrics.has(name)) {
            throw new Error(`Metric '${name}' already exists`);
        }
        
        this.metrics.set(name, metric);
        return metric;
    }

    getMetric(name) {
        return this.metrics.get(name);
    }

    hasMetric(name) {
        return this.metrics.has(name);
    }

    removeMetric(name) {
        return this.metrics.delete(name);
    }

    listMetrics() {
        return Array.from(this.metrics.keys());
    }

    /**
     * Convenience methods for creating metrics
     */
    createCounter(name, options = {}) {
        const counter = new Counter(name, options);
        this.registerMetric(name, counter);
        return counter;
    }

    createGauge(name, options = {}) {
        const gauge = new Gauge(name, options);
        this.registerMetric(name, gauge);
        return gauge;
    }

    createHistogram(name, options = {}) {
        const histogram = new Histogram(name, options);
        this.registerMetric(name, histogram);
        return histogram;
    }

    createTimer(name, options = {}) {
        const timer = new Timer(name, options);
        this.registerMetric(name, timer);
        return timer;
    }

    createRate(name, options = {}) {
        const rate = new Rate(name, options);
        this.registerMetric(name, rate);
        return rate;
    }

    /**
     * Threshold and alerting
     */
    setThreshold(metricName, threshold) {
        this.thresholds.set(metricName, threshold);
    }

    checkThresholds() {
        const alerts = [];
        
        for (const [metricName, threshold] of this.thresholds) {
            const metric = this.metrics.get(metricName);
            if (!metric) continue;
            
            const value = metric.getValue();
            if (value === null) continue;
            
            const alert = this.evaluateThreshold(metricName, value, threshold);
            if (alert) {
                alerts.push(alert);
                this.alerts.set(metricName, alert);
            } else {
                this.alerts.delete(metricName);
            }
        }
        
        return alerts;
    }

    evaluateThreshold(metricName, value, threshold) {
        const {
            operator = '>',
            value: thresholdValue,
            severity = 'warning',
            message = null
        } = threshold;
        
        let triggered = false;
        
        switch (operator) {
            case '>':
                triggered = value > thresholdValue;
                break;
            case '>=':
                triggered = value >= thresholdValue;
                break;
            case '<':
                triggered = value < thresholdValue;
                break;
            case '<=':
                triggered = value <= thresholdValue;
                break;
            case '==':
                triggered = value === thresholdValue;
                break;
            case '!=':
                triggered = value !== thresholdValue;
                break;
        }
        
        if (triggered) {
            return {
                metricName,
                value,
                threshold,
                severity,
                message: message || `Metric ${metricName} ${operator} ${thresholdValue} (current: ${value})`,
                timestamp: Date.now()
            };
        }
        
        return null;
    }

    getActiveAlerts() {
        return Array.from(this.alerts.values());
    }

    /**
     * Data export and reporting
     */
    getAllMetrics() {
        const result = {};
        
        for (const [name, metric] of this.metrics) {
            result[name] = metric.toJSON();
        }
        
        return result;
    }

    getMetricsByCategory(category) {
        const result = {};
        
        for (const [name, metric] of this.metrics) {
            if (metric.category === category) {
                result[name] = metric.toJSON();
            }
        }
        
        return result;
    }

    generateReport() {
        const metrics = this.getAllMetrics();
        const alerts = this.getActiveAlerts();
        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            totalMemory: os.totalmem(),
            cpuCount: os.cpus().length,
            uptime: os.uptime(),
            processUptime: process.uptime()
        };
        
        return {
            timestamp: new Date().toISOString(),
            systemInfo,
            metrics,
            alerts,
            summary: this.generateSummary(metrics)
        };
    }

    generateSummary(metrics) {
        const summary = {
            totalMetrics: Object.keys(metrics).length,
            byCategory: {},
            byType: {},
            healthStatus: 'healthy'
        };
        
        for (const metric of Object.values(metrics)) {
            // Count by category
            summary.byCategory[metric.category] = (summary.byCategory[metric.category] || 0) + 1;
            
            // Count by type
            summary.byType[metric.type] = (summary.byType[metric.type] || 0) + 1;
        }
        
        // Determine health status
        const alerts = this.getActiveAlerts();
        if (alerts.some(alert => alert.severity === 'critical')) {
            summary.healthStatus = 'critical';
        } else if (alerts.some(alert => alert.severity === 'warning')) {
            summary.healthStatus = 'warning';
        }
        
        return summary;
    }

    /**
     * Persistence
     */
    async persistMetrics() {
        if (!this.options.persistenceEnabled) return;
        
        try {
            await fs.mkdir(this.options.dataDirectory, { recursive: true });
            
            const report = this.generateReport();
            const filename = `metrics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const filepath = path.join(this.options.dataDirectory, filename);
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            
            // Cleanup old files (keep last 24 hours worth)
            await this.cleanupOldMetricFiles();
        } catch (error) {
            console.error('Failed to persist metrics:', error);
        }
    }

    async cleanupOldMetricFiles() {
        try {
            const files = await fs.readdir(this.options.dataDirectory);
            const metricFiles = files
                .filter(f => f.startsWith('metrics_') && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.options.dataDirectory, f)
                }));
            
            // Get file stats and sort by modification time
            const fileStats = await Promise.all(
                metricFiles.map(async (file) => {
                    try {
                        const stats = await fs.stat(file.path);
                        return { ...file, mtime: stats.mtime };
                    } catch (statError) {
                        return null;
                    }
                })
            );
            
            const validFiles = fileStats
                .filter(f => f !== null)
                .sort((a, b) => b.mtime - a.mtime);
            
            // Keep only the last 144 files (24 hours worth with 10-minute intervals)
            const filesToDelete = validFiles.slice(144);
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    console.warn(`Failed to delete old metric file ${file.name}:`, unlinkError);
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old metric files:', error);
        }
    }

    /**
     * Shutdown
     */
    async shutdown() {
        // Stop system metrics collection
        if (this.systemCollector) {
            this.systemCollector.stop();
        }
        
        // Stop persistence timer
        if (this.persistenceTimer) {
            clearInterval(this.persistenceTimer);
        }
        
        // Final persistence
        await this.persistMetrics();
        
        // Clear all metrics
        this.metrics.clear();
        this.alerts.clear();
        this.thresholds.clear();
    }
}

/**
 * Global metrics instance
 */
let globalMetrics = null;

/**
 * Factory functions
 */
function createMetrics(options = {}) {
    return new PerformanceMetrics(options);
}

function getGlobalMetrics() {
    if (!globalMetrics) {
        globalMetrics = createMetrics();
    }
    return globalMetrics;
}

function setGlobalMetrics(metrics) {
    globalMetrics = metrics;
}

module.exports = {
    PerformanceMetrics,
    SystemMetricsCollector,
    Metric,
    Counter,
    Gauge,
    Histogram,
    Timer,
    Rate,
    METRIC_TYPES,
    METRIC_CATEGORIES,
    createMetrics,
    getGlobalMetrics,
    setGlobalMetrics
};
