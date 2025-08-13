// scraper/rateLimiting.js
const { log, errorLog } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Rate Limiting and Request Throttling System
 * 
 * Features:
 * - Token bucket rate limiting
 * - Sliding window rate limiting
 * - Request queue management
 * - Adaptive throttling
 * - Domain-specific rate limiting
 * - Burst handling
 * - Performance metrics
 */

/**
 * Rate Limiting Algorithms
 */
const RATE_LIMIT_ALGORITHMS = {
    TOKEN_BUCKET: 'TOKEN_BUCKET',
    SLIDING_WINDOW: 'SLIDING_WINDOW',
    FIXED_WINDOW: 'FIXED_WINDOW',
    LEAKY_BUCKET: 'LEAKY_BUCKET'
};

/**
 * Request Priority Levels
 */
const REQUEST_PRIORITY = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    NORMAL: 'NORMAL',
    LOW: 'LOW',
    BACKGROUND: 'BACKGROUND'
};

/**
 * Token Bucket Rate Limiter
 */
class TokenBucketLimiter {
    constructor(options = {}) {
        this.capacity = options.capacity || 100; // Maximum tokens
        this.refillRate = options.refillRate || 10; // Tokens per second
        this.tokens = options.initialTokens || this.capacity;
        this.lastRefill = Date.now();
        this.identifier = options.identifier || 'default';
    }

    /**
     * Check if request can be processed
     */
    canProcess(tokensRequired = 1) {
        this.refill();
        return this.tokens >= tokensRequired;
    }

    /**
     * Consume tokens
     */
    consume(tokensRequired = 1) {
        this.refill();
        
        if (this.tokens >= tokensRequired) {
            this.tokens -= tokensRequired;
            return true;
        }
        
        return false;
    }

    /**
     * Get time until next token available
     */
    getTimeUntilToken() {
        this.refill();
        
        if (this.tokens >= 1) {
            return 0;
        }
        
        return Math.ceil(1000 / this.refillRate); // milliseconds
    }

    /**
     * Refill tokens based on time elapsed
     */
    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000; // seconds
        const tokensToAdd = Math.floor(timePassed * this.refillRate);
        
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        this.refill();
        return {
            identifier: this.identifier,
            tokens: this.tokens,
            capacity: this.capacity,
            refillRate: this.refillRate,
            utilizationPercent: ((this.capacity - this.tokens) / this.capacity) * 100
        };
    }
}

/**
 * Sliding Window Rate Limiter
 */
class SlidingWindowLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 100;
        this.windowSizeMs = options.windowSizeMs || 60000; // 1 minute
        this.requests = [];
        this.identifier = options.identifier || 'default';
    }

    /**
     * Check if request can be processed
     */
    canProcess() {
        this.cleanOldRequests();
        return this.requests.length < this.maxRequests;
    }

    /**
     * Record a request
     */
    recordRequest() {
        this.cleanOldRequests();
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(Date.now());
            return true;
        }
        
        return false;
    }

    /**
     * Get time until next request allowed
     */
    getTimeUntilNextRequest() {
        this.cleanOldRequests();
        
        if (this.requests.length < this.maxRequests) {
            return 0;
        }
        
        const oldestRequest = this.requests[0];
        const timeUntilExpiry = (oldestRequest + this.windowSizeMs) - Date.now();
        return Math.max(0, timeUntilExpiry);
    }

    /**
     * Clean old requests outside the window
     */
    cleanOldRequests() {
        const now = Date.now();
        const cutoff = now - this.windowSizeMs;
        this.requests = this.requests.filter(timestamp => timestamp > cutoff);
    }

    /**
     * Get current status
     */
    getStatus() {
        this.cleanOldRequests();
        return {
            identifier: this.identifier,
            currentRequests: this.requests.length,
            maxRequests: this.maxRequests,
            windowSizeMs: this.windowSizeMs,
            utilizationPercent: (this.requests.length / this.maxRequests) * 100
        };
    }
}

/**
 * Request Queue Item
 */
class RequestQueueItem {
    constructor(request, options = {}) {
        this.id = options.id || this.generateId();
        this.request = request;
        this.priority = options.priority || REQUEST_PRIORITY.NORMAL;
        this.createdAt = Date.now();
        this.attempts = 0;
        this.maxAttempts = options.maxAttempts || 3;
        this.delay = options.delay || 0;
        this.executeAt = this.createdAt + this.delay;
        this.metadata = options.metadata || {};
        this.callback = options.callback || null;
        this.timeout = options.timeout || 30000;
    }

    generateId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    incrementAttempt() {
        this.attempts++;
        return this.attempts;
    }

    canRetry() {
        return this.attempts < this.maxAttempts;
    }

    isReady() {
        return Date.now() >= this.executeAt;
    }

    reschedule(delayMs) {
        this.executeAt = Date.now() + delayMs;
    }
}

/**
 * Rate Limiting Manager
 */
class RateLimitingManager {
    constructor(options = {}) {
        this.options = {
            enablePersistence: options.enablePersistence !== false,
            persistenceStorePath: options.persistenceStorePath || path.join(process.cwd(), 'data', 'rate-limits'),
            defaultAlgorithm: options.defaultAlgorithm || RATE_LIMIT_ALGORITHMS.TOKEN_BUCKET,
            globalLimits: {
                requestsPerSecond: options.globalLimits?.requestsPerSecond || 10,
                burstCapacity: options.globalLimits?.burstCapacity || 50,
                concurrentRequests: options.globalLimits?.concurrentRequests || 5
            },
            adaptiveThrottling: options.adaptiveThrottling !== false,
            queueSize: options.queueSize || 1000,
            processingInterval: options.processingInterval || 100, // milliseconds
            ...options
        };

        // Rate limiters by domain/identifier
        this.limiters = new Map();
        
        // Request queue with priority
        this.requestQueue = [];
        this.processingQueue = false;
        this.processTimer = null;
        
        // Active requests tracking
        this.activeRequests = new Map();
        this.requestStats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            throttledRequests: 0,
            queuedRequests: 0,
            averageResponseTime: 0,
            responseTimesBuffer: []
        };

        // Adaptive throttling state
        this.adaptiveState = {
            currentLevel: 1.0, // 1.0 = normal speed, 0.5 = half speed, etc.
            errorRate: 0,
            responseTimeThreshold: 5000, // 5 seconds
            adjustmentInterval: 30000, // 30 seconds
            lastAdjustment: Date.now()
        };

        this.monitoringService = options.monitoringService || null;
        this.alertManager = options.alertManager || null;

        this.initializeRateLimiting();
    }

    /**
     * Initialize rate limiting system
     */
    async initializeRateLimiting() {
        try {
            // Create persistence directory
            if (this.options.enablePersistence) {
                await fs.mkdir(this.options.persistenceStorePath, { recursive: true });
                await this.loadPersistedState();
            }

            // Start queue processing
            this.startQueueProcessing();

            // Start adaptive throttling monitor
            if (this.options.adaptiveThrottling) {
                this.startAdaptiveThrottling();
            }

            log('RateLimitingManager initialized successfully');
        } catch (error) {
            errorLog('Failed to initialize RateLimitingManager:', error);
        }
    }

    /**
     * Create or get rate limiter for identifier
     */
    getRateLimiter(identifier, config = {}) {
        if (!this.limiters.has(identifier)) {
            const algorithm = config.algorithm || this.options.defaultAlgorithm;
            
            let limiter;
            switch (algorithm) {
                case RATE_LIMIT_ALGORITHMS.TOKEN_BUCKET:
                    limiter = new TokenBucketLimiter({
                        identifier,
                        capacity: config.capacity || this.options.globalLimits.burstCapacity,
                        refillRate: config.refillRate || this.options.globalLimits.requestsPerSecond,
                        ...config
                    });
                    break;
                    
                case RATE_LIMIT_ALGORITHMS.SLIDING_WINDOW:
                    limiter = new SlidingWindowLimiter({
                        identifier,
                        maxRequests: config.maxRequests || this.options.globalLimits.burstCapacity,
                        windowSizeMs: config.windowSizeMs || 60000,
                        ...config
                    });
                    break;
                    
                default:
                    throw new Error(`Unsupported rate limiting algorithm: ${algorithm}`);
            }
            
            this.limiters.set(identifier, limiter);
            log(`Created rate limiter for ${identifier} using ${algorithm}`);
        }
        
        return this.limiters.get(identifier);
    }

    /**
     * Queue a request for processing
     */
    async queueRequest(request, options = {}) {
        // Check queue size limit
        if (this.requestQueue.length >= this.options.queueSize) {
            throw new Error(`Request queue is full (${this.options.queueSize} items)`);
        }

        const queueItem = new RequestQueueItem(request, options);
        
        // Add to queue with priority ordering
        this.insertByPriority(queueItem);
        
        this.requestStats.queuedRequests++;
        
        log(`Request queued: ${queueItem.id} (Priority: ${queueItem.priority})`);

        // Return promise that resolves when request is processed
        return new Promise((resolve, reject) => {
            queueItem.resolve = resolve;
            queueItem.reject = reject;
            
            // Set timeout
            setTimeout(() => {
                if (!queueItem.processed) {
                    queueItem.processed = true;
                    this.removeFromQueue(queueItem.id);
                    reject(new Error(`Request timeout: ${queueItem.id}`));
                }
            }, queueItem.timeout);
        });
    }

    /**
     * Insert request into queue by priority
     */
    insertByPriority(queueItem) {
        const priorityOrder = [
            REQUEST_PRIORITY.CRITICAL,
            REQUEST_PRIORITY.HIGH,
            REQUEST_PRIORITY.NORMAL,
            REQUEST_PRIORITY.LOW,
            REQUEST_PRIORITY.BACKGROUND
        ];

        const itemPriorityIndex = priorityOrder.indexOf(queueItem.priority);
        let insertIndex = this.requestQueue.length;

        // Find insertion point to maintain priority order
        for (let i = 0; i < this.requestQueue.length; i++) {
            const existingPriorityIndex = priorityOrder.indexOf(this.requestQueue[i].priority);
            if (itemPriorityIndex < existingPriorityIndex) {
                insertIndex = i;
                break;
            }
        }

        this.requestQueue.splice(insertIndex, 0, queueItem);
    }

    /**
     * Remove request from queue
     */
    removeFromQueue(requestId) {
        const index = this.requestQueue.findIndex(item => item.id === requestId);
        if (index !== -1) {
            return this.requestQueue.splice(index, 1)[0];
        }
        return null;
    }

    /**
     * Start queue processing
     */
    startQueueProcessing() {
        if (this.processTimer) {
            clearInterval(this.processTimer);
        }

        this.processTimer = setInterval(async () => {
            if (!this.processingQueue && this.requestQueue.length > 0) {
                await this.processQueue();
            }
        }, this.options.processingInterval);

        log('Queue processing started');
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.processingQueue) return;
        
        this.processingQueue = true;
        
        try {
            while (this.requestQueue.length > 0) {
                // Check concurrent request limit
                if (this.activeRequests.size >= this.options.globalLimits.concurrentRequests) {
                    break;
                }

                // Get next ready request
                const queueItem = this.getNextReadyRequest();
                if (!queueItem) {
                    break;
                }

                // Remove from queue
                this.removeFromQueue(queueItem.id);

                // Process request
                this.processRequest(queueItem);
            }
        } catch (error) {
            errorLog('Error processing queue:', error);
        } finally {
            this.processingQueue = false;
        }
    }

    /**
     * Get next ready request from queue
     */
    getNextReadyRequest() {
        for (let i = 0; i < this.requestQueue.length; i++) {
            const item = this.requestQueue[i];
            if (item.isReady()) {
                return item;
            }
        }
        return null;
    }

    /**
     * Process individual request
     */
    async processRequest(queueItem) {
        const startTime = Date.now();
        
        try {
            // Check rate limiting
            const limiter = this.getRateLimiter(queueItem.metadata.domain || 'default');
            
            if (!limiter.canProcess()) {
                // Reschedule request
                const delay = limiter.getTimeUntilToken ? limiter.getTimeUntilToken() : limiter.getTimeUntilNextRequest();
                queueItem.reschedule(delay);
                queueItem.incrementAttempt();
                
                if (queueItem.canRetry()) {
                    this.insertByPriority(queueItem);
                    log(`Request rescheduled due to rate limit: ${queueItem.id} (delay: ${delay}ms)`);
                    return;
                } else {
                    throw new Error(`Rate limit exceeded, max attempts reached: ${queueItem.id}`);
                }
            }

            // Consume rate limit token
            if (limiter.consume) {
                limiter.consume();
            } else {
                limiter.recordRequest();
            }

            // Apply adaptive throttling delay
            const throttleDelay = this.calculateThrottleDelay();
            if (throttleDelay > 0) {
                await this.sleep(throttleDelay);
            }

            // Add to active requests
            this.activeRequests.set(queueItem.id, {
                queueItem,
                startTime,
                domain: queueItem.metadata.domain
            });

            // Execute request
            let result;
            if (typeof queueItem.request === 'function') {
                result = await queueItem.request();
            } else {
                // Assume it's a request configuration object
                result = await this.executeHttpRequest(queueItem.request);
            }

            // Record success
            this.recordRequestCompletion(queueItem, startTime, true);
            
            // Resolve promise
            if (queueItem.resolve && !queueItem.processed) {
                queueItem.processed = true;
                queueItem.resolve(result);
            }

            log(`Request completed successfully: ${queueItem.id}`);

        } catch (error) {
            // Record failure
            this.recordRequestCompletion(queueItem, startTime, false, error);
            
            // Handle retry logic
            queueItem.incrementAttempt();
            
            if (queueItem.canRetry()) {
                // Calculate exponential backoff delay
                const retryDelay = Math.min(1000 * Math.pow(2, queueItem.attempts - 1), 30000);
                queueItem.reschedule(retryDelay);
                this.insertByPriority(queueItem);
                
                log(`Request retry scheduled: ${queueItem.id} (attempt ${queueItem.attempts}, delay: ${retryDelay}ms)`);
            } else {
                // Max attempts reached, reject
                if (queueItem.reject && !queueItem.processed) {
                    queueItem.processed = true;
                    queueItem.reject(error);
                }
                
                errorLog(`Request failed permanently: ${queueItem.id}`, error);
            }
        } finally {
            // Remove from active requests
            this.activeRequests.delete(queueItem.id);
        }
    }

    /**
     * Record request completion
     */
    recordRequestCompletion(queueItem, startTime, success, error = null) {
        const duration = Date.now() - startTime;
        
        this.requestStats.totalRequests++;
        
        if (success) {
            this.requestStats.successfulRequests++;
        } else {
            this.requestStats.failedRequests++;
        }

        // Update response time statistics
        this.requestStats.responseTimesBuffer.push(duration);
        if (this.requestStats.responseTimesBuffer.length > 100) {
            this.requestStats.responseTimesBuffer.shift();
        }
        
        this.requestStats.averageResponseTime = 
            this.requestStats.responseTimesBuffer.reduce((sum, time) => sum + time, 0) / 
            this.requestStats.responseTimesBuffer.length;

        // Send metrics to monitoring service
        if (this.monitoringService) {
            this.monitoringService.recordRequestMetrics({
                requestId: queueItem.id,
                duration,
                success,
                error: error?.message,
                domain: queueItem.metadata.domain,
                priority: queueItem.priority,
                attempts: queueItem.attempts
            });
        }
    }

    /**
     * Execute HTTP request (placeholder implementation)
     */
    async executeHttpRequest(requestConfig) {
        // This would integrate with actual HTTP client (e.g., axios, fetch)
        // For now, it's a placeholder that simulates a request
        
        const delay = Math.random() * 1000; // Simulate network delay
        await this.sleep(delay);
        
        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
            throw new Error('Simulated network error');
        }
        
        return {
            status: 200,
            data: { message: 'Success' },
            duration: delay
        };
    }

    /**
     * Calculate adaptive throttling delay
     */
    calculateThrottleDelay() {
        if (!this.options.adaptiveThrottling) {
            return 0;
        }

        const baseDelay = 1000 / this.options.globalLimits.requestsPerSecond;
        const throttledDelay = baseDelay / this.adaptiveState.currentLevel;
        
        return Math.max(0, throttledDelay - baseDelay);
    }

    /**
     * Start adaptive throttling monitor
     */
    startAdaptiveThrottling() {
        setInterval(() => {
            this.adjustThrottlingLevel();
        }, this.adaptiveState.adjustmentInterval);

        log('Adaptive throttling monitor started');
    }

    /**
     * Adjust throttling level based on performance metrics
     */
    adjustThrottlingLevel() {
        const now = Date.now();
        const timeSinceLastAdjustment = now - this.adaptiveState.lastAdjustment;
        
        if (timeSinceLastAdjustment < this.adaptiveState.adjustmentInterval) {
            return;
        }

        // Calculate error rate
        const totalRequests = this.requestStats.totalRequests;
        const errorRate = totalRequests > 0 ? 
            (this.requestStats.failedRequests / totalRequests) * 100 : 0;

        // Calculate average response time
        const avgResponseTime = this.requestStats.averageResponseTime;

        let adjustment = 0;
        let reason = '';

        // Increase throttling if error rate is high
        if (errorRate > 10) {
            adjustment = -0.1; // Slow down by 10%
            reason = `High error rate: ${errorRate.toFixed(1)}%`;
        }
        // Increase throttling if response time is high
        else if (avgResponseTime > this.adaptiveState.responseTimeThreshold) {
            adjustment = -0.1; // Slow down by 10%
            reason = `High response time: ${avgResponseTime.toFixed(0)}ms`;
        }
        // Decrease throttling if performance is good
        else if (errorRate < 2 && avgResponseTime < this.adaptiveState.responseTimeThreshold / 2) {
            adjustment = 0.1; // Speed up by 10%
            reason = 'Good performance metrics';
        }

        if (adjustment !== 0) {
            const oldLevel = this.adaptiveState.currentLevel;
            this.adaptiveState.currentLevel = Math.max(0.1, Math.min(2.0, oldLevel + adjustment));
            this.adaptiveState.lastAdjustment = now;

            log(`Adaptive throttling adjusted: ${oldLevel.toFixed(2)} → ${this.adaptiveState.currentLevel.toFixed(2)} (${reason})`);

            // Send alert if significant throttling
            if (this.adaptiveState.currentLevel < 0.5 && this.alertManager) {
                this.alertManager.sendAlert({
                    type: 'ADAPTIVE_THROTTLING',
                    severity: 'HIGH',
                    message: `Significant throttling applied: ${this.adaptiveState.currentLevel.toFixed(2)}x speed`,
                    reason,
                    errorRate,
                    avgResponseTime
                });
            }
        }
    }

    /**
     * Get rate limiting statistics
     */
    getRateLimitingStats() {
        const stats = {
            // Queue statistics
            queue: {
                size: this.requestQueue.length,
                maxSize: this.options.queueSize,
                utilizationPercent: (this.requestQueue.length / this.options.queueSize) * 100
            },
            
            // Active requests
            active: {
                count: this.activeRequests.size,
                maxConcurrent: this.options.globalLimits.concurrentRequests,
                utilizationPercent: (this.activeRequests.size / this.options.globalLimits.concurrentRequests) * 100
            },
            
            // Request statistics
            requests: { ...this.requestStats },
            
            // Adaptive throttling
            adaptiveThrottling: {
                enabled: this.options.adaptiveThrottling,
                currentLevel: this.adaptiveState.currentLevel,
                errorRate: this.requestStats.totalRequests > 0 ? 
                    (this.requestStats.failedRequests / this.requestStats.totalRequests) * 100 : 0
            },
            
            // Rate limiter status
            limiters: Array.from(this.limiters.entries()).map(([id, limiter]) => ({
                identifier: id,
                ...limiter.getStatus()
            }))
        };

        return stats;
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        const priorityGroups = {};
        
        Object.values(REQUEST_PRIORITY).forEach(priority => {
            priorityGroups[priority] = this.requestQueue.filter(item => item.priority === priority).length;
        });

        return {
            totalItems: this.requestQueue.length,
            maxCapacity: this.options.queueSize,
            utilizationPercent: (this.requestQueue.length / this.options.queueSize) * 100,
            isProcessing: this.processingQueue,
            priorityDistribution: priorityGroups,
            oldestItem: this.requestQueue.length > 0 ? {
                id: this.requestQueue[0].id,
                priority: this.requestQueue[0].priority,
                ageMs: Date.now() - this.requestQueue[0].createdAt
            } : null
        };
    }

    /**
     * Clear all rate limiters
     */
    clearRateLimiters() {
        this.limiters.clear();
        log('All rate limiters cleared');
    }

    /**
     * Clear request queue
     */
    clearQueue() {
        // Reject all pending requests
        this.requestQueue.forEach(item => {
            if (item.reject && !item.processed) {
                item.processed = true;
                item.reject(new Error('Queue cleared'));
            }
        });

        this.requestQueue = [];
        log('Request queue cleared');
    }

    /**
     * Pause queue processing
     */
    pauseProcessing() {
        if (this.processTimer) {
            clearInterval(this.processTimer);
            this.processTimer = null;
        }
        log('Queue processing paused');
    }

    /**
     * Resume queue processing
     */
    resumeProcessing() {
        this.startQueueProcessing();
        log('Queue processing resumed');
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Persist state to storage
     */
    async persistState() {
        if (!this.options.enablePersistence) return;

        try {
            const state = {
                limiters: Array.from(this.limiters.entries()).map(([id, limiter]) => ({
                    id,
                    status: limiter.getStatus()
                })),
                stats: this.requestStats,
                adaptiveState: this.adaptiveState,
                timestamp: new Date().toISOString()
            };

            const statePath = path.join(this.options.persistenceStorePath, 'rate-limit-state.json');
            await fs.writeFile(statePath, JSON.stringify(state, null, 2));

        } catch (error) {
            errorLog('Failed to persist rate limiting state:', error);
        }
    }

    /**
     * Load persisted state
     */
    async loadPersistedState() {
        try {
            const statePath = path.join(this.options.persistenceStorePath, 'rate-limit-state.json');
            const data = await fs.readFile(statePath, 'utf-8');
            const state = JSON.parse(data);

            // Restore statistics
            if (state.stats) {
                this.requestStats = { ...this.requestStats, ...state.stats };
            }

            // Restore adaptive state
            if (state.adaptiveState) {
                this.adaptiveState = { ...this.adaptiveState, ...state.adaptiveState };
            }

            log('Rate limiting state loaded from persistence');

        } catch (error) {
            // No existing state file, start fresh
            log('No persisted rate limiting state found, starting fresh');
        }
    }

    /**
     * Shutdown rate limiting manager
     */
    async shutdown() {
        try {
            log('Shutting down RateLimitingManager...');

            // Stop queue processing
            this.pauseProcessing();

            // Clear queue
            this.clearQueue();

            // Wait for active requests to complete (with timeout)
            const timeout = 30000; // 30 seconds
            const startTime = Date.now();
            
            while (this.activeRequests.size > 0 && (Date.now() - startTime) < timeout) {
                await this.sleep(100);
            }

            // Force terminate remaining requests
            if (this.activeRequests.size > 0) {
                log(`Force terminating ${this.activeRequests.size} remaining requests`);
                this.activeRequests.clear();
            }

            // Persist final state
            await this.persistState();

            log('RateLimitingManager shutdown completed');

        } catch (error) {
            errorLog('Error during RateLimitingManager shutdown:', error);
        }
    }
}

module.exports = {
    RateLimitingManager,
    TokenBucketLimiter,
    SlidingWindowLimiter,
    RequestQueueItem,
    RATE_LIMIT_ALGORITHMS,
    REQUEST_PRIORITY
};
