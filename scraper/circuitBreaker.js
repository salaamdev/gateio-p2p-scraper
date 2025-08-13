// scraper/circuitBreaker.js
const { errorLog, log } = require('./logger');

/**
 * Circuit Breaker States
 */
const CIRCUIT_STATES = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',           // Circuit is open, rejecting requests
    HALF_OPEN: 'HALF_OPEN'  // Testing if service has recovered
};

/**
 * Circuit Breaker configuration presets for different operations
 */
const CIRCUIT_BREAKER_PRESETS = {
    // For page loading and navigation operations
    PAGE_OPERATIONS: {
        failureThreshold: 5,        // Open after 5 failures
        recoveryTimeout: 30000,     // 30 seconds before trying again
        successThreshold: 2,        // Close after 2 successes in half-open
        monitorWindow: 60000,       // 1 minute window for failure tracking
        name: 'PageOperations'
    },
    
    // For data extraction operations
    DATA_EXTRACTION: {
        failureThreshold: 3,        // Open after 3 failures
        recoveryTimeout: 20000,     // 20 seconds before trying again
        successThreshold: 1,        // Close after 1 success in half-open
        monitorWindow: 45000,       // 45 seconds window
        name: 'DataExtraction'
    },
    
    // For browser launch operations
    BROWSER_LAUNCH: {
        failureThreshold: 2,        // Open after 2 failures
        recoveryTimeout: 45000,     // 45 seconds before trying again
        successThreshold: 1,        // Close after 1 success in half-open
        monitorWindow: 120000,      // 2 minutes window
        name: 'BrowserLaunch'
    },
    
    // For network-related operations
    NETWORK_OPERATIONS: {
        failureThreshold: 4,        // Open after 4 failures
        recoveryTimeout: 25000,     // 25 seconds before trying again
        successThreshold: 2,        // Close after 2 successes in half-open
        monitorWindow: 90000,       // 1.5 minutes window
        name: 'NetworkOperations'
    }
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
    constructor(config = {}) {
        // Merge with default configuration
        this.config = {
            failureThreshold: 5,
            recoveryTimeout: 30000,
            successThreshold: 2,
            monitorWindow: 60000,
            name: 'DefaultCircuit',
            ...config
        };
        
        // Circuit state
        this.state = CIRCUIT_STATES.CLOSED;
        this.failures = [];
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        
        log(`Circuit breaker '${this.config.name}' initialized with config: ${JSON.stringify(this.config)}`);
    }
    
    /**
     * Get current circuit breaker state
     */
    getState() {
        return this.state;
    }
    
    /**
     * Get circuit breaker statistics
     */
    getStats() {
        const now = Date.now();
        const recentFailures = this.failures.filter(
            failureTime => now - failureTime <= this.config.monitorWindow
        );
        
        return {
            state: this.state,
            recentFailures: recentFailures.length,
            totalFailures: this.failures.length,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
            isAvailable: this.isAvailable()
        };
    }
    
    /**
     * Check if circuit breaker allows requests
     */
    isAvailable() {
        const now = Date.now();
        
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED:
                return true;
                
            case CIRCUIT_STATES.OPEN:
                // Check if enough time has passed to try again
                if (this.nextAttemptTime && now >= this.nextAttemptTime) {
                    this.state = CIRCUIT_STATES.HALF_OPEN;
                    this.successes = 0;
                    log(`Circuit breaker '${this.config.name}' transitioning to HALF_OPEN state`);
                    return true;
                }
                return false;
                
            case CIRCUIT_STATES.HALF_OPEN:
                return true;
                
            default:
                return false;
        }
    }
    
    /**
     * Clean up old failure records outside the monitor window
     */
    cleanupOldFailures() {
        const now = Date.now();
        const cutoffTime = now - this.config.monitorWindow;
        this.failures = this.failures.filter(failureTime => failureTime > cutoffTime);
    }
    
    /**
     * Record a successful operation
     */
    onSuccess() {
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED:
                // Clean up old failures
                this.cleanupOldFailures();
                break;
                
            case CIRCUIT_STATES.HALF_OPEN: {
                this.successes++;
                log(`Circuit breaker '${this.config.name}' success in HALF_OPEN (${this.successes}/${this.config.successThreshold})`);
                
                if (this.successes >= this.config.successThreshold) {
                    this.state = CIRCUIT_STATES.CLOSED;
                    this.successes = 0;
                    this.failures = [];
                    this.lastFailureTime = null;
                    this.nextAttemptTime = null;
                    log(`Circuit breaker '${this.config.name}' transitioned to CLOSED state - service recovered`);
                }
                break;
            }
        }
    }
    
    /**
     * Record a failed operation
     */
    onFailure() {
        const now = Date.now();
        this.failures.push(now);
        this.lastFailureTime = now;
        
        // Clean up old failures
        this.cleanupOldFailures();
        
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED: {
                const recentFailures = this.failures.filter(
                    failureTime => now - failureTime <= this.config.monitorWindow
                );
                
                if (recentFailures.length >= this.config.failureThreshold) {
                    this.state = CIRCUIT_STATES.OPEN;
                    this.nextAttemptTime = now + this.config.recoveryTimeout;
                    this.successes = 0;
                    
                    log(`Circuit breaker '${this.config.name}' OPENED - too many failures (${recentFailures.length}/${this.config.failureThreshold})`);
                    log(`Circuit breaker '${this.config.name}' will retry at: ${new Date(this.nextAttemptTime).toISOString()}`);
                }
                break;
            }
                
            case CIRCUIT_STATES.HALF_OPEN:
                this.state = CIRCUIT_STATES.OPEN;
                this.nextAttemptTime = now + this.config.recoveryTimeout;
                this.successes = 0;
                log(`Circuit breaker '${this.config.name}' failed in HALF_OPEN, returning to OPEN state`);
                break;
        }
    }
    
    /**
     * Execute an operation through the circuit breaker
     * 
     * @param {Function} operation - Async function to execute
     * @param {string} operationName - Name of the operation for logging
     * @returns {Promise} - Result of the operation
     */
    async execute(operation, operationName = 'operation') {
        if (!this.isAvailable()) {
            const stats = this.getStats();
            const waitTime = this.nextAttemptTime ? Math.max(0, this.nextAttemptTime - Date.now()) : 0;
            
            throw new CircuitBreakerOpenError(
                `Circuit breaker '${this.config.name}' is OPEN for ${operationName}. ` +
                `Wait ${Math.ceil(waitTime / 1000)} seconds before retry. ` +
                `Recent failures: ${stats.recentFailures}/${this.config.failureThreshold}`
            );
        }
        
        try {
            log(`Executing ${operationName} through circuit breaker '${this.config.name}' (state: ${this.state})`);
            const result = await operation();
            this.onSuccess();
            return result;
            
        } catch (error) {
            this.onFailure();
            errorLog(`Circuit breaker '${this.config.name}' recorded failure for ${operationName}`, error);
            throw error;
        }
    }
    
    /**
     * Reset the circuit breaker to initial state
     */
    reset() {
        this.state = CIRCUIT_STATES.CLOSED;
        this.failures = [];
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        log(`Circuit breaker '${this.config.name}' has been reset to initial state`);
    }
    
    /**
     * Force open the circuit breaker
     */
    forceOpen() {
        this.state = CIRCUIT_STATES.OPEN;
        this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
        log(`Circuit breaker '${this.config.name}' has been forced OPEN`);
    }
    
    /**
     * Force close the circuit breaker
     */
    forceClose() {
        this.state = CIRCUIT_STATES.CLOSED;
        this.failures = [];
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        log(`Circuit breaker '${this.config.name}' has been forced CLOSED`);
    }
}

/**
 * Error thrown when circuit breaker is open
 */
class CircuitBreakerOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
        this.retryable = false; // Don't retry when circuit is open
    }
}

/**
 * Circuit Breaker Manager - manages multiple circuit breakers
 */
class CircuitBreakerManager {
    constructor() {
        this.breakers = new Map();
        log('Circuit Breaker Manager initialized');
    }
    
    /**
     * Get or create a circuit breaker
     */
    getBreaker(name, config = null) {
        if (!this.breakers.has(name)) {
            const breakerConfig = config || CIRCUIT_BREAKER_PRESETS[name] || {};
            breakerConfig.name = name;
            this.breakers.set(name, new CircuitBreaker(breakerConfig));
        }
        return this.breakers.get(name);
    }
    
    /**
     * Get all circuit breaker statistics
     */
    getAllStats() {
        const stats = {};
        for (const [name, breaker] of this.breakers) {
            stats[name] = breaker.getStats();
        }
        return stats;
    }
    
    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
        log('All circuit breakers have been reset');
    }
}

// Global circuit breaker manager instance
const globalCircuitBreakerManager = new CircuitBreakerManager();

module.exports = {
    CircuitBreaker,
    CircuitBreakerManager,
    CircuitBreakerOpenError,
    CIRCUIT_STATES,
    CIRCUIT_BREAKER_PRESETS,
    
    // Global manager for convenience
    getCircuitBreaker: (name, config) => globalCircuitBreakerManager.getBreaker(name, config),
    getAllCircuitBreakerStats: () => globalCircuitBreakerManager.getAllStats(),
    resetAllCircuitBreakers: () => globalCircuitBreakerManager.resetAll()
};
