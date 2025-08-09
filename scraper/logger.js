// scraper/logger.js
const fs = require('fs');
const path = require('path');

// --- Ensure logs directory exists ---
const logsDir = path.join(__dirname, '../', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, {recursive: true});
}

class Logger {
    constructor (filename) {
        this.logFile = path.join(logsDir, filename);
    }

    write (message) {
        const timestamp = new Date().toISOString();
        try {
            fs.appendFileSync(this.logFile, `[${ timestamp }] ${ message }\n`, 'utf8');
        } catch (err) {
            // As a last resort, write to stderr to avoid losing logs entirely
            console.error('LOG WRITE FAILED:', err?.message || err);
        }
    }
}

// Create logger instances for activity, warnings, and errors
const activityLogger = new Logger('activity.log');
const warningLogger = new Logger('warnings.log');
const errorLogger = new Logger('errors.log');

// Logging helper functions
function log (message) {
    activityLogger.write(`INFO: ${ message }`);
}

function warn (message) {
    warningLogger.write(`WARNING: ${ message }`);
}

function errorLog (message, err = null) {
    errorLogger.write(`ERROR: ${ message }${ err ? ` | Details: ${ err.stack || err }` : '' }`);
}

module.exports = {
    log,
    warn,
    errorLog
};
