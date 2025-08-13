// src/services/monitoring/MetricsCollector.js
const os = require('os');
const process = require('process');
const { performance } = require('perf_hooks');

/**
 * Metrics Collection Service
 * Collects system metrics, application metrics, and scraper-specific metrics
 */
class MetricsCollector {
    constructor(config = {}) {
        this.config = {
            collectInterval: config.collectInterval || 30000, // 30 seconds
            retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
            maxDataPoints: config.maxDataPoints || 2880, // 24 hours at 30s intervals
            ...config
        };
        
        this.metrics = new Map();
        this.timeSeries = new Map();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.startTime = Date.now();
        this.isCollecting = false;
        this.collectionInterval = null;
        
        // Initialize metric types
        this.initializeMetrics();
    }

    /**
     * Initialize metric storage structures
     */
    initializeMetrics() {
        // System metrics
        this.gauges.set('system.cpu.usage', []);
        this.gauges.set('system.memory.usage', []);
        this.gauges.set('system.memory.total', []);
        this.gauges.set('system.memory.free', []);
        this.gauges.set('system.loadavg.1m', []);
        this.gauges.set('system.loadavg.5m', []);
        this.gauges.set('system.loadavg.15m', []);
        
        // Process metrics
        this.gauges.set('process.memory.rss', []);
        this.gauges.set('process.memory.heapUsed', []);
        this.gauges.set('process.memory.heapTotal', []);
        this.gauges.set('process.memory.external', []);
        this.gauges.set('process.cpu.usage', []);
        this.gauges.set('process.uptime', []);
        
        // Scraper metrics
        this.counters.set('scraper.runs.total', 0);
        this.counters.set('scraper.runs.success', 0);
        this.counters.set('scraper.runs.failed', 0);
        this.counters.set('scraper.merchants.scraped', 0);
        this.counters.set('scraper.pages.loaded', 0);
        this.counters.set('scraper.retries.count', 0);
        this.counters.set('scraper.errors.count', 0);
        
        this.gauges.set('scraper.duration.last', []);
        this.gauges.set('scraper.merchants.count', []);
        this.gauges.set('scraper.pages.loadTime', []);
        this.gauges.set('scraper.memory.peak', []);
        
        // Browser metrics
        this.gauges.set('browser.instances.active', []);
        this.gauges.set('browser.pages.open', []);
        this.gauges.set('browser.memory.usage', []);
        this.counters.set('browser.crashes.count', 0);
        this.counters.set('browser.timeouts.count', 0);
        
        // Database metrics
        this.counters.set('database.queries.total', 0);
        this.counters.set('database.queries.success', 0);
        this.counters.set('database.queries.failed', 0);
        this.gauges.set('database.query.duration', []);
        this.gauges.set('database.size.bytes', []);
        
        // Circuit breaker metrics
        this.counters.set('circuitBreaker.opens.count', 0);
        this.counters.set('circuitBreaker.closes.count', 0);
        this.gauges.set('circuitBreaker.failureRate', []);
        this.gauges.set('circuitBreaker.requestVolume', []);
    }

    /**
     * Start metrics collection
     */
    start() {
        if (this.isCollecting) {
            console.log('⚠️ Metrics collection already running');
            return;
        }

        this.isCollecting = true;
        this.collectionInterval = setInterval(() => {
            this.collectSystemMetrics();
            this.collectProcessMetrics();
            this.cleanupOldData();
        }, this.config.collectInterval);

        console.log(`✅ MetricsCollector started (interval: ${this.config.collectInterval}ms)`);
    }

    /**
     * Stop metrics collection
     */
    stop() {
        if (!this.isCollecting) {
            return;
        }

        this.isCollecting = false;
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }

        console.log('✅ MetricsCollector stopped');
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        const timestamp = Date.now();
        
        try {
            // CPU usage (average over load averages)
            const loadAvg = os.loadavg();
            const cpuCount = os.cpus().length;
            const cpuUsage = (loadAvg[0] / cpuCount) * 100;
            
            this.recordGauge('system.cpu.usage', cpuUsage, timestamp);
            this.recordGauge('system.loadavg.1m', loadAvg[0], timestamp);
            this.recordGauge('system.loadavg.5m', loadAvg[1], timestamp);
            this.recordGauge('system.loadavg.15m', loadAvg[2], timestamp);
            
            // Memory usage
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsagePercent = (usedMem / totalMem) * 100;
            
            this.recordGauge('system.memory.usage', memUsagePercent, timestamp);
            this.recordGauge('system.memory.total', totalMem, timestamp);
            this.recordGauge('system.memory.free', freeMem, timestamp);
            
        } catch (error) {
            console.error('Error collecting system metrics:', error.message);
        }
    }

    /**
     * Collect process metrics
     */
    collectProcessMetrics() {
        const timestamp = Date.now();
        
        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            this.recordGauge('process.memory.rss', memUsage.rss, timestamp);
            this.recordGauge('process.memory.heapUsed', memUsage.heapUsed, timestamp);
            this.recordGauge('process.memory.heapTotal', memUsage.heapTotal, timestamp);
            this.recordGauge('process.memory.external', memUsage.external, timestamp);
            
            // CPU usage
            const cpuUsage = process.cpuUsage();
            const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
            this.recordGauge('process.cpu.usage', totalUsage, timestamp);
            
            // Uptime
            this.recordGauge('process.uptime', process.uptime(), timestamp);
            
        } catch (error) {
            console.error('Error collecting process metrics:', error.message);
        }
    }

    /**
     * Record a counter metric
     */
    incrementCounter(name, value = 1, tags = {}) {
        const currentValue = this.counters.get(name) || 0;
        this.counters.set(name, currentValue + value);
        
        // Also record as time series for trend analysis
        this.recordTimeSeries(`${name}.rate`, value, Date.now(), tags);
    }

    /**
     * Record a gauge metric
     */
    recordGauge(name, value, timestamp = Date.now(), tags = {}) {
        if (!this.gauges.has(name)) {
            this.gauges.set(name, []);
        }
        
        const dataPoints = this.gauges.get(name);
        dataPoints.push({ value, timestamp, tags });
        
        // Limit data points
        if (dataPoints.length > this.config.maxDataPoints) {
            dataPoints.shift();
        }
    }

    /**
     * Record a histogram metric (for timing data)
     */
    recordHistogram(name, value, timestamp = Date.now(), tags = {}) {
        if (!this.histograms.has(name)) {
            this.histograms.set(name, []);
        }
        
        const dataPoints = this.histograms.get(name);
        dataPoints.push({ value, timestamp, tags });
        
        // Limit data points
        if (dataPoints.length > this.config.maxDataPoints) {
            dataPoints.shift();
        }
    }

    /**
     * Record time series data
     */
    recordTimeSeries(name, value, timestamp = Date.now(), tags = {}) {
        if (!this.timeSeries.has(name)) {
            this.timeSeries.set(name, []);
        }
        
        const dataPoints = this.timeSeries.get(name);
        dataPoints.push({ value, timestamp, tags });
        
        // Limit data points
        if (dataPoints.length > this.config.maxDataPoints) {
            dataPoints.shift();
        }
    }

    /**
     * Time a function execution
     */
    async timeFunction(name, fn, tags = {}) {
        const startTime = performance.now();
        
        try {
            const result = await fn();
            const duration = performance.now() - startTime;
            
            this.recordHistogram(`${name}.duration`, duration, Date.now(), tags);
            this.incrementCounter(`${name}.success`, 1, tags);
            
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            
            this.recordHistogram(`${name}.duration`, duration, Date.now(), { ...tags, error: true });
            this.incrementCounter(`${name}.failed`, 1, tags);
            
            throw error;
        }
    }

    /**
     * Get current counter value
     */
    getCounter(name) {
        return this.counters.get(name) || 0;
    }

    /**
     * Get latest gauge value
     */
    getGauge(name) {
        const dataPoints = this.gauges.get(name);
        if (!dataPoints || dataPoints.length === 0) {
            return null;
        }
        return dataPoints[dataPoints.length - 1];
    }

    /**
     * Get gauge values within a time range
     */
    getGaugeRange(name, startTime, endTime = Date.now()) {
        const dataPoints = this.gauges.get(name) || [];
        return dataPoints.filter(point => 
            point.timestamp >= startTime && point.timestamp <= endTime
        );
    }

    /**
     * Get histogram statistics
     */
    getHistogramStats(name, windowMs = 300000) { // 5 minutes default
        const now = Date.now();
        const dataPoints = this.histograms.get(name) || [];
        const recentPoints = dataPoints.filter(point => 
            point.timestamp >= (now - windowMs)
        );
        
        if (recentPoints.length === 0) {
            return null;
        }
        
        const values = recentPoints.map(p => p.value).sort((a, b) => a - b);
        const count = values.length;
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / count;
        
        return {
            count,
            sum,
            avg,
            min: values[0],
            max: values[count - 1],
            p50: this.getPercentile(values, 0.5),
            p90: this.getPercentile(values, 0.9),
            p95: this.getPercentile(values, 0.95),
            p99: this.getPercentile(values, 0.99)
        };
    }

    /**
     * Calculate percentile from sorted array
     */
    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * Get all current metrics summary
     */
    getMetricsSummary() {
        const summary = {
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
            counters: Object.fromEntries(this.counters),
            gauges: {},
            system: {},
            scraper: {},
            browser: {},
            database: {}
        };

        // Latest gauge values
        for (const [name, dataPoints] of this.gauges) {
            if (dataPoints.length > 0) {
                const latest = dataPoints[dataPoints.length - 1];
                summary.gauges[name] = latest.value;
                
                // Categorize metrics
                if (name.startsWith('system.')) {
                    summary.system[name.replace('system.', '')] = latest.value;
                } else if (name.startsWith('scraper.')) {
                    summary.scraper[name.replace('scraper.', '')] = latest.value;
                } else if (name.startsWith('browser.')) {
                    summary.browser[name.replace('browser.', '')] = latest.value;
                } else if (name.startsWith('database.')) {
                    summary.database[name.replace('database.', '')] = latest.value;
                }
            }
        }

        return summary;
    }

    /**
     * Get metrics for a specific time range
     */
    getMetricsInRange(startTime, endTime = Date.now()) {
        const result = {
            startTime,
            endTime,
            gauges: {},
            histograms: {},
            timeSeries: {}
        };

        // Filter gauge data
        for (const [name, dataPoints] of this.gauges) {
            result.gauges[name] = dataPoints.filter(point => 
                point.timestamp >= startTime && point.timestamp <= endTime
            );
        }

        // Filter histogram data
        for (const [name, dataPoints] of this.histograms) {
            result.histograms[name] = dataPoints.filter(point => 
                point.timestamp >= startTime && point.timestamp <= endTime
            );
        }

        // Filter time series data
        for (const [name, dataPoints] of this.timeSeries) {
            result.timeSeries[name] = dataPoints.filter(point => 
                point.timestamp >= startTime && point.timestamp <= endTime
            );
        }

        return result;
    }

    /**
     * Clean up old metric data
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - this.config.retentionPeriod;
        
        // Clean gauges
        for (const [name, dataPoints] of this.gauges) {
            const filteredPoints = dataPoints.filter(point => point.timestamp > cutoffTime);
            this.gauges.set(name, filteredPoints);
        }
        
        // Clean histograms
        for (const [name, dataPoints] of this.histograms) {
            const filteredPoints = dataPoints.filter(point => point.timestamp > cutoffTime);
            this.histograms.set(name, filteredPoints);
        }
        
        // Clean time series
        for (const [name, dataPoints] of this.timeSeries) {
            const filteredPoints = dataPoints.filter(point => point.timestamp > cutoffTime);
            this.timeSeries.set(name, filteredPoints);
        }
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.timeSeries.clear();
        this.initializeMetrics();
        console.log('✅ All metrics reset');
    }

    /**
     * Export metrics data
     */
    exportMetrics() {
        return {
            timestamp: Date.now(),
            config: this.config,
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(this.histograms),
            timeSeries: Object.fromEntries(this.timeSeries)
        };
    }

    /**
     * Get collection status
     */
    getStatus() {
        return {
            isCollecting: this.isCollecting,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime,
            config: this.config,
            metricsCount: {
                counters: this.counters.size,
                gauges: this.gauges.size,
                histograms: this.histograms.size,
                timeSeries: this.timeSeries.size
            }
        };
    }
}

module.exports = MetricsCollector;
