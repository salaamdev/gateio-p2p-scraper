// scraper/schema.js
const { errorLog, log } = require('./logger');

/**
 * Data types supported by the validation system
 */
const DATA_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    FLOAT: 'float',
    BOOLEAN: 'boolean',
    EMAIL: 'email',
    URL: 'url',
    DATE: 'date',
    CURRENCY: 'currency',
    PERCENTAGE: 'percentage'
};

/**
 * Validation rule types
 */
const VALIDATION_RULES = {
    REQUIRED: 'required',
    MIN_LENGTH: 'minLength',
    MAX_LENGTH: 'maxLength',
    PATTERN: 'pattern',
    MIN_VALUE: 'minValue',
    MAX_VALUE: 'maxValue',
    ENUM: 'enum',
    CUSTOM: 'custom'
};

/**
 * Merchant data schema definition
 */
const MERCHANT_SCHEMA = {
    name: 'MerchantData',
    version: '1.0.0',
    description: 'Schema for Gate.io P2P merchant data',
    fields: {
        'Merchant Name': {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.MIN_LENGTH, value: 1 },
                { type: VALIDATION_RULES.MAX_LENGTH, value: 100 },
                { type: VALIDATION_RULES.PATTERN, value: /^[a-zA-Z0-9_\-.@\s]+$/ }
            ],
            sanitize: true,
            description: 'Name of the P2P merchant'
        },
        'Price': {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^\d+(\.\d{1,2})?\s*[A-Z]{3}$/ }
            ],
            sanitize: true,
            description: 'Price with currency (e.g., "131.00 KES")'
        },
        'PriceNumeric': {
            type: DATA_TYPES.FLOAT,
            required: true,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 },
                { type: VALIDATION_RULES.MAX_VALUE, value: 1000000 }
            ],
            description: 'Numeric price value'
        },
        'Available Amount': {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^\d+(\.\d{1,8})?\s*[A-Z]{3,4}$/ }
            ],
            sanitize: true,
            description: 'Available amount with currency (e.g., "1000.00 USDT")'
        },
        'AvailableAmountNumeric': {
            type: DATA_TYPES.FLOAT,
            required: true,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 },
                { type: VALIDATION_RULES.MAX_VALUE, value: 10000000 }
            ],
            description: 'Numeric available amount'
        },
        'Limit': {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^\d+(\.\d{1,2})?\s*-\s*\d+(\.\d{1,2})?\s*[A-Z]{3}$/ }
            ],
            sanitize: true,
            description: 'Trading limits (e.g., "1000.00 - 50000.00 KES")'
        },
        'LimitMin': {
            type: DATA_TYPES.FLOAT,
            required: true,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 }
            ],
            description: 'Minimum trading limit'
        },
        'LimitMax': {
            type: DATA_TYPES.FLOAT,
            required: true,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 }
            ],
            description: 'Maximum trading limit'
        },
        'Payment Methods': {
            type: DATA_TYPES.STRING,
            required: false,
            rules: [
                { type: VALIDATION_RULES.MAX_LENGTH, value: 500 }
            ],
            sanitize: true,
            description: 'Available payment methods'
        },
        'Completion Rate': {
            type: DATA_TYPES.PERCENTAGE,
            required: false,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 },
                { type: VALIDATION_RULES.MAX_VALUE, value: 100 }
            ],
            description: 'Merchant completion rate percentage'
        },
        'Orders': {
            type: DATA_TYPES.INTEGER,
            required: false,
            rules: [
                { type: VALIDATION_RULES.MIN_VALUE, value: 0 },
                { type: VALIDATION_RULES.MAX_VALUE, value: 1000000 }
            ],
            description: 'Number of completed orders'
        },
        'Avg Pay Time': {
            type: DATA_TYPES.STRING,
            required: false,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^\d+(\.\d+)?\s*(min|mins|minute|minutes|hour|hours|h|m)$/ }
            ],
            sanitize: true,
            description: 'Average payment time'
        },
        'Avg Release Time': {
            type: DATA_TYPES.STRING,
            required: false,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^\d+(\.\d+)?\s*(min|mins|minute|minutes|hour|hours|h|m)$/ }
            ],
            sanitize: true,
            description: 'Average release time'
        }
    },
    metadata: {
        createdAt: {
            type: DATA_TYPES.DATE,
            required: true,
            description: 'Timestamp when data was extracted'
        },
        source: {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.ENUM, value: ['gate.io', 'binance', 'other'] }
            ],
            description: 'Source of the data'
        },
        scrapeId: {
            type: DATA_TYPES.STRING,
            required: true,
            rules: [
                { type: VALIDATION_RULES.PATTERN, value: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/ }
            ],
            description: 'Unique identifier for this scrape session'
        },
        version: {
            type: DATA_TYPES.STRING,
            required: true,
            description: 'Schema version used for validation'
        }
    }
};

/**
 * Validation error class
 */
class ValidationError extends Error {
    constructor(field, rule, value, message) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.rule = rule;
        this.value = value;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Schema validation result
 */
class ValidationResult {
    constructor() {
        this.isValid = true;
        this.errors = [];
        this.warnings = [];
        this.sanitizedData = {};
        this.metadata = {
            validatedFields: 0,
            skippedFields: 0,
            errorsCount: 0,
            warningsCount: 0
        };
    }

    addError(field, rule, value, message) {
        this.isValid = false;
        const error = new ValidationError(field, rule, value, message);
        this.errors.push(error);
        this.metadata.errorsCount++;
        return error;
    }

    addWarning(field, message) {
        this.warnings.push({
            field,
            message,
            timestamp: new Date().toISOString()
        });
        this.metadata.warningsCount++;
    }

    setSanitizedValue(field, value) {
        this.sanitizedData[field] = value;
    }
}

/**
 * Data sanitization functions
 */
const sanitizers = {
    /**
     * Sanitize string values
     */
    string: (value) => {
        if (typeof value !== 'string') return String(value);
        return value.trim().replace(/\s+/g, ' ');
    },

    /**
     * Sanitize numeric values
     */
    number: (value) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    },

    /**
     * Sanitize integer values
     */
    integer: (value) => {
        const num = sanitizers.number(value);
        return num !== null ? Math.floor(num) : null;
    },

    /**
     * Sanitize percentage values
     */
    percentage: (value) => {
        if (typeof value === 'string') {
            const cleaned = value.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        }
        return sanitizers.number(value);
    },

    /**
     * Sanitize currency values
     */
    currency: (value) => {
        if (typeof value === 'string') {
            // Extract numeric value from currency string
            const match = value.match(/(\d+(?:\.\d{1,2})?)/);
            return match ? parseFloat(match[1]) : null;
        }
        return sanitizers.number(value);
    },

    /**
     * Sanitize date values
     */
    date: (value) => {
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    }
};

/**
 * Type validators
 */
const typeValidators = {
    string: (value) => typeof value === 'string',
    number: (value) => typeof value === 'number' && !isNaN(value),
    integer: (value) => Number.isInteger(value),
    float: (value) => typeof value === 'number' && !isNaN(value),
    boolean: (value) => typeof value === 'boolean',
    email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    url: (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },
    date: (value) => value instanceof Date && !isNaN(value.getTime()),
    currency: (value) => typeof value === 'number' && value >= 0,
    percentage: (value) => typeof value === 'number' && value >= 0 && value <= 100
};

/**
 * Rule validators
 */
const ruleValidators = {
    required: (value) => value !== null && value !== undefined && value !== '',
    
    minLength: (value, ruleValue) => {
        if (typeof value !== 'string') return false;
        return value.length >= ruleValue;
    },
    
    maxLength: (value, ruleValue) => {
        if (typeof value !== 'string') return false;
        return value.length <= ruleValue;
    },
    
    pattern: (value, ruleValue) => {
        if (typeof value !== 'string') return false;
        return ruleValue.test(value);
    },
    
    minValue: (value, ruleValue) => {
        if (typeof value !== 'number') return false;
        return value >= ruleValue;
    },
    
    maxValue: (value, ruleValue) => {
        if (typeof value !== 'number') return false;
        return value <= ruleValue;
    },
    
    enum: (value, ruleValue) => {
        return Array.isArray(ruleValue) && ruleValue.includes(value);
    },
    
    custom: (value, ruleValue) => {
        if (typeof ruleValue !== 'function') return false;
        return ruleValue(value);
    }
};

/**
 * Validate a single field against its schema definition
 * 
 * @param {string} fieldName - Name of the field
 * @param {any} value - Value to validate
 * @param {Object} fieldSchema - Schema definition for the field
 * @param {ValidationResult} result - Validation result object
 */
function validateField(fieldName, value, fieldSchema, result) {
    try {
        // Handle required fields
        if (fieldSchema.required && !ruleValidators.required(value)) {
            result.addError(fieldName, 'required', value, `Field '${fieldName}' is required but is missing or empty`);
            return;
        }

        // Skip validation for optional empty fields
        if (!fieldSchema.required && (value === null || value === undefined || value === '')) {
            result.metadata.skippedFields++;
            return;
        }

        // Sanitize value if requested
        let sanitizedValue = value;
        if (fieldSchema.sanitize && sanitizers[fieldSchema.type]) {
            sanitizedValue = sanitizers[fieldSchema.type](value);
            result.setSanitizedValue(fieldName, sanitizedValue);
        }

        // Validate type
        if (!typeValidators[fieldSchema.type]) {
            result.addError(fieldName, 'type', sanitizedValue, `Unknown data type '${fieldSchema.type}' for field '${fieldName}'`);
            return;
        }

        if (!typeValidators[fieldSchema.type](sanitizedValue)) {
            result.addError(fieldName, 'type', sanitizedValue, `Field '${fieldName}' must be of type '${fieldSchema.type}', got '${typeof sanitizedValue}'`);
            return;
        }

        // Validate rules
        if (fieldSchema.rules && Array.isArray(fieldSchema.rules)) {
            for (const rule of fieldSchema.rules) {
                if (!ruleValidators[rule.type]) {
                    result.addWarning(fieldName, `Unknown validation rule '${rule.type}' for field '${fieldName}'`);
                    continue;
                }

                if (!ruleValidators[rule.type](sanitizedValue, rule.value)) {
                    const ruleMessage = getRuleErrorMessage(fieldName, rule, sanitizedValue);
                    result.addError(fieldName, rule.type, sanitizedValue, ruleMessage);
                }
            }
        }

        result.metadata.validatedFields++;

    } catch (error) {
        result.addError(fieldName, 'validation', value, `Validation error for field '${fieldName}': ${error.message}`);
        errorLog(`Field validation error for ${fieldName}`, error);
    }
}

/**
 * Generate human-readable error messages for rule violations
 */
function getRuleErrorMessage(fieldName, rule, value) {
    switch (rule.type) {
        case 'minLength':
            return `Field '${fieldName}' must be at least ${rule.value} characters long, got ${value?.length || 0}`;
        case 'maxLength':
            return `Field '${fieldName}' must be at most ${rule.value} characters long, got ${value?.length || 0}`;
        case 'pattern':
            return `Field '${fieldName}' does not match required pattern`;
        case 'minValue':
            return `Field '${fieldName}' must be at least ${rule.value}, got ${value}`;
        case 'maxValue':
            return `Field '${fieldName}' must be at most ${rule.value}, got ${value}`;
        case 'enum':
            return `Field '${fieldName}' must be one of [${rule.value.join(', ')}], got '${value}'`;
        case 'custom':
            return `Field '${fieldName}' failed custom validation`;
        default:
            return `Field '${fieldName}' failed validation rule '${rule.type}'`;
    }
}

/**
 * Validate data against a schema
 * 
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema definition
 * @param {Object} options - Validation options
 * @returns {ValidationResult} - Validation result
 */
function validateData(data, schema = MERCHANT_SCHEMA, _options = {}) {
    const result = new ValidationResult();
    
    try {
        log(`Starting data validation against schema '${schema.name}' version ${schema.version}`);
        
        // Validate main fields
        for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
            const value = data[fieldName];
            validateField(fieldName, value, fieldSchema, result);
        }
        
        // Validate metadata fields if present
        if (schema.metadata && data.metadata) {
            for (const [fieldName, fieldSchema] of Object.entries(schema.metadata)) {
                const value = data.metadata[fieldName];
                validateField(`metadata.${fieldName}`, value, fieldSchema, result);
            }
        }
        
        // Add metadata if not present
        if (!data.metadata) {
            result.setSanitizedValue('metadata', {
                createdAt: new Date(),
                source: 'gate.io',
                scrapeId: generateScrapeId(),
                version: schema.version
            });
        }
        
        const status = result.isValid ? 'PASSED' : 'FAILED';
        log(`Data validation ${status}: ${result.metadata.validatedFields} fields validated, ${result.metadata.errorsCount} errors, ${result.metadata.warningsCount} warnings`);
        
        if (result.metadata.errorsCount > 0) {
            errorLog(`Validation failed with ${result.metadata.errorsCount} errors`, new Error(result.errors.map(e => e.message).join('; ')));
        }
        
    } catch (error) {
        result.addError('validation', 'system', data, `System error during validation: ${error.message}`);
        errorLog('System error during data validation', error);
    }
    
    return result;
}

/**
 * Generate a unique scrape ID
 */
function generateScrapeId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Validate an array of merchant records
 * 
 * @param {Array} merchants - Array of merchant data
 * @param {Object} options - Validation options
 * @returns {Object} - Aggregated validation results
 */
function validateMerchants(merchants, options = {}) {
    const results = {
        totalRecords: merchants.length,
        validRecords: [],
        invalidRecords: [],
        aggregateErrors: {},
        aggregateWarnings: {},
        summary: {
            validCount: 0,
            invalidCount: 0,
            totalErrors: 0,
            totalWarnings: 0
        }
    };
    
    log(`Validating ${merchants.length} merchant records`);
    
    for (let i = 0; i < merchants.length; i++) {
        const merchant = merchants[i];
        const validation = validateData(merchant, MERCHANT_SCHEMA, options);
        
        if (validation.isValid) {
            results.validRecords.push({
                index: i,
                data: { ...merchant, ...validation.sanitizedData }
            });
            results.summary.validCount++;
        } else {
            results.invalidRecords.push({
                index: i,
                data: merchant,
                validation
            });
            results.summary.invalidCount++;
        }
        
        // Aggregate errors and warnings
        validation.errors.forEach(error => {
            if (!results.aggregateErrors[error.field]) {
                results.aggregateErrors[error.field] = [];
            }
            results.aggregateErrors[error.field].push(error);
            results.summary.totalErrors++;
        });
        
        validation.warnings.forEach(warning => {
            if (!results.aggregateWarnings[warning.field]) {
                results.aggregateWarnings[warning.field] = [];
            }
            results.aggregateWarnings[warning.field].push(warning);
            results.summary.totalWarnings++;
        });
    }
    
    log(`Validation complete: ${results.summary.validCount}/${results.totalRecords} valid records, ${results.summary.totalErrors} errors, ${results.summary.totalWarnings} warnings`);
    
    return results;
}

module.exports = {
    // Schema definitions
    MERCHANT_SCHEMA,
    DATA_TYPES,
    VALIDATION_RULES,
    
    // Validation functions
    validateData,
    validateMerchants,
    validateField,
    
    // Error classes
    ValidationError,
    ValidationResult,
    
    // Utility functions
    generateScrapeId,
    sanitizers,
    typeValidators,
    ruleValidators
};
