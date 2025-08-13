// src/config/environments/staging.js
module.exports = {
    app: {
        environment: 'staging',
        debug: false,
        port: process.env.PORT || 3000
    },
    
    scraper: {
        targetUrl: process.env.TARGET_URL || 'https://www.gate.io/p2p/buy/USDT-KES',
        intervalMs: parseInt(process.env.SCRAPE_INTERVAL_MS) || 45000, // 45 seconds
        targetMerchant: process.env.TARGET_MERCHANT || '',
        headless: true,
        maxRetries: 3,
        timeout: 30000
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
            '--disable-gpu'
        ],
        slowMo: 0
    },
    
    database: {
        filename: process.env.DATABASE_PATH || './data/merchants-staging.db',
        options: {
            maxConnections: 5,
            acquireTimeout: 30000,
            timeout: 5000,
            foreignKeys: true,
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            cacheSize: -2000
        }
    },
    
    storage: {
        outputDir: process.env.OUTPUT_DIR || './data/staging',
        formats: ['json', 'csv'],
        compression: false,
        retention: {
            enabled: true,
            maxAge: 7, // Keep only 7 days in staging
            maxFiles: 50
        }
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        console: {
            enabled: true,
            level: 'info',
            colorize: false
        },
        file: {
            enabled: true,
            filename: './logs/staging.log',
            level: 'info',
            maxSize: '20MB',
            maxFiles: 5
        }
    },
    
    monitoring: {
        enabled: true,
        interval: 30000, // 30 seconds
        metrics: {
            system: true,
            performance: true,
            business: true,
            retention: 14 // 2 weeks
        },
        healthCheck: {
            enabled: true,
            interval: 60000, // 1 minute
            timeout: 5000
        },
        dashboard: {
            enabled: true,
            port: 3001,
            refreshInterval: 30000
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
                timeout: 5000
            },
            slack: {
                enabled: Boolean(process.env.SLACK_WEBHOOK_URL),
                webhookUrl: process.env.SLACK_WEBHOOK_URL,
                channel: process.env.SLACK_CHANNEL || '#staging-alerts',
                username: 'GateIO-Scraper-Staging'
            }
        },
        rules: {
            errorRate: {
                enabled: true,
                threshold: 15, // Higher threshold for staging
                window: 300 // 5 minutes
            },
            responseTime: {
                enabled: true,
                threshold: 35000 // 35 seconds
            },
            memoryUsage: {
                enabled: true,
                threshold: 80 // 80% memory usage
            },
            diskSpace: {
                enabled: true,
                threshold: 85 // 85% disk usage
            },
            noData: {
                enabled: true,
                threshold: 300 // 5 minutes without data
            }
        },
        cooldown: 300 // 5 minutes cooldown
    },
    
    security: {
        rateLimiting: {
            enabled: true,
            maxRequests: 100,
            windowMs: 900000 // 15 minutes
        },
        encryption: {
            enabled: false // Disable encryption in staging
        },
        secrets: {
            jwtSecret: process.env.JWT_SECRET || 'staging-secret'
        }
    },
    
    features: {
        validation: true,
        database: true,
        monitoring: true,
        alerting: true,
        dashboard: true,
        api: true,
        clustering: false,
        caching: false
    }
};
