// src/services/index.js
const { configService } = require('./config/ConfigService');
const { MonitoringService, MetricsCollector, HealthChecker, AlertManager } = require('./monitoring');

// Core services
const ScraperService = require('./scraper/ScraperService');
const DatabaseService = require('./database/DatabaseService');
const BrowserService = require('./browser/BrowserService');

// Utility services
const LoggerService = require('./logger/LoggerService');
const DataService = require('./data/DataService');

module.exports = {
    // Configuration
    configService,
    
    // Monitoring
    MonitoringService,
    MetricsCollector,
    HealthChecker,
    AlertManager,
    
    // Core services
    ScraperService,
    DatabaseService,
    BrowserService,
    
    // Utility services
    LoggerService,
    DataService
};
