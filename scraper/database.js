// scraper/database.js
const fs = require('fs');
const path = require('path');
const { errorLog, log } = require('./logger');
const { validateMerchants, generateScrapeId } = require('./schema');

// Dynamic import for sqlite3 to avoid ESLint extraneous dependency warning
let sqlite3;
try {
    sqlite3 = require('sqlite3').verbose();
} catch (error) {
    errorLog('SQLite3 is required for database functionality. Please install it with: npm install sqlite3');
    throw error;
}

/**
 * Database configuration
 */
const DB_CONFIG = {
    filename: 'data/merchants.db',
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    backupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxBackups: 7, // Keep 7 days of backups
    pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: 1000,
        foreign_keys: 'ON'
    }
};

/**
 * Database table schemas
 */
const TABLE_SCHEMAS = {
    merchants: `
        CREATE TABLE IF NOT EXISTS merchants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scrape_id TEXT NOT NULL,
            merchant_name TEXT NOT NULL,
            price TEXT NOT NULL,
            price_numeric REAL NOT NULL,
            available_amount TEXT NOT NULL,
            available_amount_numeric REAL NOT NULL,
            limit_range TEXT NOT NULL,
            limit_min REAL NOT NULL,
            limit_max REAL NOT NULL,
            payment_methods TEXT,
            completion_rate REAL,
            orders INTEGER,
            avg_pay_time TEXT,
            avg_release_time TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            source TEXT NOT NULL DEFAULT 'gate.io',
            schema_version TEXT NOT NULL DEFAULT '1.0.0',
            raw_data TEXT,
            UNIQUE(scrape_id, merchant_name)
        )
    `,
    
    scrape_sessions: `
        CREATE TABLE IF NOT EXISTS scrape_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scrape_id TEXT UNIQUE NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
            total_merchants INTEGER DEFAULT 0,
            valid_merchants INTEGER DEFAULT 0,
            invalid_merchants INTEGER DEFAULT 0,
            errors_count INTEGER DEFAULT 0,
            warnings_count INTEGER DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'gate.io',
            version TEXT NOT NULL,
            metadata TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `,
    
    validation_errors: `
        CREATE TABLE IF NOT EXISTS validation_errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scrape_id TEXT NOT NULL,
            merchant_index INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            field_value TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scrape_id) REFERENCES scrape_sessions(scrape_id)
        )
    `,
    
    data_quality_metrics: `
        CREATE TABLE IF NOT EXISTS data_quality_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scrape_id TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            metric_unit TEXT,
            calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scrape_id) REFERENCES scrape_sessions(scrape_id)
        )
    `
};

/**
 * Database indexes for performance
 */
const INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_merchants_scrape_id ON merchants(scrape_id)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_created_at ON merchants(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_price_numeric ON merchants(price_numeric)',
    'CREATE INDEX IF NOT EXISTS idx_merchants_merchant_name ON merchants(merchant_name)',
    'CREATE INDEX IF NOT EXISTS idx_scrape_sessions_status ON scrape_sessions(status)',
    'CREATE INDEX IF NOT EXISTS idx_scrape_sessions_created_at ON scrape_sessions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_validation_errors_scrape_id ON validation_errors(scrape_id)',
    'CREATE INDEX IF NOT EXISTS idx_validation_errors_field_name ON validation_errors(field_name)',
    'CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_scrape_id ON data_quality_metrics(scrape_id)'
];

/**
 * Database connection manager
 */
class DatabaseManager {
    constructor(config = DB_CONFIG) {
        this.config = config;
        this.db = null;
        this.isConnected = false;
        this.lastBackup = null;
    }

    /**
     * Initialize database connection and schema
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dbDir = path.dirname(this.config.filename);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            log('Initializing database connection...');
            
            // Create database connection
            await this.connect();
            
            // Configure database
            await this.configurePragmas();
            await this.createTables();
            await this.createIndexes();
            
            log('Database initialization complete');

        } catch (error) {
            errorLog('Database initialization error', error);
            throw error;
        }
    }

    /**
     * Connect to database
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.config.filename, this.config.mode, (err) => {
                if (err) {
                    errorLog('Failed to connect to database', err);
                    reject(err);
                    return;
                }

                this.isConnected = true;
                log(`Database connected: ${this.config.filename}`);
                resolve();
            });
        });
    }

    /**
     * Configure database pragmas for performance and reliability
     */
    async configurePragmas() {
        const pragmaPromises = Object.entries(this.config.pragmas).map(([pragma, value]) => {
            return new Promise((resolve, reject) => {
                this.db.run(`PRAGMA ${pragma} = ${value}`, (err) => {
                    if (err) {
                        errorLog(`Failed to set pragma ${pragma}`, err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        await Promise.all(pragmaPromises);
        log('Database pragmas configured');
    }

    /**
     * Create database tables
     */
    async createTables() {
        const tablePromises = Object.entries(TABLE_SCHEMAS).map(([tableName, schema]) => {
            return new Promise((resolve, reject) => {
                this.db.run(schema, (err) => {
                    if (err) {
                        errorLog(`Failed to create table ${tableName}`, err);
                        reject(err);
                    } else {
                        log(`Table '${tableName}' created/verified`);
                        resolve();
                    }
                });
            });
        });

        await Promise.all(tablePromises);
        log('Database tables created/verified');
    }

    /**
     * Create database indexes
     */
    async createIndexes() {
        const indexPromises = INDEXES.map((indexSql) => {
            return new Promise((resolve, reject) => {
                this.db.run(indexSql, (err) => {
                    if (err) {
                        errorLog('Failed to create index', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        await Promise.all(indexPromises);
        log('Database indexes created/verified');
    }

    /**
     * Start a new scrape session
     */
    async startScrapeSession(metadata = {}) {
        const scrapeId = generateScrapeId();
        const startTime = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO scrape_sessions 
                (scrape_id, start_time, status, source, version, metadata) 
                VALUES (?, ?, 'running', ?, ?, ?)
            `);
            
            stmt.run([
                scrapeId,
                startTime,
                metadata.source || 'gate.io',
                metadata.version || '1.0.0',
                JSON.stringify(metadata)
            ], function(err) {
                if (err) {
                    errorLog('Failed to start scrape session', err);
                    reject(err);
                } else {
                    log(`Started scrape session: ${scrapeId}`);
                    resolve(scrapeId);
                }
            });
            
            stmt.finalize();
        });
    }

    /**
     * Complete a scrape session
     */
    async completeScrapeSession(scrapeId, results) {
        const endTime = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE scrape_sessions 
                SET end_time = ?, status = ?, total_merchants = ?, 
                    valid_merchants = ?, invalid_merchants = ?, 
                    errors_count = ?, warnings_count = ?
                WHERE scrape_id = ?
            `);
            
            stmt.run([
                endTime,
                results.summary.invalidCount > 0 ? 'completed' : 'completed',
                results.totalRecords,
                results.summary.validCount,
                results.summary.invalidCount,
                results.summary.totalErrors,
                results.summary.totalWarnings,
                scrapeId
            ], function(err) {
                if (err) {
                    errorLog('Failed to complete scrape session', err);
                    reject(err);
                } else {
                    log(`Completed scrape session: ${scrapeId}`);
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    /**
     * Fail a scrape session
     */
    async failScrapeSession(scrapeId, error) {
        const endTime = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE scrape_sessions 
                SET end_time = ?, status = 'failed', metadata = ?
                WHERE scrape_id = ?
            `);
            
            const errorMetadata = JSON.stringify({
                error: error.message,
                stack: error.stack,
                timestamp: endTime
            });
            
            stmt.run([endTime, errorMetadata, scrapeId], function(err) {
                if (err) {
                    errorLog('Failed to mark scrape session as failed', err);
                    reject(err);
                } else {
                    log(`Marked scrape session as failed: ${scrapeId}`);
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    /**
     * Insert validated merchant data
     */
    async insertMerchants(scrapeId, validationResults) {
        if (validationResults.validRecords.length === 0) {
            log('No valid merchants to insert');
            return { inserted: 0, skipped: 0 };
        }

        let inserted = 0;
        let skipped = 0;

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO merchants (
                scrape_id, merchant_name, price, price_numeric,
                available_amount, available_amount_numeric,
                limit_range, limit_min, limit_max,
                payment_methods, completion_rate, orders,
                avg_pay_time, avg_release_time, source,
                schema_version, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                for (const record of validationResults.validRecords) {
                    const merchant = record.data;
                    
                    stmt.run([
                        scrapeId,
                        merchant['Merchant Name'],
                        merchant['Price'],
                        merchant['PriceNumeric'],
                        merchant['Available Amount'],
                        merchant['AvailableAmountNumeric'],
                        merchant['Limit'],
                        merchant['LimitMin'],
                        merchant['LimitMax'],
                        merchant['Payment Methods'] || null,
                        merchant['Completion Rate'] || null,
                        merchant['Orders'] || null,
                        merchant['Avg Pay Time'] || null,
                        merchant['Avg Release Time'] || null,
                        'gate.io',
                        '1.0.0',
                        JSON.stringify(merchant)
                    ], function(err) {
                        if (err) {
                            if (err.code === 'SQLITE_CONSTRAINT') {
                                skipped++;
                            } else {
                                errorLog('Failed to insert merchant', err);
                            }
                        } else {
                            inserted++;
                        }
                    });
                }

                this.db.run('COMMIT', (err) => {
                    if (err) {
                        errorLog('Failed to commit merchant data', err);
                        reject(err);
                    } else {
                        log(`Inserted ${inserted} merchants, skipped ${skipped} duplicates`);
                        resolve({ inserted, skipped });
                    }
                });
            });

            stmt.finalize();
        });
    }

    /**
     * Insert validation errors
     */
    async insertValidationErrors(scrapeId, validationResults) {
        if (validationResults.invalidRecords.length === 0) {
            return { inserted: 0 };
        }

        const stmt = this.db.prepare(`
            INSERT INTO validation_errors 
            (scrape_id, merchant_index, field_name, rule_type, error_message, field_value)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                for (const record of validationResults.invalidRecords) {
                    for (const error of record.validation.errors) {
                        stmt.run([
                            scrapeId,
                            record.index,
                            error.field,
                            error.rule,
                            error.message,
                            String(error.value)
                        ], function(err) {
                            if (err) {
                                errorLog('Failed to insert validation error', err);
                            } else {
                                inserted++;
                            }
                        });
                    }
                }

                this.db.run('COMMIT', (err) => {
                    if (err) {
                        errorLog('Failed to commit validation errors', err);
                        reject(err);
                    } else {
                        log(`Inserted ${inserted} validation errors`);
                        resolve({ inserted });
                    }
                });
            });

            stmt.finalize();
        });
    }

    /**
     * Get merchants from database with filtering and pagination
     */
    async getMerchants(options = {}) {
        const {
            limit = 50,
            offset = 0,
            orderBy = 'created_at',
            orderDirection = 'DESC',
            scrapeId = null,
            minPrice = null,
            maxPrice = null,
            merchantName = null
        } = options;

        let whereClause = '1=1';
        const params = [];

        if (scrapeId) {
            whereClause += ' AND scrape_id = ?';
            params.push(scrapeId);
        }

        if (minPrice !== null) {
            whereClause += ' AND price_numeric >= ?';
            params.push(minPrice);
        }

        if (maxPrice !== null) {
            whereClause += ' AND price_numeric <= ?';
            params.push(maxPrice);
        }

        if (merchantName) {
            whereClause += ' AND merchant_name LIKE ?';
            params.push(`%${merchantName}%`);
        }

        const sql = `
            SELECT * FROM merchants 
            WHERE ${whereClause}
            ORDER BY ${orderBy} ${orderDirection}
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    errorLog('Failed to get merchants', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get scrape session statistics
     */
    async getScrapeSessions(limit = 10) {
        const sql = `
            SELECT * FROM scrape_sessions 
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        return new Promise((resolve, reject) => {
            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    errorLog('Failed to get scrape sessions', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get data quality metrics
     */
    async getDataQualityMetrics(scrapeId = null) {
        let sql = 'SELECT * FROM data_quality_metrics';
        const params = [];

        if (scrapeId) {
            sql += ' WHERE scrape_id = ?';
            params.push(scrapeId);
        }

        sql += ' ORDER BY calculated_at DESC';

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    errorLog('Failed to get data quality metrics', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Create database backup
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(path.dirname(this.config.filename), 'backups');
            
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const backupPath = path.join(backupDir, `merchants_${timestamp}.db`);
            
            return new Promise((resolve, reject) => {
                this.db.backup(backupPath, (err) => {
                    if (err) {
                        errorLog('Database backup failed', err);
                        reject(err);
                    } else {
                        this.lastBackup = new Date();
                        log(`Database backup created: ${backupPath}`);
                        
                        // Clean up old backups
                        this.cleanupOldBackups(backupDir);
                        resolve(backupPath);
                    }
                });
            });

        } catch (error) {
            errorLog('Backup creation error', error);
            throw error;
        }
    }

    /**
     * Clean up old backup files
     */
    cleanupOldBackups(backupDir) {
        try {
            const files = fs.readdirSync(backupDir)
                .filter(file => file.startsWith('merchants_') && file.endsWith('.db'))
                .map(file => ({
                    name: file,
                    path: path.join(backupDir, file),
                    mtime: fs.statSync(path.join(backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Keep only the latest N backups
            const filesToDelete = files.slice(this.config.maxBackups);
            
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
                log(`Deleted old backup: ${file.name}`);
            }

        } catch (error) {
            errorLog('Failed to cleanup old backups', error);
        }
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db && this.isConnected) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        errorLog('Error closing database', err);
                    } else {
                        log('Database connection closed');
                    }
                    this.isConnected = false;
                    resolve();
                });
            });
        }
    }
}

/**
 * Data Pipeline for processing scraped data
 */
class DataPipeline {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.currentScrapeId = null;
    }

    /**
     * Process scraped merchant data through the complete pipeline
     */
    async processData(merchants, metadata = {}) {
        try {
            log(`Starting data pipeline for ${merchants.length} merchants`);
            
            // Step 1: Start scrape session
            this.currentScrapeId = await this.dbManager.startScrapeSession(metadata);
            
            // Step 2: Validate data
            log('Step 1: Validating merchant data...');
            const validationResults = validateMerchants(merchants);
            
            // Step 3: Store validation errors
            if (validationResults.invalidRecords.length > 0) {
                log('Step 2: Storing validation errors...');
                await this.dbManager.insertValidationErrors(this.currentScrapeId, validationResults);
            }
            
            // Step 4: Store valid data
            if (validationResults.validRecords.length > 0) {
                log('Step 3: Storing valid merchant data...');
                await this.dbManager.insertMerchants(this.currentScrapeId, validationResults);
            }
            
            // Step 5: Calculate and store metrics
            log('Step 4: Calculating data quality metrics...');
            await this.calculateDataQualityMetrics(this.currentScrapeId, validationResults);
            
            // Step 6: Complete session
            await this.dbManager.completeScrapeSession(this.currentScrapeId, validationResults);
            
            // Step 7: Create backup if needed
            await this.checkAndCreateBackup();
            
            log(`Data pipeline completed successfully for scrape: ${this.currentScrapeId}`);
            
            return {
                scrapeId: this.currentScrapeId,
                validationResults,
                summary: {
                    processed: merchants.length,
                    valid: validationResults.summary.validCount,
                    invalid: validationResults.summary.invalidCount,
                    errors: validationResults.summary.totalErrors,
                    warnings: validationResults.summary.totalWarnings
                }
            };
            
        } catch (error) {
            errorLog('Data pipeline failed', error);
            
            if (this.currentScrapeId) {
                await this.dbManager.failScrapeSession(this.currentScrapeId, error);
            }
            
            throw error;
        }
    }

    /**
     * Calculate and store data quality metrics
     */
    async calculateDataQualityMetrics(scrapeId, validationResults) {
        const metrics = [
            {
                name: 'data_completeness_rate',
                value: (validationResults.summary.validCount / validationResults.totalRecords) * 100,
                unit: 'percentage'
            },
            {
                name: 'validation_error_rate',
                value: (validationResults.summary.totalErrors / validationResults.totalRecords),
                unit: 'ratio'
            },
            {
                name: 'field_error_density',
                value: validationResults.summary.totalErrors / (validationResults.totalRecords * Object.keys(validationResults.aggregateErrors).length || 1),
                unit: 'errors_per_field'
            }
        ];

        const stmt = this.dbManager.db.prepare(`
            INSERT INTO data_quality_metrics 
            (scrape_id, metric_name, metric_value, metric_unit)
            VALUES (?, ?, ?, ?)
        `);

        for (const metric of metrics) {
            stmt.run([scrapeId, metric.name, metric.value, metric.unit]);
        }

        stmt.finalize();
        log(`Stored ${metrics.length} data quality metrics`);
    }

    /**
     * Check if backup is needed and create one
     */
    async checkAndCreateBackup() {
        if (!this.dbManager.lastBackup || 
            (Date.now() - this.dbManager.lastBackup.getTime()) > this.dbManager.config.backupInterval) {
            await this.dbManager.createBackup();
        }
    }
}

// Global database manager instance
let globalDbManager = null;

/**
 * Get or create global database manager
 */
function getDatabaseManager() {
    if (!globalDbManager) {
        globalDbManager = new DatabaseManager();
    }
    return globalDbManager;
}

module.exports = {
    DatabaseManager,
    DataPipeline,
    DB_CONFIG,
    TABLE_SCHEMAS,
    getDatabaseManager
};
