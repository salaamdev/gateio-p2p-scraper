// src/config/environments/development.js
module.exports = {
    app: {
        environment: 'development',
        debug: true,
        port: 3000
    },
    
    scraper: {
        targetUrl: 'https://www.gate.io/p2p/buy/USDT-KES',
        intervalMs: 30000, // 30 seconds for development
        headless: false, // Show browser in development
        maxRetries: 2
    },
    
    browser: {
        slowMo: 100, // Slow down for better debugging
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    },
    
    database: {
        filename: './data/merchants-dev.db',
        options: {
            foreignKeys: true,
            journalMode: 'WAL'
        }
    },
    
    storage: {
        outputDir: './data/dev',
        formats: ['json', 'csv'],
        compression: false
    },
    
    logging: {
        level: 'debug',
        format: 'pretty',
        console: {
            enabled: true,
            colorize: true,
            level: 'debug'
        },
        file: {
            enabled: true,
            filename: './logs/dev.log',
            level: 'debug'
        }
    },
    
    monitoring: {
        enabled: true,
        interval: 15000, // 15 seconds
        dashboard: {
            enabled: true,
            port: 3001,
            refreshInterval: 10000
        },
        healthCheck: {
            enabled: true,
            interval: 30000
        }
    },
    
    alerting: {
        enabled: false, // Disable alerts in development
        channels: {
            email: { enabled: false },
            webhook: { enabled: false },
            slack: { enabled: false }
        }
    },
    
    security: {
        rateLimiting: {
            enabled: false // Disable rate limiting in development
        }
    },
    
    features: {
        validation: true,
        database: true,
        monitoring: true,
        alerting: false,
        dashboard: true,
        api: true,
        clustering: false,
        caching: false
    }
};
