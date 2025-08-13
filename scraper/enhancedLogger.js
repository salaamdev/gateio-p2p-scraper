// scraper/enhancedLogger.js
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

/**
 * Enhanced Logging System with Different Severity Levels
 * 
 * Features:
 * - Multiple severity levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Structured logging with metadata
 * - Multiple output targets (console, file, database)
 * - Log rotation and archiving
 * - Filtering and searching
 * - Performance logging
 * - Context-aware logging
 * - Log aggregation and analysis
 */

/**
 * Log Levels
 */
const LOG_LEVELS = {
    DEBUG: { level: 0, name: 'DEBUG', color: '\x1b[36m', emoji: '🔍' },
    INFO: { level: 1, name: 'INFO', color: '\x1b[32m', emoji: 'ℹ️' },
    WARN: { level: 2, name: 'WARN', color: '\x1b[33m', emoji: '⚠️' },
    ERROR: { level: 3, name: 'ERROR', color: '\x1b[31m', emoji: '❌' },
    FATAL: { level: 4, name: 'FATAL', color: '\x1b[35m', emoji: '💀' }
};

/**
 * Log Categories
 */
const LOG_CATEGORIES = {
    SYSTEM: 'SYSTEM',
    SCRAPING: 'SCRAPING',
    DATABASE: 'DATABASE',
    NETWORK: 'NETWORK',
    SECURITY: 'SECURITY',
    PERFORMANCE: 'PERFORMANCE',
    USER: 'USER',
    API: 'API',
    AUDIT: 'AUDIT'
};

/**
 * Log Entry Class
 */
class LogEntry {
    constructor(level, message, metadata = {}) {
        this.id = this.generateId();
        this.timestamp = new Date().toISOString();
        this.level = level;
        this.message = message;
        this.metadata = {
            category: metadata.category || LOG_CATEGORIES.SYSTEM,
            component: metadata.component || 'unknown',
            operation: metadata.operation || null,
            sessionId: metadata.sessionId || null,
            userId: metadata.userId || null,
            correlationId: metadata.correlationId || null,
            tags: metadata.tags || [],
            ...metadata
        };
        
        // Performance data
        this.performance = {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            timestamp: Date.now()
        };

        // Stack trace for errors
        if (level === 'ERROR' || level === 'FATAL') {
            this.stack = new Error().stack;
        }
    }

    generateId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            level: this.level,
            message: this.message,
            metadata: this.metadata,
            performance: this.performance,
            stack: this.stack
        };
    }

    toString() {
        const levelInfo = LOG_LEVELS[this.level];
        const timestamp = new Date(this.timestamp).toLocaleString();
        const category = this.metadata.category;
        const component = this.metadata.component;
        
        return `[${timestamp}] ${levelInfo.emoji} ${this.level} [${category}:${component}] ${this.message}`;
    }

    toColoredString() {
        const levelInfo = LOG_LEVELS[this.level];
        const reset = '\x1b[0m';
        const timestamp = new Date(this.timestamp).toLocaleString();
        const category = this.metadata.category;
        const component = this.metadata.component;
        
        return `${levelInfo.color}[${timestamp}] ${levelInfo.emoji} ${this.level} [${category}:${component}] ${this.message}${reset}`;
    }
}

/**
 * Log Target Interface
 */
class LogTarget {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.enabled = options.enabled !== false;
        this.minLevel = options.minLevel || 'DEBUG';
        this.maxLevel = options.maxLevel || 'FATAL';
        this.categories = options.categories || Object.values(LOG_CATEGORIES);
        this.formatter = options.formatter || null;
    }

    shouldLog(entry) {
        if (!this.enabled) return false;
        
        const entryLevel = LOG_LEVELS[entry.level].level;
        const minLevel = LOG_LEVELS[this.minLevel].level;
        const maxLevel = LOG_LEVELS[this.maxLevel].level;
        
        if (entryLevel < minLevel || entryLevel > maxLevel) return false;
        if (!this.categories.includes(entry.metadata.category)) return false;
        
        return true;
    }

    format(entry) {
        if (this.formatter) {
            return this.formatter(entry);
        }
        return entry.toString();
    }

    async write(_entry) {
        throw new Error('write method must be implemented by subclasses');
    }
}

/**
 * Console Log Target
 */
class ConsoleTarget extends LogTarget {
    constructor(options = {}) {
        super('console', options);
        this.useColors = options.useColors !== false;
    }

    async write(entry) {
        const output = this.useColors ? entry.toColoredString() : entry.toString();
        
        if (entry.level === 'ERROR' || entry.level === 'FATAL') {
            console.error(output);
            if (entry.stack && this.options.includeStack) {
                console.error(entry.stack);
            }
        } else {
            console.log(output);
        }

        // Include metadata in debug mode
        if (this.options.includeMetadata && Object.keys(entry.metadata).length > 0) {
            console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
        }
    }
}

/**
 * File Log Target
 */
class FileTarget extends LogTarget {
    constructor(options = {}) {
        super('file', options);
        this.filePath = options.filePath || path.join(process.cwd(), 'logs', 'app.log');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;
        this.rotateDaily = options.rotateDaily !== false;
        this.buffer = [];
        this.bufferSize = options.bufferSize || 100;
        this.flushInterval = options.flushInterval || 5000; // 5 seconds
        
        this.initializeFile();
        this.startFlushTimer();
    }

    async initializeFile() {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    startFlushTimer() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    async write(entry) {
        const logLine = JSON.stringify(entry.toJSON()) + '\n';
        this.buffer.push(logLine);
        
        if (this.buffer.length >= this.bufferSize) {
            await this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;
        
        try {
            // Check if rotation is needed
            await this.rotateIfNeeded();
            
            // Write buffered logs
            const content = this.buffer.join('');
            await fs.appendFile(this.filePath, content);
            this.buffer = [];
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    async rotateIfNeeded() {
        try {
            const stats = await fs.stat(this.filePath);
            const shouldRotateSize = stats.size >= this.maxFileSize;
            const shouldRotateDaily = this.rotateDaily && this.shouldRotateDaily(stats.mtime);
            
            if (shouldRotateSize || shouldRotateDaily) {
                await this.rotateFile();
            }
        } catch (error) {
            // File doesn't exist, no rotation needed
        }
    }

    shouldRotateDaily(lastModified) {
        const now = new Date();
        const fileDate = new Date(lastModified);
        return now.toDateString() !== fileDate.toDateString();
    }

    async rotateFile() {
        const ext = path.extname(this.filePath);
        const base = path.basename(this.filePath, ext);
        const dir = path.dirname(this.filePath);
        
        // Generate timestamp for rotated file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = path.join(dir, `${base}.${timestamp}${ext}`);
        
        try {
            // Move current file to rotated name
            await fs.rename(this.filePath, rotatedPath);
            
            // Clean up old files
            await this.cleanupOldFiles(dir, base, ext);
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }

    async cleanupOldFiles(dir, base, ext) {
        try {
            const files = await fs.readdir(dir);
            const logFiles = files
                .filter(f => f.startsWith(base) && f.endsWith(ext) && f !== path.basename(this.filePath))
                .map(f => ({
                    name: f,
                    path: path.join(dir, f),
                    stats: null
                }));
            
            // Get file stats
            for (const file of logFiles) {
                try {
                    file.stats = await fs.stat(file.path);
                } catch (statsError) {
                    console.warn(`Failed to get stats for ${file.name}:`, statsError);
                }
            }
            
            // Sort by modification time (newest first)
            logFiles
                .filter(f => f.stats)
                .sort((a, b) => b.stats.mtime - a.stats.mtime)
                .slice(this.maxFiles) // Keep only the newest files
                .forEach(async (file) => {
                    try {
                        await fs.unlink(file.path);
                        console.log(`Cleaned up old log file: ${file.name}`);
                    } catch (unlinkError) {
                        console.warn(`Failed to delete old log file ${file.name}:`, unlinkError);
                    }
                });
        } catch (error) {
            console.error('Failed to cleanup old log files:', error);
        }
    }
}

/**
 * Database Log Target
 */
class DatabaseTarget extends LogTarget {
    constructor(database, options = {}) {
        super('database', options);
        this.database = database;
        this.tableName = options.tableName || 'logs';
        this.buffer = [];
        this.bufferSize = options.bufferSize || 50;
        this.flushInterval = options.flushInterval || 10000; // 10 seconds
        
        this.initializeTable();
        this.startFlushTimer();
    }

    async initializeTable() {
        if (!this.database) return;
        
        try {
            // Create logs table if it doesn't exist
            await this.database.exec(`
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    category TEXT,
                    component TEXT,
                    message TEXT NOT NULL,
                    metadata TEXT,
                    performance TEXT,
                    stack TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes for better query performance
            await this.database.exec(`
                CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ${this.tableName}(timestamp);
                CREATE INDEX IF NOT EXISTS idx_logs_level ON ${this.tableName}(level);
                CREATE INDEX IF NOT EXISTS idx_logs_category ON ${this.tableName}(category);
            `);
        } catch (error) {
            console.error('Failed to initialize log database table:', error);
        }
    }

    startFlushTimer() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    async write(entry) {
        this.buffer.push(entry);
        
        if (this.buffer.length >= this.bufferSize) {
            await this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0 || !this.database) return;
        
        try {
            const stmt = await this.database.prepare(`
                INSERT INTO ${this.tableName} 
                (id, timestamp, level, category, component, message, metadata, performance, stack)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const entry of this.buffer) {
                await stmt.run([
                    entry.id,
                    entry.timestamp,
                    entry.level,
                    entry.metadata.category,
                    entry.metadata.component,
                    entry.message,
                    JSON.stringify(entry.metadata),
                    JSON.stringify(entry.performance),
                    entry.stack || null
                ]);
            }
            
            await stmt.finalize();
            this.buffer = [];
        } catch (error) {
            console.error('Failed to write logs to database:', error);
        }
    }
}

/**
 * Enhanced Logger Class
 */
class EnhancedLogger {
    constructor(options = {}) {
        this.options = {
            minLevel: options.minLevel || 'DEBUG',
            context: options.context || {},
            enablePerformanceLogging: options.enablePerformanceLogging !== false,
            ...options
        };

        this.targets = [];
        this.contextStack = [this.options.context];
        this.performanceMarks = new Map();
        this.metrics = {
            totalLogs: 0,
            logsByLevel: {},
            logsByCategory: {},
            errors: 0,
            warnings: 0
        };

        // Initialize default targets
        this.initializeDefaultTargets();
    }

    initializeDefaultTargets() {
        // Console target
        this.addTarget(new ConsoleTarget({
            useColors: true,
            includeMetadata: false,
            includeStack: false
        }));

        // File target
        this.addTarget(new FileTarget({
            filePath: path.join(process.cwd(), 'logs', 'enhanced.log'),
            maxFileSize: 10 * 1024 * 1024,
            maxFiles: 10,
            rotateDaily: true
        }));
    }

    addTarget(target) {
        this.targets.push(target);
        return this;
    }

    removeTarget(targetName) {
        this.targets = this.targets.filter(t => t.name !== targetName);
        return this;
    }

    /**
     * Context management
     */
    pushContext(context) {
        const currentContext = this.getCurrentContext();
        this.contextStack.push({ ...currentContext, ...context });
        return this;
    }

    popContext() {
        if (this.contextStack.length > 1) {
            this.contextStack.pop();
        }
        return this;
    }

    getCurrentContext() {
        return this.contextStack[this.contextStack.length - 1] || {};
    }

    withContext(context, fn) {
        this.pushContext(context);
        try {
            return fn();
        } finally {
            this.popContext();
        }
    }

    async withContextAsync(context, fn) {
        this.pushContext(context);
        try {
            return await fn();
        } finally {
            this.popContext();
        }
    }

    /**
     * Core logging methods
     */
    async log(level, message, metadata = {}) {
        const mergedMetadata = { ...this.getCurrentContext(), ...metadata };
        const entry = new LogEntry(level, message, mergedMetadata);
        
        // Update metrics
        this.updateMetrics(entry);
        
        // Write to all applicable targets
        const writePromises = this.targets
            .filter(target => target.shouldLog(entry))
            .map(target => target.write(entry).catch(error => {
                console.error(`Error writing to ${target.name} target:`, error);
            }));
        
        await Promise.allSettled(writePromises);
        
        return entry;
    }

    debug(message, metadata = {}) {
        return this.log('DEBUG', message, metadata);
    }

    info(message, metadata = {}) {
        return this.log('INFO', message, metadata);
    }

    warn(message, metadata = {}) {
        return this.log('WARN', message, metadata);
    }

    error(message, error = null, metadata = {}) {
        const errorMetadata = { ...metadata };
        
        if (error) {
            errorMetadata.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            };
        }
        
        return this.log('ERROR', message, errorMetadata);
    }

    fatal(message, error = null, metadata = {}) {
        const errorMetadata = { ...metadata };
        
        if (error) {
            errorMetadata.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            };
        }
        
        return this.log('FATAL', message, errorMetadata);
    }

    /**
     * Performance logging
     */
    startPerformanceMark(name, metadata = {}) {
        if (!this.options.enablePerformanceLogging) return;
        
        const mark = {
            name,
            startTime: Date.now(),
            metadata: { ...this.getCurrentContext(), ...metadata }
        };
        
        this.performanceMarks.set(name, mark);
        
        this.debug(`Performance mark started: ${name}`, {
            category: LOG_CATEGORIES.PERFORMANCE,
            operation: 'performance_start',
            markName: name,
            ...metadata
        });
        
        return mark;
    }

    endPerformanceMark(name, metadata = {}) {
        if (!this.options.enablePerformanceLogging) return;
        
        const mark = this.performanceMarks.get(name);
        if (!mark) {
            this.warn(`Performance mark not found: ${name}`, {
                category: LOG_CATEGORIES.PERFORMANCE
            });
            return null;
        }
        
        const endTime = Date.now();
        const duration = endTime - mark.startTime;
        
        this.performanceMarks.delete(name);
        
        const result = {
            name,
            duration,
            startTime: mark.startTime,
            endTime,
            metadata: { ...mark.metadata, ...metadata }
        };
        
        this.info(`Performance mark completed: ${name} (${duration}ms)`, {
            category: LOG_CATEGORIES.PERFORMANCE,
            operation: 'performance_end',
            performance: result,
            ...metadata
        });
        
        return result;
    }

    async measurePerformance(name, fn, metadata = {}) {
        this.startPerformanceMark(name, metadata);
        try {
            const result = await fn();
            this.endPerformanceMark(name, { success: true });
            return result;
        } catch (error) {
            this.endPerformanceMark(name, { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * Structured logging helpers
     */
    logHTTPRequest(method, url, statusCode, duration, metadata = {}) {
        const level = statusCode >= 400 ? 'ERROR' : statusCode >= 300 ? 'WARN' : 'INFO';
        
        return this.log(level, `HTTP ${method} ${url} ${statusCode} (${duration}ms)`, {
            category: LOG_CATEGORIES.API,
            operation: 'http_request',
            http: {
                method,
                url,
                statusCode,
                duration
            },
            ...metadata
        });
    }

    logDatabaseOperation(operation, table, duration, rowsAffected = null, metadata = {}) {
        return this.info(`Database ${operation} on ${table} (${duration}ms)`, {
            category: LOG_CATEGORIES.DATABASE,
            operation: 'database_operation',
            database: {
                operation,
                table,
                duration,
                rowsAffected
            },
            ...metadata
        });
    }

    logScrapingOperation(url, recordsFound, duration, success = true, metadata = {}) {
        const level = success ? 'INFO' : 'ERROR';
        
        return this.log(level, `Scraping ${url}: ${recordsFound} records (${duration}ms)`, {
            category: LOG_CATEGORIES.SCRAPING,
            operation: 'scraping_operation',
            scraping: {
                url,
                recordsFound,
                duration,
                success
            },
            ...metadata
        });
    }

    logSecurityEvent(event, severity = 'WARN', metadata = {}) {
        return this.log(severity, `Security event: ${event}`, {
            category: LOG_CATEGORIES.SECURITY,
            operation: 'security_event',
            security: {
                event,
                severity
            },
            ...metadata
        });
    }

    /**
     * Metrics and statistics
     */
    updateMetrics(entry) {
        this.metrics.totalLogs++;
        
        // Count by level
        if (!this.metrics.logsByLevel[entry.level]) {
            this.metrics.logsByLevel[entry.level] = 0;
        }
        this.metrics.logsByLevel[entry.level]++;
        
        // Count by category
        const category = entry.metadata.category;
        if (!this.metrics.logsByCategory[category]) {
            this.metrics.logsByCategory[category] = 0;
        }
        this.metrics.logsByCategory[category]++;
        
        // Count errors and warnings
        if (entry.level === 'ERROR' || entry.level === 'FATAL') {
            this.metrics.errors++;
        } else if (entry.level === 'WARN') {
            this.metrics.warnings++;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            activePerformanceMarks: this.performanceMarks.size,
            targets: this.targets.map(t => ({
                name: t.name,
                enabled: t.enabled,
                minLevel: t.minLevel
            }))
        };
    }

    /**
     * Log searching and filtering
     */
    async searchLogs(criteria = {}) {
        // This would search through log files or database
        // Implementation depends on available log targets
        const results = [];
        
        for (const target of this.targets) {
            if (target instanceof DatabaseTarget && target.database) {
                try {
                    const logs = await this.searchDatabaseLogs(target, criteria);
                    results.push(...logs);
                } catch (error) {
                    this.error('Failed to search database logs', error);
                }
            }
        }
        
        return results;
    }

    async searchDatabaseLogs(target, criteria) {
        const {
            level = null,
            category = null,
            component = null,
            startTime = null,
            endTime = null,
            limit = 100
        } = criteria;
        
        let query = `SELECT * FROM ${target.tableName} WHERE 1=1`;
        const params = [];
        
        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        if (component) {
            query += ' AND component = ?';
            params.push(component);
        }
        
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(startTime);
        }
        
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(endTime);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        
        const stmt = await target.database.prepare(query);
        const rows = await stmt.all(params);
        await stmt.finalize();
        
        return rows.map(row => ({
            ...row,
            metadata: JSON.parse(row.metadata || '{}'),
            performance: JSON.parse(row.performance || '{}')
        }));
    }

    /**
     * Cleanup and shutdown
     */
    async flush() {
        const flushPromises = this.targets.map(target => {
            if (target.flush) {
                return target.flush().catch(error => {
                    console.error(`Error flushing ${target.name} target:`, error);
                });
            }
            return Promise.resolve();
        });
        
        await Promise.allSettled(flushPromises);
    }

    async shutdown() {
        this.info('Logger shutting down', {
            category: LOG_CATEGORIES.SYSTEM,
            operation: 'shutdown'
        });
        
        await this.flush();
        
        // Clear performance marks
        this.performanceMarks.clear();
    }
}

/**
 * Global logger instance
 */
let globalLogger = null;

/**
 * Logger factory functions
 */
function createLogger(options = {}) {
    return new EnhancedLogger(options);
}

function getGlobalLogger() {
    if (!globalLogger) {
        globalLogger = createLogger();
    }
    return globalLogger;
}

function setGlobalLogger(logger) {
    globalLogger = logger;
}

// Convenience functions using global logger
function debug(message, metadata) {
    return getGlobalLogger().debug(message, metadata);
}

function info(message, metadata) {
    return getGlobalLogger().info(message, metadata);
}

function warn(message, metadata) {
    return getGlobalLogger().warn(message, metadata);
}

function error(message, err, metadata) {
    return getGlobalLogger().error(message, err, metadata);
}

function fatal(message, err, metadata) {
    return getGlobalLogger().fatal(message, err, metadata);
}

module.exports = {
    EnhancedLogger,
    LogEntry,
    LogTarget,
    ConsoleTarget,
    FileTarget,
    DatabaseTarget,
    LOG_LEVELS,
    LOG_CATEGORIES,
    createLogger,
    getGlobalLogger,
    setGlobalLogger,
    debug,
    info,
    warn,
    error,
    fatal
};
