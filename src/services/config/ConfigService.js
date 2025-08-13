// src/services/config/ConfigService.js
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const { scraperConfigSchema, environmentSchemas } = require('../../config/schemas/configSchema');

/**
 * Enhanced Configuration Management Service
 * Handles environment-specific configurations, validation, and dynamic loading
 */
class ConfigService {
    constructor() {
        this.config = null;
        this.environment = process.env.NODE_ENV || 'development';
        this.configCache = new Map();
        this.validators = new Map();
        this.watchers = new Map();
        this.listeners = new Map();
        
        // Initialize configuration
        this.initialize();
    }

    /**
     * Initialize the configuration service
     */
    initialize() {
        try {
            // Load environment-specific configuration
            this.config = this.loadEnvironmentConfig();
            
            // Validate configuration
            this.validateConfig();
            
            // Setup configuration watching if in development
            if (this.environment === 'development') {
                this.setupConfigWatching();
            }
            
            // Register built-in validators
            this.registerBuiltInValidators();
            
            console.log(`✅ Configuration initialized for environment: ${this.environment}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize configuration:', error.message);
            throw new Error(`Configuration initialization failed: ${error.message}`);
        }
    }

    /**
     * Load environment-specific configuration
     */
    loadEnvironmentConfig() {
        const baseConfigPath = path.join(__dirname, '../../config/environments');
        const envConfigFile = path.join(baseConfigPath, `${this.environment}.js`);
        
        // Load base configuration (development as default)
        const defaultConfigFile = path.join(baseConfigPath, 'development.js');
        let baseConfig = {};
        
        if (fs.existsSync(defaultConfigFile)) {
            delete require.cache[require.resolve(defaultConfigFile)];
            baseConfig = require(defaultConfigFile);
        }
        
        // Load environment-specific configuration
        let envConfig = {};
        if (fs.existsSync(envConfigFile) && envConfigFile !== defaultConfigFile) {
            delete require.cache[require.resolve(envConfigFile)];
            envConfig = require(envConfigFile);
        }
        
        // Merge configurations
        const config = this.deepMerge(baseConfig, envConfig);
        
        // Override with environment variables
        return this.overrideWithEnvVars(config);
    }

    /**
     * Deep merge two configuration objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Override configuration with environment variables
     */
    overrideWithEnvVars(config) {
        const envMappings = {
            'NODE_ENV': 'app.environment',
            'DEBUG': 'app.debug',
            'PORT': 'app.port',
            'TARGET_URL': 'scraper.targetUrl',
            'SCRAPE_INTERVAL_MS': 'scraper.intervalMs',
            'TARGET_MERCHANT': 'scraper.targetMerchant',
            'CHROME_EXECUTABLE': 'browser.executablePath',
            'DATABASE_PATH': 'database.filename',
            'OUTPUT_DIR': 'storage.outputDir',
            'LOG_LEVEL': 'logging.level',
            'MONITORING_ENABLED': 'monitoring.enabled',
            'ALERTING_ENABLED': 'alerting.enabled'
        };

        const result = { ...config };
        
        for (const [envVar, configPath] of Object.entries(envMappings)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this.setNestedValue(result, configPath, this.parseEnvValue(envValue));
            }
        }

        return result;
    }

    /**
     * Parse environment variable value to appropriate type
     */
    parseEnvValue(value) {
        // Boolean values
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Numeric values
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        
        // Array values (comma-separated)
        if (value.includes(',')) {
            return value.split(',').map(v => v.trim());
        }
        
        return value;
    }

    /**
     * Set nested object value using dot notation
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * Get nested object value using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Validate configuration against schema
     */
    validateConfig() {
        const schema = environmentSchemas[this.environment] || scraperConfigSchema;
        const { error, value } = schema.validate(this.config, {
            allowUnknown: false,
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const details = error.details.map(detail => detail.message).join('\n');
            throw new Error(`Configuration validation failed:\n${details}`);
        }

        // Use validated and normalized configuration
        this.config = value;
    }

    /**
     * Get configuration value by path
     */
    get(path, defaultValue = undefined) {
        if (!path) return this.config;
        
        const value = this.getNestedValue(this.config, path);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        this.setNestedValue(this.config, path, value);
        this.validateConfig();
        this.notifyListeners(path, value);
    }

    /**
     * Check if configuration has a specific path
     */
    has(path) {
        return this.getNestedValue(this.config, path) !== undefined;
    }

    /**
     * Get all configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Get configuration for a specific section
     */
    getSection(section) {
        return this.get(section, {});
    }

    /**
     * Register a configuration change listener
     */
    onChange(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.listeners.get(path);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
        };
    }

    /**
     * Notify listeners of configuration changes
     */
    notifyListeners(path, value) {
        const listeners = this.listeners.get(path);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error(`Error in configuration change listener for ${path}:`, error);
                }
            });
        }
    }

    /**
     * Setup configuration file watching for development
     */
    setupConfigWatching() {
        const configDir = path.join(__dirname, '../../config/environments');
        
        try {
            const watcher = fs.watch(configDir, { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith('.js')) {
                    console.log(`Configuration file changed: ${filename}`);
                    setTimeout(() => {
                        try {
                            this.reloadConfig();
                        } catch (error) {
                            console.error('Failed to reload configuration:', error.message);
                        }
                    }, 100); // Debounce file changes
                }
            });
            
            this.watchers.set('config', watcher);
            console.log('✅ Configuration file watching enabled');
            
        } catch (error) {
            console.warn('⚠️ Could not setup configuration watching:', error.message);
        }
    }

    /**
     * Reload configuration from files
     */
    reloadConfig() {
        const oldConfig = { ...this.config };
        
        try {
            this.config = this.loadEnvironmentConfig();
            this.validateConfig();
            
            console.log('✅ Configuration reloaded successfully');
            
            // Notify listeners of global config change
            this.notifyListeners('*', this.config);
            
        } catch (error) {
            console.error('❌ Failed to reload configuration, keeping old config:', error.message);
            this.config = oldConfig;
            throw error;
        }
    }

    /**
     * Register built-in validators
     */
    registerBuiltInValidators() {
        this.validators.set('url', (value) => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        });

        this.validators.set('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value);
        });

        this.validators.set('port', (value) => {
            const port = parseInt(value, 10);
            return !isNaN(port) && port > 0 && port <= 65535;
        });

        this.validators.set('path', (value) => {
            return typeof value === 'string' && value.length > 0;
        });
    }

    /**
     * Validate a specific configuration value
     */
    validate(path, value, validatorName) {
        const validator = this.validators.get(validatorName);
        if (!validator) {
            throw new Error(`Unknown validator: ${validatorName}`);
        }
        
        return validator(value);
    }

    /**
     * Get environment name
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return this.environment === 'development';
    }

    /**
     * Check if running in production mode
     */
    isProduction() {
        return this.environment === 'production';
    }

    /**
     * Check if running in staging mode
     */
    isStaging() {
        return this.environment === 'staging';
    }

    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(featureName) {
        return this.get(`features.${featureName}`, false);
    }

    /**
     * Get configuration summary for logging
     */
    getSummary() {
        return {
            environment: this.environment,
            app: {
                name: this.get('app.name'),
                version: this.get('app.version'),
                debug: this.get('app.debug')
            },
            features: this.get('features'),
            monitoring: {
                enabled: this.get('monitoring.enabled'),
                interval: this.get('monitoring.interval')
            },
            alerting: {
                enabled: this.get('alerting.enabled')
            }
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Close file watchers
        for (const [name, watcher] of this.watchers) {
            try {
                watcher.close();
                console.log(`✅ Closed ${name} watcher`);
            } catch (error) {
                console.error(`❌ Error closing ${name} watcher:`, error.message);
            }
        }
        
        // Clear listeners
        this.listeners.clear();
        this.validators.clear();
        this.configCache.clear();
        
        console.log('✅ ConfigService destroyed');
    }
}

// Create singleton instance
const configService = new ConfigService();

module.exports = {
    ConfigService,
    configService
};
