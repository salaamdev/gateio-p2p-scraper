// src/config/environments/production.js
module.exports = {
    app: {
        environment: 'production',
        debug: false,
        port: process.env.PORT || 3000
    },
    
    scraper: {
        targetUrl: process.env.TARGET_URL || 'https://www.gate.io/p2p/buy/USDT-KES',
        intervalMs: parseInt(process.env.SCRAPE_INTERVAL_MS) || 60000,
        targetMerchant: process.env.TARGET_MERCHANT || '',
        headless: true,
        maxRetries: 3,
        timeout: 45000
    },
    
    browser: {
        executablePath: process.env.CHROME_EXECUTABLE || '',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--memory-pressure-off',
            '--max_old_space_size=4096'
        ],
        slowMo: 0
    },
    
    database: {
        filename: process.env.DATABASE_PATH || './data/merchants.db',
        options: {
            maxConnections: 10,
            acquireTimeout: 60000,
            timeout: 10000,
            foreignKeys: true,
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            cacheSize: -4000
        }
    },
    
    storage: {
        outputDir: process.env.OUTPUT_DIR || './data',
        formats: ['json', 'csv'],
        compression: true,
        retention: {
            enabled: true,
            maxAge: 30,
            maxFiles: 100
        },
        backup: {
            enabled: true,
            schedule: '0 2 * * *', // Daily at 2 AM
            location: './backups',
            compression: true
        }
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        console: {
            enabled: false, // Disable console logging in production
            level: 'error'
        },
        file: {
            enabled: true,
            filename: './logs/production.log',
            level: 'info',
            maxSize: '50MB',
            maxFiles: 10
        },
        rotation: {
            enabled: true,
            schedule: '0 0 * * *'
        }
    },
    
    monitoring: {
        enabled: true,
        interval: 60000, // 1 minute
        metrics: {
            system: true,
            performance: true,
            business: true,
            retention: 90
        },
        healthCheck: {
            enabled: true,
            interval: 120000, // 2 minutes
            timeout: 10000
        },
        dashboard: {
            enabled: false // Disable dashboard in production by default
        }
    },
    
    alerting: {
        enabled: true,
        channels: {
            email: {
                enabled: Boolean(process.env.SMTP_HOST),
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                recipients: process.env.ALERT_RECIPIENTS ? process.env.ALERT_RECIPIENTS.split(',') : [],
                from: process.env.SMTP_FROM || process.env.SMTP_USER
            },
            webhook: {
                enabled: Boolean(process.env.WEBHOOK_URL),
                url: process.env.WEBHOOK_URL,
                method: 'POST',
                timeout: 10000
            },
            slack: {
                enabled: Boolean(process.env.SLACK_WEBHOOK_URL),
                webhookUrl: process.env.SLACK_WEBHOOK_URL,
                channel: process.env.SLACK_CHANNEL || '#alerts',
                username: 'GateIO-Scraper-Bot'
            }
        },
        rules: {
            errorRate: {
                enabled: true,
                threshold: 5, // 5% error rate threshold in production
                window: 600 // 10 minutes
            },
            responseTime: {
                enabled: true,
                threshold: 45000 // 45 seconds
            },
            memoryUsage: {
                enabled: true,
                threshold: 85 // 85% memory usage
            },
            diskSpace: {
                enabled: true,
                threshold: 90 // 90% disk usage
            },
            noData: {
                enabled: true,
                threshold: 600 // 10 minutes without data
            }
        },
        cooldown: 900 // 15 minutes cooldown
    },
    
    security: {
        rateLimiting: {
            enabled: true,
            maxRequests: 50,
            windowMs: 900000 // 15 minutes
        },
        encryption: {
            enabled: Boolean(process.env.ENCRYPTION_KEY),
            keyRotation: 86400 // Daily key rotation
        },
        secrets: {
            encryptionKey: process.env.ENCRYPTION_KEY,
            jwtSecret: process.env.JWT_SECRET || 'production-secret-change-me'
        }
    },
    
    features: {
        validation: true,
        database: true,
        monitoring: true,
        alerting: true,
        dashboard: false,
        api: false,
        clustering: true,
        caching: true
    }
};
