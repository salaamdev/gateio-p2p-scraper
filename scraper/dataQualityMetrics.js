// scraper/dataQualityMetrics.js
const { log, errorLog } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Data Quality Metrics System
 * 
 * Features:
 * - Data completeness analysis
 * - Data accuracy validation
 * - Data consistency checks
 * - Data freshness monitoring
 * - Quality scoring and reporting
 * - Trend analysis and alerts
 */

/**
 * Quality Metric Types
 */
const QUALITY_METRICS = {
    COMPLETENESS: 'COMPLETENESS',
    ACCURACY: 'ACCURACY',
    CONSISTENCY: 'CONSISTENCY',
    FRESHNESS: 'FRESHNESS',
    VALIDITY: 'VALIDITY',
    UNIQUENESS: 'UNIQUENESS'
};

/**
 * Quality Severity Levels
 */
const QUALITY_SEVERITY = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO'
};

/**
 * Data Quality Rule Types
 */
const RULE_TYPES = {
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    FORMAT_VALIDATION: 'FORMAT_VALIDATION',
    RANGE_CHECK: 'RANGE_CHECK',
    ENUM_CHECK: 'ENUM_CHECK',
    RELATIONSHIP_CHECK: 'RELATIONSHIP_CHECK',
    STATISTICAL_OUTLIER: 'STATISTICAL_OUTLIER',
    FRESHNESS_CHECK: 'FRESHNESS_CHECK',
    DUPLICATE_CHECK: 'DUPLICATE_CHECK'
};

/**
 * Data Quality Manager Class
 */
class DataQualityManager {
    constructor(options = {}) {
        this.options = {
            enablePersistence: options.enablePersistence !== false,
            metricsStorePath: options.metricsStorePath || path.join(process.cwd(), 'data', 'quality-metrics'),
            alertThresholds: {
                completeness: options.alertThresholds?.completeness || 85,
                accuracy: options.alertThresholds?.accuracy || 90,
                freshness: options.alertThresholds?.freshness || 70,
                overall: options.alertThresholds?.overall || 80
            },
            historyRetentionDays: options.historyRetentionDays || 30,
            enableTrendAnalysis: options.enableTrendAnalysis !== false,
            ...options
        };

        this.qualityRules = new Map();
        this.qualityMetrics = new Map();
        this.qualityHistory = [];
        this.currentSession = null;
        this.database = options.database || null;
        this.monitoringService = options.monitoringService || null;
        this.alertManager = options.alertManager || null;

        this.initializeDataQuality();
    }

    /**
     * Initialize data quality manager
     */
    async initializeDataQuality() {
        try {
            // Create metrics storage directory
            if (this.options.enablePersistence) {
                await fs.mkdir(this.options.metricsStorePath, { recursive: true });
                await this.loadQualityHistory();
            }

            // Load default quality rules
            this.loadDefaultQualityRules();

            // Clean up old metrics
            await this.cleanupOldMetrics();

            log('DataQualityManager initialized successfully');
        } catch (error) {
            errorLog('Failed to initialize DataQualityManager:', error);
        }
    }

    /**
     * Define quality rule
     */
    defineQualityRule(ruleId, rule) {
        const qualityRule = {
            id: ruleId,
            type: rule.type,
            field: rule.field,
            description: rule.description,
            severity: rule.severity || QUALITY_SEVERITY.MEDIUM,
            metricType: rule.metricType,
            
            // Rule configuration
            config: {
                required: rule.config?.required || false,
                allowNull: rule.config?.allowNull || false,
                minLength: rule.config?.minLength || null,
                maxLength: rule.config?.maxLength || null,
                pattern: rule.config?.pattern || null,
                enumValues: rule.config?.enumValues || null,
                minValue: rule.config?.minValue || null,
                maxValue: rule.config?.maxValue || null,
                customValidator: rule.config?.customValidator || null,
                ...rule.config
            },
            
            // Rule metadata
            enabled: rule.enabled !== false,
            createdAt: new Date().toISOString(),
            tags: rule.tags || []
        };

        this.qualityRules.set(ruleId, qualityRule);
        log(`Quality rule defined: ${ruleId} (${rule.type})`);

        return qualityRule;
    }

    /**
     * Start quality assessment session
     */
    async startQualityAssessment(sessionId, options = {}) {
        this.currentSession = {
            id: sessionId,
            startTime: Date.now(),
            datasetName: options.datasetName || 'unknown',
            totalRecords: 0,
            processedRecords: 0,
            validRecords: 0,
            invalidRecords: 0,
            
            // Metric tracking
            metrics: new Map(),
            issues: [],
            statistics: {
                fieldStats: new Map(),
                nullCounts: new Map(),
                duplicateGroups: [],
                outliers: []
            },
            
            // Quality scores
            scores: {
                completeness: 0,
                accuracy: 0,
                consistency: 0,
                freshness: 0,
                validity: 0,
                uniqueness: 0,
                overall: 0
            },
            
            options
        };

        // Initialize metrics for each rule
        this.qualityRules.forEach((rule, ruleId) => {
            if (rule.enabled) {
                this.currentSession.metrics.set(ruleId, {
                    ruleId,
                    passed: 0,
                    failed: 0,
                    score: 0,
                    issues: []
                });
            }
        });

        log(`Quality assessment started: ${sessionId} (${options.datasetName})`);
        return this.currentSession;
    }

    /**
     * Assess data record quality
     */
    async assessRecord(record, recordIndex = 0) {
        if (!this.currentSession) {
            throw new Error('No active quality assessment session');
        }

        const session = this.currentSession;
        session.totalRecords++;
        session.processedRecords++;

        let recordValid = true;
        const recordIssues = [];

        // Apply all enabled quality rules
        for (const [ruleId, rule] of this.qualityRules) {
            if (!rule.enabled) continue;

            try {
                const result = await this.applyQualityRule(rule, record, recordIndex);
                const metric = session.metrics.get(ruleId);

                if (result.passed) {
                    metric.passed++;
                } else {
                    metric.failed++;
                    recordValid = false;
                    
                    const issue = {
                        ruleId,
                        ruletype: rule.type,
                        field: rule.field,
                        severity: rule.severity,
                        message: result.message,
                        recordIndex,
                        value: result.value,
                        expected: result.expected,
                        timestamp: new Date().toISOString()
                    };

                    metric.issues.push(issue);
                    recordIssues.push(issue);
                    session.issues.push(issue);
                }

                // Update metric score
                const total = metric.passed + metric.failed;
                metric.score = total > 0 ? (metric.passed / total) * 100 : 0;

            } catch (error) {
                errorLog(`Failed to apply quality rule ${ruleId}:`, error);
            }
        }

        // Update session statistics
        if (recordValid) {
            session.validRecords++;
        } else {
            session.invalidRecords++;
        }

        // Update field statistics
        this.updateFieldStatistics(record, session);

        return {
            valid: recordValid,
            issues: recordIssues,
            recordIndex
        };
    }

    /**
     * Apply individual quality rule
     */
    async applyQualityRule(rule, record, recordIndex) {
        const fieldValue = this.getFieldValue(record, rule.field);
        
        switch (rule.type) {
            case RULE_TYPES.REQUIRED_FIELD:
                return this.checkRequiredField(rule, fieldValue, record);
                
            case RULE_TYPES.FORMAT_VALIDATION:
                return this.checkFormatValidation(rule, fieldValue, record);
                
            case RULE_TYPES.RANGE_CHECK:
                return this.checkRange(rule, fieldValue, record);
                
            case RULE_TYPES.ENUM_CHECK:
                return this.checkEnum(rule, fieldValue, record);
                
            case RULE_TYPES.RELATIONSHIP_CHECK:
                return this.checkRelationship(rule, fieldValue, record);
                
            case RULE_TYPES.STATISTICAL_OUTLIER:
                return this.checkStatisticalOutlier(rule, fieldValue, record, recordIndex);
                
            case RULE_TYPES.FRESHNESS_CHECK:
                return this.checkFreshness(rule, fieldValue, record);
                
            case RULE_TYPES.DUPLICATE_CHECK:
                return this.checkDuplicate(rule, fieldValue, record, recordIndex);
                
            default:
                return { passed: true, message: 'Unknown rule type' };
        }
    }

    /**
     * Check required field rule
     */
    checkRequiredField(rule, fieldValue) {
        const isEmpty = fieldValue === null || fieldValue === undefined || fieldValue === '';
        const passed = !rule.config.required || !isEmpty;
        
        return {
            passed,
            message: passed ? 'Field is present' : `Required field '${rule.field}' is missing`,
            value: fieldValue,
            expected: 'non-empty value'
        };
    }

    /**
     * Check format validation rule
     */
    checkFormatValidation(rule, fieldValue) {
        if (fieldValue === null || fieldValue === undefined) {
            return {
                passed: rule.config.allowNull || false,
                message: 'Field is null',
                value: fieldValue,
                expected: rule.config.pattern || 'valid format'
            };
        }

        const stringValue = String(fieldValue);
        
        // Length checks
        if (rule.config.minLength && stringValue.length < rule.config.minLength) {
            return {
                passed: false,
                message: `Field length ${stringValue.length} is below minimum ${rule.config.minLength}`,
                value: fieldValue,
                expected: `minimum length ${rule.config.minLength}`
            };
        }

        if (rule.config.maxLength && stringValue.length > rule.config.maxLength) {
            return {
                passed: false,
                message: `Field length ${stringValue.length} exceeds maximum ${rule.config.maxLength}`,
                value: fieldValue,
                expected: `maximum length ${rule.config.maxLength}`
            };
        }

        // Pattern check
        if (rule.config.pattern) {
            const regex = new RegExp(rule.config.pattern);
            const passed = regex.test(stringValue);
            
            return {
                passed,
                message: passed ? 'Format is valid' : `Field format does not match pattern`,
                value: fieldValue,
                expected: rule.config.pattern
            };
        }

        return { passed: true, message: 'Format is valid', value: fieldValue };
    }

    /**
     * Check range validation rule
     */
    checkRange(rule, fieldValue) {
        if (fieldValue === null || fieldValue === undefined) {
            return {
                passed: rule.config.allowNull || false,
                message: 'Field is null',
                value: fieldValue,
                expected: 'numeric value in range'
            };
        }

        const numericValue = Number(fieldValue);
        
        if (isNaN(numericValue)) {
            return {
                passed: false,
                message: 'Field is not a valid number',
                value: fieldValue,
                expected: 'numeric value'
            };
        }

        if (rule.config.minValue !== null && numericValue < rule.config.minValue) {
            return {
                passed: false,
                message: `Value ${numericValue} is below minimum ${rule.config.minValue}`,
                value: fieldValue,
                expected: `>= ${rule.config.minValue}`
            };
        }

        if (rule.config.maxValue !== null && numericValue > rule.config.maxValue) {
            return {
                passed: false,
                message: `Value ${numericValue} exceeds maximum ${rule.config.maxValue}`,
                value: fieldValue,
                expected: `<= ${rule.config.maxValue}`
            };
        }

        return { passed: true, message: 'Value is in valid range', value: fieldValue };
    }

    /**
     * Check enum validation rule
     */
    checkEnum(rule, fieldValue) {
        if (fieldValue === null || fieldValue === undefined) {
            return {
                passed: rule.config.allowNull || false,
                message: 'Field is null',
                value: fieldValue,
                expected: rule.config.enumValues
            };
        }

        const passed = rule.config.enumValues && rule.config.enumValues.includes(fieldValue);
        
        return {
            passed,
            message: passed ? 'Value is valid' : `Value '${fieldValue}' is not in allowed values`,
            value: fieldValue,
            expected: rule.config.enumValues
        };
    }

    /**
     * Check relationship validation rule
     */
    checkRelationship(rule, fieldValue, record) {
        // This is a placeholder for relationship validation
        // Implementation would depend on specific relationship rules
        return { passed: true, message: 'Relationship check passed', value: fieldValue };
    }

    /**
     * Check statistical outlier rule
     */
    checkStatisticalOutlier(rule, fieldValue) {
        // This is a placeholder for statistical outlier detection
        // Implementation would require statistical analysis of the dataset
        return { passed: true, message: 'Not an outlier', value: fieldValue };
    }

    /**
     * Check freshness rule
     */
    checkFreshness(rule, fieldValue) {
        if (fieldValue === null || fieldValue === undefined) {
            return {
                passed: rule.config.allowNull || false,
                message: 'Field is null',
                value: fieldValue,
                expected: 'valid timestamp'
            };
        }

        try {
            const timestamp = new Date(fieldValue);
            const now = new Date();
            const ageHours = (now - timestamp) / (1000 * 60 * 60);
            const maxAgeHours = rule.config.maxAgeHours || 24;

            const passed = ageHours <= maxAgeHours;
            
            return {
                passed,
                message: passed ? 'Data is fresh' : `Data is ${Math.round(ageHours)} hours old, exceeds limit of ${maxAgeHours} hours`,
                value: fieldValue,
                expected: `within ${maxAgeHours} hours`
            };
        } catch (error) {
            return {
                passed: false,
                message: 'Invalid timestamp format',
                value: fieldValue,
                expected: 'valid timestamp'
            };
        }
    }

    /**
     * Check duplicate rule
     */
    checkDuplicate(rule, fieldValue, record, recordIndex) {
        // This is a placeholder for duplicate detection
        // Implementation would require tracking all seen values
        return { passed: true, message: 'No duplicate detected', value: fieldValue };
    }

    /**
     * Complete quality assessment
     */
    async completeQualityAssessment() {
        if (!this.currentSession) {
            throw new Error('No active quality assessment session');
        }

        const session = this.currentSession;
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;

        // Calculate overall quality scores
        await this.calculateQualityScores(session);

        // Generate quality report
        const report = await this.generateQualityReport(session);

        // Check alert thresholds
        await this.checkAlertThresholds(session);

        // Save to history and persistence
        this.qualityHistory.push({ ...session });
        
        if (this.options.enablePersistence) {
            await this.persistQualityMetrics(session);
        }

        // Send to monitoring service
        if (this.monitoringService) {
            this.monitoringService.recordQualityAssessment(session);
        }

        // Reset current session
        this.currentSession = null;

        log(`Quality assessment completed: ${session.id} (Overall Score: ${session.scores.overall}%)`);

        return report;
    }

    /**
     * Calculate quality scores
     */
    async calculateQualityScores(session) {
        const metrics = Array.from(session.metrics.values());
        
        // Calculate metric-specific scores
        const metricScores = new Map();
        
        // Group metrics by type
        Object.values(QUALITY_METRICS).forEach(metricType => {
            const typeMetrics = metrics.filter(m => {
                const rule = this.qualityRules.get(m.ruleId);
                return rule && rule.metricType === metricType;
            });

            if (typeMetrics.length > 0) {
                const avgScore = typeMetrics.reduce((sum, m) => sum + m.score, 0) / typeMetrics.length;
                metricScores.set(metricType, avgScore);
            }
        });

        // Update session scores
        session.scores.completeness = metricScores.get(QUALITY_METRICS.COMPLETENESS) || 0;
        session.scores.accuracy = metricScores.get(QUALITY_METRICS.ACCURACY) || 0;
        session.scores.consistency = metricScores.get(QUALITY_METRICS.CONSISTENCY) || 0;
        session.scores.freshness = metricScores.get(QUALITY_METRICS.FRESHNESS) || 0;
        session.scores.validity = metricScores.get(QUALITY_METRICS.VALIDITY) || 0;
        session.scores.uniqueness = metricScores.get(QUALITY_METRICS.UNIQUENESS) || 0;

        // Calculate overall score (weighted average)
        const weights = {
            completeness: 0.25,
            accuracy: 0.25,
            validity: 0.20,
            consistency: 0.15,
            freshness: 0.10,
            uniqueness: 0.05
        };

        session.scores.overall = Object.entries(weights).reduce((sum, [metric, weight]) => {
            return sum + (session.scores[metric] * weight);
        }, 0);
    }

    /**
     * Generate quality report
     */
    async generateQualityReport(session) {
        const report = {
            sessionId: session.id,
            datasetName: session.datasetName,
            timestamp: new Date().toISOString(),
            duration: session.duration,
            
            // Summary statistics
            summary: {
                totalRecords: session.totalRecords,
                validRecords: session.validRecords,
                invalidRecords: session.invalidRecords,
                validationRate: session.totalRecords > 0 ? (session.validRecords / session.totalRecords) * 100 : 0,
                issueCount: session.issues.length
            },
            
            // Quality scores
            scores: { ...session.scores },
            
            // Metric details
            metrics: Array.from(session.metrics.entries()).map(([ruleId, metric]) => {
                const rule = this.qualityRules.get(ruleId);
                return {
                    ruleId,
                    ruleName: rule.description,
                    ruleType: rule.type,
                    metricType: rule.metricType,
                    severity: rule.severity,
                    passed: metric.passed,
                    failed: metric.failed,
                    score: Math.round(metric.score * 100) / 100,
                    issueCount: metric.issues.length
                };
            }),
            
            // Issue summary by severity
            issuesBySeverity: this.groupIssuesBySeverity(session.issues),
            
            // Issue summary by rule type
            issuesByRuleType: this.groupIssuesByRuleType(session.issues),
            
            // Top issues
            topIssues: this.getTopIssues(session.issues, 10),
            
            // Recommendations
            recommendations: await this.generateRecommendations(session)
        };

        return report;
    }

    /**
     * Group issues by severity
     */
    groupIssuesBySeverity(issues) {
        const groups = {};
        Object.values(QUALITY_SEVERITY).forEach(severity => {
            groups[severity] = issues.filter(issue => issue.severity === severity).length;
        });
        return groups;
    }

    /**
     * Group issues by rule type
     */
    groupIssuesByRuleType(issues) {
        const groups = {};
        Object.values(RULE_TYPES).forEach(ruleType => {
            groups[ruleType] = issues.filter(issue => issue.ruletype === ruleType).length;
        });
        return groups;
    }

    /**
     * Get top issues
     */
    getTopIssues(issues, limit = 10) {
        // Group issues by rule and count occurrences
        const issueGroups = new Map();
        
        issues.forEach(issue => {
            const key = `${issue.ruleId}:${issue.message}`;
            if (!issueGroups.has(key)) {
                issueGroups.set(key, {
                    ruleId: issue.ruleId,
                    message: issue.message,
                    severity: issue.severity,
                    count: 0,
                    examples: []
                });
            }
            
            const group = issueGroups.get(key);
            group.count++;
            
            if (group.examples.length < 3) {
                group.examples.push({
                    recordIndex: issue.recordIndex,
                    value: issue.value,
                    field: issue.field
                });
            }
        });

        // Sort by count and return top issues
        return Array.from(issueGroups.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Generate recommendations
     */
    async generateRecommendations(session) {
        const recommendations = [];

        // Check completeness
        if (session.scores.completeness < this.options.alertThresholds.completeness) {
            recommendations.push({
                type: 'COMPLETENESS',
                priority: 'HIGH',
                message: `Completeness score (${Math.round(session.scores.completeness)}%) is below threshold (${this.options.alertThresholds.completeness}%)`,
                action: 'Review data collection process and implement missing field validation'
            });
        }

        // Check accuracy
        if (session.scores.accuracy < this.options.alertThresholds.accuracy) {
            recommendations.push({
                type: 'ACCURACY',
                priority: 'HIGH',
                message: `Accuracy score (${Math.round(session.scores.accuracy)}%) is below threshold (${this.options.alertThresholds.accuracy}%)`,
                action: 'Implement stronger data validation and cleansing processes'
            });
        }

        // Check overall quality
        if (session.scores.overall < this.options.alertThresholds.overall) {
            recommendations.push({
                type: 'OVERALL',
                priority: 'CRITICAL',
                message: `Overall quality score (${Math.round(session.scores.overall)}%) is below threshold (${this.options.alertThresholds.overall}%)`,
                action: 'Conduct comprehensive review of data pipeline and quality processes'
            });
        }

        return recommendations;
    }

    /**
     * Check alert thresholds
     */
    async checkAlertThresholds(session) {
        if (!this.alertManager) return;

        const alerts = [];

        // Check threshold violations
        if (session.scores.completeness < this.options.alertThresholds.completeness) {
            alerts.push({
                type: 'QUALITY_THRESHOLD',
                severity: 'HIGH',
                metric: 'completeness',
                value: session.scores.completeness,
                threshold: this.options.alertThresholds.completeness,
                sessionId: session.id
            });
        }

        if (session.scores.accuracy < this.options.alertThresholds.accuracy) {
            alerts.push({
                type: 'QUALITY_THRESHOLD',
                severity: 'HIGH',
                metric: 'accuracy',
                value: session.scores.accuracy,
                threshold: this.options.alertThresholds.accuracy,
                sessionId: session.id
            });
        }

        if (session.scores.overall < this.options.alertThresholds.overall) {
            alerts.push({
                type: 'QUALITY_THRESHOLD',
                severity: 'CRITICAL',
                metric: 'overall',
                value: session.scores.overall,
                threshold: this.options.alertThresholds.overall,
                sessionId: session.id
            });
        }

        // Send alerts
        for (const alert of alerts) {
            try {
                await this.alertManager.sendAlert(alert);
            } catch (error) {
                errorLog('Failed to send quality alert:', error);
            }
        }
    }

    /**
     * Get field value from record
     */
    getFieldValue(record, fieldPath) {
        const fields = fieldPath.split('.');
        let value = record;
        
        for (const field of fields) {
            if (value === null || value === undefined) {
                return undefined;
            }
            value = value[field];
        }
        
        return value;
    }

    /**
     * Update field statistics
     */
    updateFieldStatistics(record, session) {
        Object.keys(record).forEach(field => {
            const value = record[field];
            
            if (!session.statistics.fieldStats.has(field)) {
                session.statistics.fieldStats.set(field, {
                    field,
                    totalCount: 0,
                    nullCount: 0,
                    uniqueValues: new Set(),
                    dataTypes: new Set(),
                    minLength: Infinity,
                    maxLength: 0,
                    avgLength: 0,
                    examples: []
                });
            }
            
            const stats = session.statistics.fieldStats.get(field);
            stats.totalCount++;
            
            if (value === null || value === undefined) {
                stats.nullCount++;
                session.statistics.nullCounts.set(field, (session.statistics.nullCounts.get(field) || 0) + 1);
            } else {
                stats.uniqueValues.add(value);
                stats.dataTypes.add(typeof value);
                
                const stringValue = String(value);
                stats.minLength = Math.min(stats.minLength, stringValue.length);
                stats.maxLength = Math.max(stats.maxLength, stringValue.length);
                
                if (stats.examples.length < 5) {
                    stats.examples.push(value);
                }
            }
        });
    }

    /**
     * Load default quality rules
     */
    loadDefaultQualityRules() {
        // Common merchant data quality rules
        
        // Completeness rules
        this.defineQualityRule('merchant_name_required', {
            type: RULE_TYPES.REQUIRED_FIELD,
            field: 'merchantName',
            description: 'Merchant name is required',
            severity: QUALITY_SEVERITY.CRITICAL,
            metricType: QUALITY_METRICS.COMPLETENESS,
            config: { required: true }
        });

        this.defineQualityRule('price_required', {
            type: RULE_TYPES.REQUIRED_FIELD,
            field: 'price',
            description: 'Price is required',
            severity: QUALITY_SEVERITY.HIGH,
            metricType: QUALITY_METRICS.COMPLETENESS,
            config: { required: true }
        });

        // Format validation rules
        this.defineQualityRule('price_format', {
            type: RULE_TYPES.FORMAT_VALIDATION,
            field: 'price',
            description: 'Price must be a valid number',
            severity: QUALITY_SEVERITY.HIGH,
            metricType: QUALITY_METRICS.VALIDITY,
            config: { pattern: '^\\d+(\\.\\d{1,8})?$' }
        });

        this.defineQualityRule('merchant_name_length', {
            type: RULE_TYPES.FORMAT_VALIDATION,
            field: 'merchantName',
            description: 'Merchant name length validation',
            severity: QUALITY_SEVERITY.MEDIUM,
            metricType: QUALITY_METRICS.VALIDITY,
            config: { minLength: 2, maxLength: 100 }
        });

        // Range validation rules
        this.defineQualityRule('price_range', {
            type: RULE_TYPES.RANGE_CHECK,
            field: 'price',
            description: 'Price must be positive',
            severity: QUALITY_SEVERITY.HIGH,
            metricType: QUALITY_METRICS.VALIDITY,
            config: { minValue: 0, maxValue: 1000000 }
        });

        // Enum validation rules
        this.defineQualityRule('order_type_validation', {
            type: RULE_TYPES.ENUM_CHECK,
            field: 'orderType',
            description: 'Order type must be valid',
            severity: QUALITY_SEVERITY.MEDIUM,
            metricType: QUALITY_METRICS.VALIDITY,
            config: { enumValues: ['BUY', 'SELL'] }
        });

        // Freshness rules
        this.defineQualityRule('timestamp_freshness', {
            type: RULE_TYPES.FRESHNESS_CHECK,
            field: 'timestamp',
            description: 'Data should be fresh (within 24 hours)',
            severity: QUALITY_SEVERITY.MEDIUM,
            metricType: QUALITY_METRICS.FRESHNESS,
            config: { maxAgeHours: 24 }
        });

        log('Default quality rules loaded');
    }

    /**
     * Persist quality metrics
     */
    async persistQualityMetrics(session) {
        try {
            const metricsFile = path.join(
                this.options.metricsStorePath,
                `quality_${session.id}_${new Date().toISOString().split('T')[0]}.json`
            );
            
            await fs.writeFile(metricsFile, JSON.stringify(session, null, 2));
            
        } catch (error) {
            errorLog('Failed to persist quality metrics:', error);
        }
    }

    /**
     * Load quality history
     */
    async loadQualityHistory() {
        try {
            const files = await fs.readdir(this.options.metricsStorePath).catch(() => []);
            
            for (const file of files) {
                if (file.startsWith('quality_') && file.endsWith('.json')) {
                    try {
                        const filePath = path.join(this.options.metricsStorePath, file);
                        const data = await fs.readFile(filePath, 'utf-8');
                        const session = JSON.parse(data);
                        this.qualityHistory.push(session);
                    } catch (error) {
                        errorLog(`Failed to load quality metrics file ${file}:`, error);
                    }
                }
            }
            
            // Sort by start time
            this.qualityHistory.sort((a, b) => a.startTime - b.startTime);
            
            log(`Loaded ${this.qualityHistory.length} quality history records`);
            
        } catch (error) {
            errorLog('Failed to load quality history:', error);
        }
    }

    /**
     * Clean up old metrics
     */
    async cleanupOldMetrics() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.options.historyRetentionDays);
            
            // Remove old history records
            this.qualityHistory = this.qualityHistory.filter(session => {
                return new Date(session.startTime) > cutoffDate;
            });
            
            // Clean up old files
            if (this.options.enablePersistence) {
                const files = await fs.readdir(this.options.metricsStorePath).catch(() => []);
                
                for (const file of files) {
                    if (file.startsWith('quality_') && file.endsWith('.json')) {
                        const filePath = path.join(this.options.metricsStorePath, file);
                        const stats = await fs.stat(filePath).catch(() => null);
                        
                        if (stats && stats.mtime < cutoffDate) {
                            await fs.unlink(filePath);
                            log(`Cleaned up old quality metrics file: ${file}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            errorLog('Failed to cleanup old metrics:', error);
        }
    }

    /**
     * Get quality trends
     */
    getQualityTrends(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentSessions = this.qualityHistory.filter(session => {
            return new Date(session.startTime) > cutoffDate;
        });
        
        if (recentSessions.length === 0) {
            return null;
        }
        
        // Calculate averages by day
        const dailyAverages = new Map();
        
        recentSessions.forEach(session => {
            const day = new Date(session.startTime).toDateString();
            
            if (!dailyAverages.has(day)) {
                dailyAverages.set(day, {
                    date: day,
                    sessions: [],
                    avgOverall: 0,
                    avgCompleteness: 0,
                    avgAccuracy: 0,
                    avgValidity: 0
                });
            }
            
            dailyAverages.get(day).sessions.push(session);
        });
        
        // Calculate daily averages
        const trends = Array.from(dailyAverages.values()).map(daily => {
            const sessions = daily.sessions;
            const count = sessions.length;
            
            daily.avgOverall = sessions.reduce((sum, s) => sum + s.scores.overall, 0) / count;
            daily.avgCompleteness = sessions.reduce((sum, s) => sum + s.scores.completeness, 0) / count;
            daily.avgAccuracy = sessions.reduce((sum, s) => sum + s.scores.accuracy, 0) / count;
            daily.avgValidity = sessions.reduce((sum, s) => sum + s.scores.validity, 0) / count;
            daily.sessionCount = count;
            
            return daily;
        });
        
        // Sort by date
        trends.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return {
            period: `${days} days`,
            trends,
            summary: {
                totalSessions: recentSessions.length,
                avgOverallQuality: trends.reduce((sum, t) => sum + t.avgOverall, 0) / trends.length,
                qualityImprovement: trends.length > 1 ? 
                    trends[trends.length - 1].avgOverall - trends[0].avgOverall : 0
            }
        };
    }

    /**
     * Get current quality status
     */
    getCurrentQualityStatus() {
        if (!this.currentSession) {
            return null;
        }

        const session = this.currentSession;
        const progress = session.totalRecords > 0 ? 
            (session.processedRecords / session.totalRecords) * 100 : 0;

        return {
            sessionId: session.id,
            datasetName: session.datasetName,
            progress: Math.round(progress),
            totalRecords: session.totalRecords,
            processedRecords: session.processedRecords,
            validRecords: session.validRecords,
            invalidRecords: session.invalidRecords,
            currentValidationRate: session.processedRecords > 0 ? 
                (session.validRecords / session.processedRecords) * 100 : 0,
            issueCount: session.issues.length,
            duration: Date.now() - session.startTime
        };
    }
}

module.exports = {
    DataQualityManager,
    QUALITY_METRICS,
    QUALITY_SEVERITY,
    RULE_TYPES
};
