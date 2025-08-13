// scraper/errorHandling.js
const { log, errorLog } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Error Handling System
 * 
 * Features:
 * - Error classification and categorization
 * - Recovery strategies and retry logic
 * - Error reporting and aggregation
 * - Error persistence and analytics
 * - Integration with monitoring and alerting
 */

/**
 * Error Categories for classification
 */
const ERROR_CATEGORIES = {
    NETWORK: 'NETWORK',
    PARSING: 'PARSING',
    VALIDATION: 'VALIDATION',
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',
    RATE_LIMIT: 'RATE_LIMIT',
    SYSTEM: 'SYSTEM',
    BUSINESS_LOGIC: 'BUSINESS_LOGIC',
    CONFIGURATION: 'CONFIGURATION',
    STEALTH: 'STEALTH',
    DATA_QUALITY: 'DATA_QUALITY',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Error Severity Levels
 */
const ERROR_SEVERITY = {
    CRITICAL: 'CRITICAL',     // System-breaking errors
    HIGH: 'HIGH',             // Major functionality issues
    MEDIUM: 'MEDIUM',         // Moderate impact errors
    LOW: 'LOW',               // Minor issues
    INFO: 'INFO'              // Informational errors
};

/**
 * Recovery Strategies
 */
const RECOVERY_STRATEGIES = {
    RETRY_IMMEDIATE: 'RETRY_IMMEDIATE',
    RETRY_BACKOFF: 'RETRY_BACKOFF',
    CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
    FALLBACK: 'FALLBACK',
    SKIP: 'SKIP',
    ABORT: 'ABORT',
    MANUAL_INTERVENTION: 'MANUAL_INTERVENTION'
};

/**
 * Enhanced Error Classes
 */
class BaseScrapingError extends Error {
    constructor(message, category = ERROR_CATEGORIES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.category = category;
        this.severity = severity;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.id = this.generateErrorId();
        this.recoveryStrategy = this.determineRecoveryStrategy();
        
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    generateErrorId() {
        return `${this.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    determineRecoveryStrategy() {
        // Default recovery strategy based on category and severity
        switch (this.category) {
            case ERROR_CATEGORIES.NETWORK:
                return this.severity === ERROR_SEVERITY.CRITICAL ? 
                    RECOVERY_STRATEGIES.CIRCUIT_BREAKER : RECOVERY_STRATEGIES.RETRY_BACKOFF;
            case ERROR_CATEGORIES.RATE_LIMIT:
                return RECOVERY_STRATEGIES.RETRY_BACKOFF;
            case ERROR_CATEGORIES.AUTHENTICATION:
                return RECOVERY_STRATEGIES.MANUAL_INTERVENTION;
            case ERROR_CATEGORIES.PARSING:
                return RECOVERY_STRATEGIES.FALLBACK;
            case ERROR_CATEGORIES.VALIDATION:
                return RECOVERY_STRATEGIES.SKIP;
            case ERROR_CATEGORIES.STEALTH:
                return RECOVERY_STRATEGIES.RETRY_IMMEDIATE;
            default:
                return RECOVERY_STRATEGIES.RETRY_BACKOFF;
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            message: this.message,
            category: this.category,
            severity: this.severity,
            context: this.context,
            timestamp: this.timestamp,
            recoveryStrategy: this.recoveryStrategy,
            stack: this.stack
        };
    }
}

class NetworkError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.NETWORK, ERROR_SEVERITY.HIGH, context);
    }
}

class ParsingError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.PARSING, ERROR_SEVERITY.MEDIUM, context);
    }
}

class ValidationError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.VALIDATION, ERROR_SEVERITY.MEDIUM, context);
    }
}

class AuthenticationError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.AUTHENTICATION, ERROR_SEVERITY.CRITICAL, context);
    }
}

class RateLimitError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.RATE_LIMIT, ERROR_SEVERITY.HIGH, context);
    }
}

class StealthError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.STEALTH, ERROR_SEVERITY.HIGH, context);
    }
}

class DataQualityError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.DATA_QUALITY, ERROR_SEVERITY.MEDIUM, context);
    }
}

class SystemError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.SYSTEM, ERROR_SEVERITY.CRITICAL, context);
    }
}

class ConfigurationError extends BaseScrapingError {
    constructor(message, context = {}) {
        super(message, ERROR_CATEGORIES.CONFIGURATION, ERROR_SEVERITY.HIGH, context);
    }
}

/**
 * Error Handler Class - Centralized error management
 */
class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            enablePersistence: options.enablePersistence !== false,
            enableReporting: options.enableReporting !== false,
            errorLogPath: options.errorLogPath || path.join(process.cwd(), 'logs', 'errors.json'),
            maxErrorHistory: options.maxErrorHistory || 1000,
            alertThresholds: {
                criticalCount: 5,      // Alert after 5 critical errors in window
                highCount: 10,         // Alert after 10 high severity errors
                timeWindow: 300000,    // 5 minutes
                ...options.alertThresholds
            },
            ...options
        };

        this.errorHistory = [];
        this.errorStats = new Map();
        this.alertManager = options.alertManager || null;
        this.monitoringService = options.monitoringService || null;

        // Initialize error handling
        this.initializeErrorHandling();
    }

    /**
     * Initialize error handling system
     */
    async initializeErrorHandling() {
        try {
            // Load error history if persistence is enabled
            if (this.options.enablePersistence) {
                await this.loadErrorHistory();
            }

            // Set up global error handlers
            this.setupGlobalErrorHandlers();

            log('ErrorHandler initialized successfully');
        } catch (error) {
            errorLog('Failed to initialize ErrorHandler:', error);
        }
    }

    /**
     * Set up global error handlers
     */
    setupGlobalErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleError(new SystemError('Uncaught exception', { 
                originalError: error.message,
                stack: error.stack
            }));
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.handleError(new SystemError('Unhandled promise rejection', {
                reason: reason?.toString(),
                promise: promise?.toString()
            }));
        });
    }

    /**
     * Create a new error instance
     */
    createError(category, severity, message, context = {}) {
        return new BaseScrapingError(category, severity, message, context);
    }

    /**
     * Main error handling method
     */
    async handleError(error, context = {}) {
        try {
            // Ensure error is a BaseScrapingError
            const scrapingError = this.normalizeError(error, context);

            // Log the error
            this.logError(scrapingError);

            // Add to history and statistics
            this.recordError(scrapingError);

            // Persist error if enabled
            if (this.options.enablePersistence) {
                await this.persistError(scrapingError);
            }

            // Send to monitoring service
            if (this.monitoringService) {
                this.monitoringService.recordError(scrapingError);
            }

            // Check alert thresholds
            await this.checkAlertThresholds(scrapingError);

            // Determine and execute recovery strategy
            const recoveryResult = await this.executeRecoveryStrategy(scrapingError);

            return {
                error: scrapingError,
                recoveryResult,
                handled: true
            };

        } catch (handlingError) {
            errorLog('Error in error handling:', handlingError);
            return {
                error: error,
                recoveryResult: null,
                handled: false
            };
        }
    }

    /**
     * Normalize any error to BaseScrapingError
     */
    normalizeError(error, context = {}) {
        if (error instanceof BaseScrapingError) {
            // Add additional context if provided
            error.context = { ...error.context, ...context };
            return error;
        }

        // Classify error based on message and type
        const category = this.classifyError(error);
        const severity = this.determineSeverity(error, category);

        return new BaseScrapingError(
            error.message || 'Unknown error',
            category,
            severity,
            {
                originalError: error.name || 'Error',
                stack: error.stack,
                ...context
            }
        );
    }

    /**
     * Classify error based on message and type
     */
    classifyError(error) {
        const message = (error.message || '').toLowerCase();
        const name = (error.name || '').toLowerCase();

        // Network errors
        if (message.includes('network') || message.includes('connect') || 
            message.includes('timeout') || name.includes('network')) {
            return ERROR_CATEGORIES.NETWORK;
        }

        // Rate limiting
        if (message.includes('rate limit') || message.includes('too many requests') ||
            message.includes('429') || message.includes('throttl')) {
            return ERROR_CATEGORIES.RATE_LIMIT;
        }

        // Authentication/Authorization
        if (message.includes('auth') || message.includes('401') || 
            message.includes('403') || message.includes('unauthorized')) {
            return ERROR_CATEGORIES.AUTHENTICATION;
        }

        // Parsing errors
        if (message.includes('parse') || message.includes('json') || 
            message.includes('xml') || message.includes('selector')) {
            return ERROR_CATEGORIES.PARSING;
        }

        // Validation errors
        if (message.includes('validation') || message.includes('invalid') ||
            message.includes('schema') || name.includes('validation')) {
            return ERROR_CATEGORIES.VALIDATION;
        }

        // Stealth detection
        if (message.includes('detect') || message.includes('block') || 
            message.includes('captcha') || message.includes('robot')) {
            return ERROR_CATEGORIES.STEALTH;
        }

        // System errors
        if (message.includes('system') || message.includes('memory') || 
            message.includes('disk') || name.includes('system')) {
            return ERROR_CATEGORIES.SYSTEM;
        }

        return ERROR_CATEGORIES.UNKNOWN;
    }

    /**
     * Determine error severity
     */
    determineSeverity(error, category) {
        const message = (error.message || '').toLowerCase();

        // Critical severity indicators
        if (message.includes('critical') || message.includes('fatal') ||
            category === ERROR_CATEGORIES.SYSTEM ||
            category === ERROR_CATEGORIES.AUTHENTICATION) {
            return ERROR_SEVERITY.CRITICAL;
        }

        // High severity indicators
        if (message.includes('failed') || message.includes('error') ||
            category === ERROR_CATEGORIES.NETWORK ||
            category === ERROR_CATEGORIES.RATE_LIMIT ||
            category === ERROR_CATEGORIES.STEALTH) {
            return ERROR_SEVERITY.HIGH;
        }

        // Low severity indicators
        if (message.includes('warning') || message.includes('info')) {
            return ERROR_SEVERITY.LOW;
        }

        return ERROR_SEVERITY.MEDIUM;
    }

    /**
     * Log error with appropriate level
     */
    logError(error) {
        const logMessage = `[${error.category}:${error.severity}] ${error.message}`;
        const logContext = {
            errorId: error.id,
            category: error.category,
            severity: error.severity,
            context: error.context,
            recoveryStrategy: error.recoveryStrategy
        };

        switch (error.severity) {
            case ERROR_SEVERITY.CRITICAL:
                errorLog(`CRITICAL ERROR: ${logMessage}`, logContext);
                break;
            case ERROR_SEVERITY.HIGH:
                errorLog(`HIGH ERROR: ${logMessage}`, logContext);
                break;
            case ERROR_SEVERITY.MEDIUM:
                log(`MEDIUM ERROR: ${logMessage}`, logContext);
                break;
            case ERROR_SEVERITY.LOW:
                log(`LOW ERROR: ${logMessage}`, logContext);
                break;
            default:
                log(`ERROR: ${logMessage}`, logContext);
        }
    }

    /**
     * Record error in history and statistics
     */
    recordError(error) {
        // Add to history
        this.errorHistory.push(error);

        // Maintain history size limit
        if (this.errorHistory.length > this.options.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(-this.options.maxErrorHistory);
        }

        // Update statistics
        const key = `${error.category}:${error.severity}`;
        if (!this.errorStats.has(key)) {
            this.errorStats.set(key, {
                count: 0,
                firstOccurrence: error.timestamp,
                lastOccurrence: error.timestamp,
                category: error.category,
                severity: error.severity
            });
        }

        const stats = this.errorStats.get(key);
        stats.count++;
        stats.lastOccurrence = error.timestamp;
    }

    /**
     * Persist error to storage
     */
    async persistError(error) {
        try {
            const errorData = {
                ...error.toJSON(),
                persistedAt: new Date().toISOString()
            };

            // Ensure logs directory exists
            await fs.mkdir(path.dirname(this.options.errorLogPath), { recursive: true });

            // Append to error log file
            await fs.appendFile(
                this.options.errorLogPath,
                JSON.stringify(errorData) + '\n'
            );

        } catch (persistError) {
            errorLog('Failed to persist error:', persistError);
        }
    }

    /**
     * Load error history from storage
     */
    async loadErrorHistory() {
        try {
            const errorLogExists = await fs.access(this.options.errorLogPath)
                .then(() => true)
                .catch(() => false);

            if (errorLogExists) {
                const errorLogContent = await fs.readFile(this.options.errorLogPath, 'utf-8');
                const errorLines = errorLogContent.trim().split('\n').filter(line => line);

                // Load recent errors (last 100)
                const recentErrorLines = errorLines.slice(-100);
                
                for (const line of recentErrorLines) {
                    try {
                        const errorData = JSON.parse(line);
                        // Reconstruct error statistics
                        const key = `${errorData.category}:${errorData.severity}`;
                        if (!this.errorStats.has(key)) {
                            this.errorStats.set(key, {
                                count: 0,
                                firstOccurrence: errorData.timestamp,
                                lastOccurrence: errorData.timestamp,
                                category: errorData.category,
                                severity: errorData.severity
                            });
                        }
                        const stats = this.errorStats.get(key);
                        stats.count++;
                        stats.lastOccurrence = errorData.timestamp;
                    } catch (parseError) {
                        // Skip invalid error entries
                    }
                }

                log(`Loaded error history: ${recentErrorLines.length} recent errors`);
            }
        } catch (loadError) {
            errorLog('Failed to load error history:', loadError);
        }
    }

    /**
     * Check alert thresholds and trigger alerts
     */
    async checkAlertThresholds(error) {
        if (!this.alertManager) {
            return;
        }

        const now = Date.now();
        const windowStart = now - this.options.alertThresholds.timeWindow;

        // Count recent errors by severity
        const recentErrors = this.errorHistory.filter(e => 
            new Date(e.timestamp).getTime() > windowStart
        );

        const criticalCount = recentErrors.filter(e => 
            e.severity === ERROR_SEVERITY.CRITICAL
        ).length;

        const highCount = recentErrors.filter(e => 
            e.severity === ERROR_SEVERITY.HIGH
        ).length;

        // Check thresholds
        if (criticalCount >= this.options.alertThresholds.criticalCount) {
            await this.alertManager.sendAlert({
                type: 'CRITICAL_ERROR_THRESHOLD',
                message: `${criticalCount} critical errors in the last ${this.options.alertThresholds.timeWindow / 1000}s`,
                severity: 'HIGH',
                context: {
                    criticalCount,
                    timeWindow: this.options.alertThresholds.timeWindow,
                    recentErrors: recentErrors.filter(e => e.severity === ERROR_SEVERITY.CRITICAL)
                }
            });
        }

        if (highCount >= this.options.alertThresholds.highCount) {
            await this.alertManager.sendAlert({
                type: 'HIGH_ERROR_THRESHOLD',
                message: `${highCount} high severity errors in the last ${this.options.alertThresholds.timeWindow / 1000}s`,
                severity: 'MEDIUM',
                context: {
                    highCount,
                    timeWindow: this.options.alertThresholds.timeWindow,
                    recentErrors: recentErrors.filter(e => e.severity === ERROR_SEVERITY.HIGH)
                }
            });
        }
    }

    /**
     * Execute recovery strategy for error
     */
    async executeRecoveryStrategy(error) {
        const strategy = error.recoveryStrategy;
        
        try {
            switch (strategy) {
                case RECOVERY_STRATEGIES.RETRY_IMMEDIATE:
                    return await this.executeRetryImmediate(error);
                    
                case RECOVERY_STRATEGIES.RETRY_BACKOFF:
                    return await this.executeRetryBackoff(error);
                    
                case RECOVERY_STRATEGIES.CIRCUIT_BREAKER:
                    return await this.executeCircuitBreaker(error);
                    
                case RECOVERY_STRATEGIES.FALLBACK:
                    return await this.executeFallback(error);
                    
                case RECOVERY_STRATEGIES.SKIP:
                    return await this.executeSkip(error);
                    
                case RECOVERY_STRATEGIES.ABORT:
                    return await this.executeAbort(error);
                    
                case RECOVERY_STRATEGIES.MANUAL_INTERVENTION:
                    return await this.executeManualIntervention(error);
                    
                default:
                    log(`No recovery strategy for: ${strategy}`);
                    return { strategy, executed: false, reason: 'Unknown strategy' };
            }
        } catch (recoveryError) {
            errorLog(`Recovery strategy failed for ${strategy}:`, recoveryError);
            return { strategy, executed: false, error: recoveryError.message };
        }
    }

    async executeRetryImmediate(error) {
        log(`Executing immediate retry for error: ${error.id}`);
        return { strategy: RECOVERY_STRATEGIES.RETRY_IMMEDIATE, executed: true, delay: 0 };
    }

    async executeRetryBackoff(error) {
        const delay = this.calculateBackoffDelay(error);
        log(`Executing backoff retry for error: ${error.id}, delay: ${delay}ms`);
        return { strategy: RECOVERY_STRATEGIES.RETRY_BACKOFF, executed: true, delay };
    }

    async executeCircuitBreaker(error) {
        log(`Executing circuit breaker for error: ${error.id}`);
        // Integration point with existing circuit breaker
        return { strategy: RECOVERY_STRATEGIES.CIRCUIT_BREAKER, executed: true };
    }

    async executeFallback(error) {
        log(`Executing fallback for error: ${error.id}`);
        return { strategy: RECOVERY_STRATEGIES.FALLBACK, executed: true };
    }

    async executeSkip(error) {
        log(`Skipping operation for error: ${error.id}`);
        return { strategy: RECOVERY_STRATEGIES.SKIP, executed: true };
    }

    async executeAbort(error) {
        log(`Aborting operation for error: ${error.id}`);
        return { strategy: RECOVERY_STRATEGIES.ABORT, executed: true };
    }

    async executeManualIntervention(error) {
        log(`Manual intervention required for error: ${error.id}`);
        // Send alert for manual intervention
        if (this.alertManager) {
            await this.alertManager.sendAlert({
                type: 'MANUAL_INTERVENTION_REQUIRED',
                message: `Manual intervention required for ${error.category} error`,
                severity: 'HIGH',
                context: { error: error.toJSON() }
            });
        }
        return { strategy: RECOVERY_STRATEGIES.MANUAL_INTERVENTION, executed: true };
    }

    /**
     * Calculate backoff delay based on error history
     */
    calculateBackoffDelay(error) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 60000;  // 1 minute
        
        // Count recent errors of same category
        const now = Date.now();
        const recentSimilarErrors = this.errorHistory.filter(e => 
            e.category === error.category &&
            (now - new Date(e.timestamp).getTime()) < 300000 // Last 5 minutes
        ).length;

        // Exponential backoff with jitter
        const delay = Math.min(
            baseDelay * Math.pow(2, recentSimilarErrors),
            maxDelay
        );

        // Add jitter (±25%)
        const jitter = delay * 0.25 * (Math.random() - 0.5);
        return Math.max(0, delay + jitter);
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        const lastHour = now - (60 * 60 * 1000);

        const recent24h = this.errorHistory.filter(e => 
            new Date(e.timestamp).getTime() > last24h
        );

        const recentHour = this.errorHistory.filter(e => 
            new Date(e.timestamp).getTime() > lastHour
        );

        const statsByCategory = {};
        const statsBySeverity = {};

        this.errorStats.forEach((stats, key) => {
            const [category, severity] = key.split(':');
            
            if (!statsByCategory[category]) {
                statsByCategory[category] = 0;
            }
            statsByCategory[category] += stats.count;

            if (!statsBySeverity[severity]) {
                statsBySeverity[severity] = 0;
            }
            statsBySeverity[severity] += stats.count;
        });

        return {
            totalErrors: this.errorHistory.length,
            recent24h: recent24h.length,
            recentHour: recentHour.length,
            errorsByCategory: statsByCategory,
            errorsBySeverity: statsBySeverity,
            mostCommonCategory: Object.keys(statsByCategory).reduce((a, b) => 
                statsByCategory[a] > statsByCategory[b] ? a : b, Object.keys(statsByCategory)[0] || 'none'),
            categoryBreakdown: Object.fromEntries(this.errorStats),
            alertThresholds: this.options.alertThresholds
        };
    }

    /**
     * Alias for getErrorStats to match test expectations
     */
    async getErrorStatistics() {
        return this.getErrorStats();
    }

    /**
     * Get recent errors with filtering
     */
    getRecentErrors(options = {}) {
        const {
            limit = 50,
            category = null,
            severity = null,
            timeWindow = 86400000 // 24 hours
        } = options;

        const now = Date.now();
        const cutoff = now - timeWindow;

        let filtered = this.errorHistory.filter(e => 
            new Date(e.timestamp).getTime() > cutoff
        );

        if (category) {
            filtered = filtered.filter(e => e.category === category);
        }

        if (severity) {
            filtered = filtered.filter(e => e.severity === severity);
        }

        return filtered
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errorHistory = [];
        this.errorStats.clear();
        log('Error history cleared');
    }
}

module.exports = {
    ErrorHandler,
    BaseScrapingError,
    NetworkError,
    ParsingError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    StealthError,
    DataQualityError,
    SystemError,
    ConfigurationError,
    ERROR_CATEGORIES,
    ERROR_SEVERITY,
    RECOVERY_STRATEGIES
};
