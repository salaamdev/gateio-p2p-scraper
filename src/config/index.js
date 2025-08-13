// src/config/index.js
const { configService } = require('../services/config/ConfigService');

module.exports = {
    configService,
    get: (path, defaultValue) => configService.get(path, defaultValue),
    set: (path, value) => configService.set(path, value),
    has: (path) => configService.has(path),
    getAll: () => configService.getAll(),
    getSection: (section) => configService.getSection(section),
    isFeatureEnabled: (feature) => configService.isFeatureEnabled(feature),
    isDevelopment: () => configService.isDevelopment(),
    isProduction: () => configService.isProduction(),
    isStaging: () => configService.isStaging()
};
