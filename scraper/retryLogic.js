// scraper/retryLogic.js
const { errorLog, log } = require('./logger');

/**
 * Retry configuration presets for different types of operations
 */
const RETRY_PRESETS = {
    // Network operations (page loads, navigation)
    NETWORK: {
        maxAttempts: 5,
        baseDelay: 1000,      // 1 second
        maxDelay: 30000,      // 30 seconds
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: [
            'TimeoutError',
            'ProtocolError', 
            'NetworkError',
            'ERR_NETWORK_CHANGED',
            'ERR_INTERNET_DISCONNECTED',
            'ERR_CONNECTION_RESET',
            'ERR_CONNECTION_REFUSED'
        ]
    },
    
    // Element waiting operations (element detection, data extraction)
    ELEMENT_WAIT: {
        maxAttempts: 3,
        baseDelay: 2000,      // 2 seconds
        maxDelay: 10000,      // 10 seconds
        backoffMultiplier: 1.5,
        jitter: true,
        retryableErrors: [
            'TimeoutError',
            'ElementNotFoundError',
            'WaitForSelectorTimeoutError'
        ]
    },
    
    // Data extraction operations
    DATA_EXTRACTION: {
        maxAttempts: 4,
        baseDelay: 1500,      // 1.5 seconds
        maxDelay: 15000,      // 15 seconds
        backoffMultiplier: 1.8,
        jitter: true,
        retryableErrors: [
            'ExtractionError',
            'NoDataFoundError',
            'InvalidDataError'
        ]
    },
    
    // Browser launch operations
    BROWSER_LAUNCH: {
        maxAttempts: 3,
        baseDelay: 3000,      // 3 seconds
        maxDelay: 20000,      // 20 seconds
        backoffMultiplier: 2.5,
        jitter: true,
        retryableErrors: [
            'BrowserLaunchError',
            'ProtocolError'
        ]
    }
};

/**
 * Custom error classes for different failure types
 */
class RetryableError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'RetryableError';
        this.originalError = originalError;
        this.retryable = true;
    }
}

class NonRetryableError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'NonRetryableError';
        this.originalError = originalError;
        this.retryable = false;
    }
}

class ExtractionError extends RetryableError {
    constructor(message, originalError = null) {
        super(message, originalError);
        this.name = 'ExtractionError';
    }
}

class NoDataFoundError extends RetryableError {
    constructor(message, originalError = null) {
        super(message, originalError);
        this.name = 'NoDataFoundError';
    }
}

class BrowserLaunchError extends RetryableError {
    constructor(message, originalError = null) {
        super(message, originalError);
        this.name = 'BrowserLaunchError';
    }
}

/**
 * Determine if an error is retryable based on the retry configuration
 * 
 * @param {Error} error - The error to check
 * @param {Object} retryConfig - Retry configuration object
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryableError(error, retryConfig) {
    // Check if error explicitly states it's retryable
    if (error.retryable !== undefined) {
        return error.retryable;
    }
    
    // Check if error name/type is in retryable list
    const errorName = error.name || error.constructor.name;
    const errorMessage = error.message || '';
    
    return retryConfig.retryableErrors.some(retryableError => {
        return errorName.includes(retryableError) || 
               errorMessage.includes(retryableError);
    });
}

/**
 * Calculate delay for the next retry attempt using exponential backoff with jitter
 * 
 * @param {number} attemptNumber - Current attempt number (1-based)
 * @param {Object} retryConfig - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
function calculateRetryDelay(attemptNumber, retryConfig) {
    const { baseDelay, maxDelay, backoffMultiplier, jitter } = retryConfig;
    
    // Calculate exponential backoff delay
    let delay = baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1);
    
    // Apply jitter to avoid thundering herd
    if (jitter) {
        const jitterAmount = delay * 0.1; // 10% jitter
        const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
        delay += randomJitter;
    }
    
    // Ensure delay doesn't exceed maximum
    return Math.min(delay, maxDelay);
}

/**
 * Sleep for a specified number of milliseconds
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 * 
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @param {string} options.operationType - Type of operation for logging
 * @param {Object} options.retryConfig - Retry configuration (defaults to NETWORK)
 * @param {Object} options.context - Additional context for logging
 * @returns {Promise} - Result of the successful operation
 */
async function retryOperation(operation, options = {}) {
    const {
        operationType = 'operation',
        retryConfig = RETRY_PRESETS.NETWORK,
        context = {}
    } = options;
    
    const { maxAttempts } = retryConfig;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            log(`Attempting ${operationType} (attempt ${attempt}/${maxAttempts})`);
            
            const result = await operation();
            
            if (attempt > 1) {
                log(`${operationType} succeeded on attempt ${attempt}/${maxAttempts}`);
            }
            
            return result;
            
        } catch (error) {
            lastError = error;
            
            // Check if this is the last attempt
            if (attempt === maxAttempts) {
                errorLog(`${operationType} failed after ${maxAttempts} attempts`, error);
                throw new Error(`Operation failed after ${maxAttempts} attempts: ${error.message}`);
            }
            
            // Check if error is retryable
            if (!isRetryableError(error, retryConfig)) {
                errorLog(`${operationType} failed with non-retryable error`, error);
                throw new NonRetryableError(`Non-retryable error in ${operationType}: ${error.message}`, error);
            }
            
            // Calculate delay for next attempt
            const delay = calculateRetryDelay(attempt, retryConfig);
            
            log(`${operationType} failed on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms. Error: ${error.message}`);
            errorLog(`Retry attempt ${attempt} failed for ${operationType}`, error);
            
            // Wait before next attempt
            await sleep(delay);
        }
    }
    
    // This should never be reached due to the throw in the loop
    throw lastError;
}

/**
 * Retry a page navigation operation
 * 
 * @param {Function} navigationOperation - Function that performs navigation
 * @param {Object} context - Context information for logging
 * @returns {Promise} - Result of successful navigation
 */
async function retryPageNavigation(navigationOperation, context = {}) {
    return retryOperation(navigationOperation, {
        operationType: 'page navigation',
        retryConfig: RETRY_PRESETS.NETWORK,
        context
    });
}

/**
 * Retry an element waiting operation
 * 
 * @param {Function} waitOperation - Function that waits for elements
 * @param {Object} context - Context information for logging
 * @returns {Promise} - Result of successful wait
 */
async function retryElementWait(waitOperation, context = {}) {
    return retryOperation(waitOperation, {
        operationType: 'element wait',
        retryConfig: RETRY_PRESETS.ELEMENT_WAIT,
        context
    });
}

/**
 * Retry a data extraction operation
 * 
 * @param {Function} extractionOperation - Function that extracts data
 * @param {Object} context - Context information for logging
 * @returns {Promise} - Result of successful extraction
 */
async function retryDataExtraction(extractionOperation, context = {}) {
    return retryOperation(extractionOperation, {
        operationType: 'data extraction',
        retryConfig: RETRY_PRESETS.DATA_EXTRACTION,
        context
    });
}

/**
 * Retry a browser launch operation
 * 
 * @param {Function} launchOperation - Function that launches browser
 * @param {Object} context - Context information for logging
 * @returns {Promise} - Result of successful launch
 */
async function retryBrowserLaunch(launchOperation, context = {}) {
    return retryOperation(launchOperation, {
        operationType: 'browser launch',
        retryConfig: RETRY_PRESETS.BROWSER_LAUNCH,
        context
    });
}

module.exports = {
    // Retry functions
    retryOperation,
    retryPageNavigation,
    retryElementWait,
    retryDataExtraction,
    retryBrowserLaunch,
    
    // Configuration
    RETRY_PRESETS,
    
    // Error classes
    RetryableError,
    NonRetryableError,
    ExtractionError,
    NoDataFoundError,
    BrowserLaunchError,
    
    // Utility functions
    isRetryableError,
    calculateRetryDelay,
    sleep
};
