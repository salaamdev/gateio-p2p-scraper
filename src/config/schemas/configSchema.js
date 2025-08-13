// src/config/schemas/configSchema.js
const Joi = require('joi');

/**
 * Configuration schema for the Gate.io P2P scraper
 * Defines validation rules for all configuration options
 */

const scraperConfigSchema = Joi.object({
    // Application settings
    app: Joi.object({
        name: Joi.string().default('gateio-p2p-scraper'),
        version: Joi.string().default('1.1.0'),
        environment: Joi.string().valid('development', 'staging', 'production').default('development'),
        debug: Joi.boolean().default(false),
        port: Joi.number().port().default(3000)
    }).default(),

    // Scraping configuration
    scraper: Joi.object({
        targetUrl: Joi.string().uri().required()
            .description('URL to scrape from Gate.io P2P'),
        intervalMs: Joi.number().min(5000).max(3600000).default(60000)
            .description('Scraping interval in milliseconds'),
        targetMerchant: Joi.string().allow('').default('')
            .description('Target merchant name for filtering'),
        maxRetries: Joi.number().min(0).max(10).default(3)
            .description('Maximum retry attempts'),
        timeout: Joi.number().min(1000).max(300000).default(30000)
            .description('Request timeout in milliseconds'),
        userAgent: Joi.string().default('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'),
        headless: Joi.boolean().default(true)
            .description('Run browser in headless mode')
    }).default(),

    // Browser configuration
    browser: Joi.object({
        executablePath: Joi.string().allow('').default('')
            .description('Path to Chrome/Chromium executable'),
        args: Joi.array().items(Joi.string()).default([
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]),
        viewportWidth: Joi.number().min(800).max(1920).default(1280),
        viewportHeight: Joi.number().min(600).max(1080).default(720),
        slowMo: Joi.number().min(0).max(1000).default(0)
            .description('Slow down operations by specified milliseconds')
    }).default(),

    // Database configuration
    database: Joi.object({
        type: Joi.string().valid('sqlite', 'mysql', 'postgresql').default('sqlite'),
        filename: Joi.string().default('./data/merchants.db')
            .description('SQLite database filename'),
        host: Joi.string().hostname().when('type', {
            is: Joi.valid('mysql', 'postgresql'),
            then: Joi.required(),
            otherwise: Joi.optional()
        }),
        port: Joi.number().port().when('type', {
            is: 'mysql',
            then: Joi.number().default(3306),
            otherwise: Joi.when('type', {
                is: 'postgresql',
                then: Joi.number().default(5432),
                otherwise: Joi.optional()
            })
        }),
        username: Joi.string().when('type', {
            is: Joi.valid('mysql', 'postgresql'),
            then: Joi.required(),
            otherwise: Joi.optional()
        }),
        password: Joi.string().allow('').when('type', {
            is: Joi.valid('mysql', 'postgresql'),
            then: Joi.required(),
            otherwise: Joi.optional()
        }),
        database: Joi.string().when('type', {
            is: Joi.valid('mysql', 'postgresql'),
            then: Joi.required(),
            otherwise: Joi.optional()
        }),
        options: Joi.object({
            maxConnections: Joi.number().min(1).max(100).default(10),
            acquireTimeout: Joi.number().default(60000),
            timeout: Joi.number().default(5000),
            foreignKeys: Joi.boolean().default(true),
            journalMode: Joi.string().valid('DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF').default('WAL'),
            synchronous: Joi.string().valid('OFF', 'NORMAL', 'FULL', 'EXTRA').default('NORMAL'),
            cacheSize: Joi.number().default(-2000),
            tempStore: Joi.string().valid('DEFAULT', 'FILE', 'MEMORY').default('MEMORY')
        }).default()
    }).default(),

    // Storage configuration
    storage: Joi.object({
        outputDir: Joi.string().default('./data'),
        formats: Joi.array().items(Joi.string().valid('json', 'csv', 'xml')).default(['json', 'csv']),
        compression: Joi.boolean().default(false),
        retention: Joi.object({
            enabled: Joi.boolean().default(true),
            maxAge: Joi.number().min(1).default(30)
                .description('Maximum age in days'),
            maxFiles: Joi.number().min(1).default(100)
                .description('Maximum number of files to keep')
        }).default(),
        backup: Joi.object({
            enabled: Joi.boolean().default(false),
            schedule: Joi.string().default('0 2 * * *')
                .description('Cron schedule for backups'),
            location: Joi.string().default('./backups'),
            compression: Joi.boolean().default(true)
        }).default()
    }).default(),

    // Logging configuration
    logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('info'),
        format: Joi.string().valid('json', 'text', 'pretty').default('text'),
        file: Joi.object({
            enabled: Joi.boolean().default(true),
            filename: Joi.string().default('./logs/app.log'),
            maxSize: Joi.string().default('10MB'),
            maxFiles: Joi.number().default(5),
            level: Joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('info')
        }).default(),
        console: Joi.object({
            enabled: Joi.boolean().default(true),
            level: Joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('info'),
            colorize: Joi.boolean().default(true)
        }).default(),
        rotation: Joi.object({
            enabled: Joi.boolean().default(true),
            schedule: Joi.string().default('0 0 * * *')
                .description('Daily rotation at midnight')
        }).default()
    }).default(),

    // Monitoring configuration
    monitoring: Joi.object({
        enabled: Joi.boolean().default(true),
        interval: Joi.number().min(1000).max(300000).default(30000)
            .description('Monitoring interval in milliseconds'),
        metrics: Joi.object({
            system: Joi.boolean().default(true)
                .description('Collect system metrics (CPU, memory, disk)'),
            performance: Joi.boolean().default(true)
                .description('Collect performance metrics'),
            business: Joi.boolean().default(true)
                .description('Collect business metrics (scrape success rate, data quality)'),
            retention: Joi.number().min(1).max(365).default(30)
                .description('Metrics retention in days')
        }).default(),
        healthCheck: Joi.object({
            enabled: Joi.boolean().default(true),
            interval: Joi.number().min(5000).max(300000).default(60000),
            endpoint: Joi.string().default('/health'),
            timeout: Joi.number().default(5000)
        }).default(),
        dashboard: Joi.object({
            enabled: Joi.boolean().default(false),
            port: Joi.number().port().default(3001),
            refreshInterval: Joi.number().default(30000)
        }).default()
    }).default(),

    // Alerting configuration
    alerting: Joi.object({
        enabled: Joi.boolean().default(false),
        channels: Joi.object({
            email: Joi.object({
                enabled: Joi.boolean().default(false),
                smtp: Joi.object({
                    host: Joi.string().hostname().when('...enabled', {
                        is: true,
                        then: Joi.required(),
                        otherwise: Joi.optional()
                    }),
                    port: Joi.number().port().default(587),
                    secure: Joi.boolean().default(false),
                    auth: Joi.object({
                        user: Joi.string().email().when('....enabled', {
                            is: true,
                            then: Joi.required(),
                            otherwise: Joi.optional()
                        }),
                        pass: Joi.string().when('....enabled', {
                            is: true,
                            then: Joi.required(),
                            otherwise: Joi.optional()
                        })
                    }).when('....enabled', {
                        is: true,
                        then: Joi.required(),
                        otherwise: Joi.optional()
                    })
                }).when('..enabled', {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),
                recipients: Joi.array().items(Joi.string().email()).default([]),
                from: Joi.string().email().when('..enabled', {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                })
            }).default(),
            webhook: Joi.object({
                enabled: Joi.boolean().default(false),
                url: Joi.string().uri().when('..enabled', {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),
                method: Joi.string().valid('POST', 'PUT').default('POST'),
                headers: Joi.object().default({}),
                timeout: Joi.number().default(5000)
            }).default(),
            slack: Joi.object({
                enabled: Joi.boolean().default(false),
                webhookUrl: Joi.string().uri().when('..enabled', {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),
                channel: Joi.string().default('#alerts'),
                username: Joi.string().default('GateIO-Scraper-Bot')
            }).default()
        }).default(),
        rules: Joi.object({
            errorRate: Joi.object({
                enabled: Joi.boolean().default(true),
                threshold: Joi.number().min(0).max(100).default(10)
                    .description('Error rate percentage threshold'),
                window: Joi.number().default(300)
                    .description('Time window in seconds')
            }).default(),
            responseTime: Joi.object({
                enabled: Joi.boolean().default(true),
                threshold: Joi.number().default(30000)
                    .description('Response time threshold in milliseconds')
            }).default(),
            memoryUsage: Joi.object({
                enabled: Joi.boolean().default(true),
                threshold: Joi.number().min(50).max(95).default(80)
                    .description('Memory usage percentage threshold')
            }).default(),
            diskSpace: Joi.object({
                enabled: Joi.boolean().default(true),
                threshold: Joi.number().min(50).max(95).default(85)
                    .description('Disk space usage percentage threshold')
            }).default(),
            noData: Joi.object({
                enabled: Joi.boolean().default(true),
                threshold: Joi.number().default(300)
                    .description('No data received threshold in seconds')
            }).default()
        }).default(),
        cooldown: Joi.number().min(60).max(3600).default(300)
            .description('Cooldown period in seconds between repeated alerts')
    }).default(),

    // Security configuration
    security: Joi.object({
        rateLimiting: Joi.object({
            enabled: Joi.boolean().default(true),
            maxRequests: Joi.number().default(100),
            windowMs: Joi.number().default(900000)
                .description('15 minutes window')
        }).default(),
        encryption: Joi.object({
            enabled: Joi.boolean().default(false),
            algorithm: Joi.string().default('aes-256-gcm'),
            keyRotation: Joi.number().default(86400)
                .description('Key rotation interval in seconds')
        }).default(),
        secrets: Joi.object({
            encryptionKey: Joi.string().when('..encryption.enabled', {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            jwtSecret: Joi.string().default('your-jwt-secret-here')
        }).default()
    }).default(),

    // Feature flags
    features: Joi.object({
        validation: Joi.boolean().default(true),
        database: Joi.boolean().default(true),
        monitoring: Joi.boolean().default(true),
        alerting: Joi.boolean().default(false),
        dashboard: Joi.boolean().default(false),
        api: Joi.boolean().default(false),
        clustering: Joi.boolean().default(false),
        caching: Joi.boolean().default(false)
    }).default()
});

/**
 * Environment-specific schema overrides
 */
const environmentSchemas = {
    development: scraperConfigSchema.fork('app.debug', (schema) => schema.default(true))
        .fork('logging.level', (schema) => schema.default('debug'))
        .fork('monitoring.dashboard.enabled', (schema) => schema.default(true)),
    
    staging: scraperConfigSchema.fork('app.debug', (schema) => schema.default(false))
        .fork('logging.level', (schema) => schema.default('info'))
        .fork('alerting.enabled', (schema) => schema.default(true)),
    
    production: scraperConfigSchema.fork('app.debug', (schema) => schema.default(false))
        .fork('logging.level', (schema) => schema.default('warn'))
        .fork('scraper.headless', (schema) => schema.default(true))
        .fork('monitoring.enabled', (schema) => schema.default(true))
        .fork('alerting.enabled', (schema) => schema.default(true))
        .fork('security.rateLimiting.enabled', (schema) => schema.default(true))
};

module.exports = {
    scraperConfigSchema,
    environmentSchemas
};
