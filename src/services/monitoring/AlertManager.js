// src/services/monitoring/AlertManager.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Alert Management Service
 * Handles alerting rules, notifications, and escalations
 */
class AlertManager {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled || true,
            cooldownPeriod: config.cooldownPeriod || 300000, // 5 minutes
            maxAlertsPerHour: config.maxAlertsPerHour || 10,
            email: config.email || {},
            webhook: config.webhook || {},
            slack: config.slack || {},
            ...config
        };
        
        this.rules = new Map();
        this.alertHistory = [];
        this.activeCooldowns = new Map();
        this.rateLimits = new Map();
        this.channels = new Map();
        this.emailTransporter = null;
        
        // Initialize notification channels
        this.initializeChannels();
        
        // Register built-in alert rules
        this.registerBuiltInRules();
    }

    /**
     * Initialize notification channels
     */
    initializeChannels() {
        // Email channel
        if (this.config.email.enabled) {
            this.initializeEmailChannel();
        }
        
        // Webhook channel
        if (this.config.webhook.enabled) {
            this.initializeWebhookChannel();
        }
        
        // Slack channel
        if (this.config.slack.enabled) {
            this.initializeSlackChannel();
        }
        
        console.log(`✅ AlertManager initialized with ${this.channels.size} channels`);
    }

    /**
     * Initialize email notification channel
     */
    initializeEmailChannel() {
        try {
            this.emailTransporter = nodemailer.createTransporter({
                host: this.config.email.smtp.host,
                port: this.config.email.smtp.port,
                secure: this.config.email.smtp.secure || false,
                auth: {
                    user: this.config.email.smtp.user,
                    pass: this.config.email.smtp.pass
                }
            });
            
            this.channels.set('email', {
                type: 'email',
                enabled: true,
                send: this.sendEmailAlert.bind(this)
            });
            
            console.log('✅ Email notification channel initialized');
        } catch (error) {
            console.error('❌ Failed to initialize email channel:', error.message);
        }
    }

    /**
     * Initialize webhook notification channel
     */
    initializeWebhookChannel() {
        this.channels.set('webhook', {
            type: 'webhook',
            enabled: true,
            send: this.sendWebhookAlert.bind(this)
        });
        
        console.log('✅ Webhook notification channel initialized');
    }

    /**
     * Initialize Slack notification channel
     */
    initializeSlackChannel() {
        this.channels.set('slack', {
            type: 'slack',
            enabled: true,
            send: this.sendSlackAlert.bind(this)
        });
        
        console.log('✅ Slack notification channel initialized');
    }

    /**
     * Register built-in alert rules
     */
    registerBuiltInRules() {
        // System resource alerts
        this.registerRule('high_memory_usage', {
            condition: (metrics) => {
                const memUsage = metrics.gauges['system.memory.usage'];
                return memUsage > 85;
            },
            severity: 'warning',
            message: (metrics) => `High memory usage: ${metrics.gauges['system.memory.usage']}%`,
            channels: ['email', 'slack'],
            cooldown: 600000 // 10 minutes
        });

        this.registerRule('critical_memory_usage', {
            condition: (metrics) => {
                const memUsage = metrics.gauges['system.memory.usage'];
                return memUsage > 95;
            },
            severity: 'critical',
            message: (metrics) => `Critical memory usage: ${metrics.gauges['system.memory.usage']}%`,
            channels: ['email', 'webhook', 'slack'],
            cooldown: 300000 // 5 minutes
        });

        this.registerRule('high_cpu_usage', {
            condition: (metrics) => {
                const cpuUsage = metrics.gauges['system.cpu.usage'];
                return cpuUsage > 80;
            },
            severity: 'warning',
            message: (metrics) => `High CPU usage: ${metrics.gauges['system.cpu.usage'].toFixed(1)}%`,
            channels: ['email'],
            cooldown: 900000 // 15 minutes
        });

        // Application alerts
        this.registerRule('scraper_failures', {
            condition: (metrics) => {
                const total = metrics.counters['scraper.runs.total'] || 0;
                const failed = metrics.counters['scraper.runs.failed'] || 0;
                if (total < 5) return false; // Need at least 5 runs
                return (failed / total) > 0.5; // More than 50% failure rate
            },
            severity: 'error',
            message: (metrics) => {
                const total = metrics.counters['scraper.runs.total'];
                const failed = metrics.counters['scraper.runs.failed'];
                const rate = ((failed / total) * 100).toFixed(1);
                return `High scraper failure rate: ${rate}% (${failed}/${total})`;
            },
            channels: ['email', 'slack'],
            cooldown: 1800000 // 30 minutes
        });

        this.registerRule('browser_crashes', {
            condition: (metrics) => {
                const crashes = metrics.counters['browser.crashes.count'] || 0;
                return crashes > 3; // More than 3 crashes
            },
            severity: 'error',
            message: (metrics) => `Multiple browser crashes detected: ${metrics.counters['browser.crashes.count']}`,
            channels: ['email', 'webhook'],
            cooldown: 600000 // 10 minutes
        });

        this.registerRule('database_errors', {
            condition: (metrics) => {
                const total = metrics.counters['database.queries.total'] || 0;
                const failed = metrics.counters['database.queries.failed'] || 0;
                if (total < 10) return false; // Need at least 10 queries
                return (failed / total) > 0.2; // More than 20% failure rate
            },
            severity: 'error',
            message: (metrics) => {
                const total = metrics.counters['database.queries.total'];
                const failed = metrics.counters['database.queries.failed'];
                const rate = ((failed / total) * 100).toFixed(1);
                return `High database error rate: ${rate}% (${failed}/${total})`;
            },
            channels: ['email', 'webhook'],
            cooldown: 600000 // 10 minutes
        });

        // Health check alerts
        this.registerRule('health_check_critical', {
            condition: (metrics, healthStatus) => {
                return healthStatus && healthStatus.overall === 'critical';
            },
            severity: 'critical',
            message: (metrics, healthStatus) => {
                const issues = healthStatus.criticalIssues || 0;
                return `Critical health issues detected: ${issues} critical failures`;
            },
            channels: ['email', 'webhook', 'slack'],
            cooldown: 300000 // 5 minutes
        });

        this.registerRule('circuit_breaker_open', {
            condition: (metrics) => {
                const opens = metrics.counters['circuitBreaker.opens.count'] || 0;
                return opens > 2; // More than 2 circuit breaker opens
            },
            severity: 'warning',
            message: (metrics) => `Circuit breaker opened multiple times: ${metrics.counters['circuitBreaker.opens.count']}`,
            channels: ['email'],
            cooldown: 1800000 // 30 minutes
        });

        console.log(`✅ Registered ${this.rules.size} built-in alert rules`);
    }

    /**
     * Register a custom alert rule
     */
    registerRule(name, rule) {
        this.rules.set(name, {
            name,
            condition: rule.condition,
            severity: rule.severity || 'info',
            message: rule.message,
            channels: rule.channels || ['email'],
            cooldown: rule.cooldown || this.config.cooldownPeriod,
            enabled: rule.enabled !== false,
            ...rule
        });
    }

    /**
     * Evaluate all alert rules against current metrics
     */
    async evaluateRules(metrics, healthStatus = null) {
        if (!this.config.enabled) {
            return;
        }

        const triggeredAlerts = [];
        
        for (const [name, rule] of this.rules) {
            if (!rule.enabled) {
                continue;
            }
            
            try {
                // Check if rule is in cooldown
                if (this.isInCooldown(name)) {
                    continue;
                }
                
                // Evaluate rule condition
                const triggered = rule.condition(metrics, healthStatus);
                
                if (triggered) {
                    const alert = await this.createAlert(rule, metrics, healthStatus);
                    triggeredAlerts.push(alert);
                    
                    // Send alert through configured channels
                    await this.sendAlert(alert);
                    
                    // Start cooldown period
                    this.startCooldown(name, rule.cooldown);
                }
                
            } catch (error) {
                console.error(`Error evaluating alert rule ${name}:`, error.message);
            }
        }
        
        return triggeredAlerts;
    }

    /**
     * Create alert object
     */
    async createAlert(rule, metrics, healthStatus) {
        const alert = {
            id: this.generateAlertId(),
            rule: rule.name,
            severity: rule.severity,
            message: typeof rule.message === 'function' 
                ? rule.message(metrics, healthStatus) 
                : rule.message,
            timestamp: Date.now(),
            metrics: this.extractRelevantMetrics(metrics, rule),
            healthStatus,
            channels: rule.channels,
            metadata: {
                hostname: require('os').hostname(),
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || 'unknown'
            }
        };
        
        // Add to history
        this.alertHistory.push(alert);
        
        // Limit history size
        if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(-500);
        }
        
        return alert;
    }

    /**
     * Send alert through configured channels
     */
    async sendAlert(alert) {
        const sendPromises = [];
        
        for (const channelName of alert.channels) {
            const channel = this.channels.get(channelName);
            
            if (channel && channel.enabled) {
                // Check rate limiting
                if (this.isRateLimited(channelName)) {
                    console.warn(`⚠️ Rate limited: ${channelName}`);
                    continue;
                }
                
                sendPromises.push(
                    channel.send(alert).catch(error => {
                        console.error(`❌ Failed to send alert via ${channelName}:`, error.message);
                        return { channel: channelName, error: error.message };
                    })
                );
                
                // Update rate limiting
                this.updateRateLimit(channelName);
            }
        }
        
        const results = await Promise.allSettled(sendPromises);
        
        // Log results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`📧 Alert sent: ${alert.rule} (${successful} successful, ${failed} failed)`);
        
        return results;
    }

    /**
     * Send email alert
     */
    async sendEmailAlert(alert) {
        if (!this.emailTransporter) {
            throw new Error('Email transporter not initialized');
        }
        
        const subject = `[${alert.severity.toUpperCase()}] ${alert.rule} - Gate.io Scraper`;
        const html = this.generateEmailHTML(alert);
        
        const mailOptions = {
            from: this.config.email.from,
            to: this.config.email.to,
            subject,
            html,
            text: this.generateEmailText(alert)
        };
        
        await this.emailTransporter.sendMail(mailOptions);
    }

    /**
     * Send webhook alert
     */
    async sendWebhookAlert(alert) {
        // This would require adding an HTTP client
        // For now, just log the webhook payload
        const payload = {
            alert,
            webhook_url: this.config.webhook.url
        };
        
        console.log('📡 Webhook alert payload:', JSON.stringify(payload, null, 2));
        
        // In a real implementation, you would POST this to the webhook URL
        return { status: 'simulated', payload };
    }

    /**
     * Send Slack alert
     */
    async sendSlackAlert(alert) {
        // This would require Slack SDK or webhook integration
        // For now, format as Slack message
        const slackMessage = {
            text: `*${alert.severity.toUpperCase()} Alert*`,
            attachments: [{
                color: this.getSeverityColor(alert.severity),
                fields: [
                    { title: 'Rule', value: alert.rule, short: true },
                    { title: 'Severity', value: alert.severity, short: true },
                    { title: 'Message', value: alert.message, short: false },
                    { title: 'Timestamp', value: new Date(alert.timestamp).toISOString(), short: true }
                ]
            }]
        };
        
        console.log('💬 Slack alert message:', JSON.stringify(slackMessage, null, 2));
        
        return { status: 'simulated', message: slackMessage };
    }

    /**
     * Generate email HTML content
     */
    generateEmailHTML(alert) {
        return `
        <html>
        <body>
            <h2 style="color: ${this.getSeverityColor(alert.severity)};">
                ${alert.severity.toUpperCase()} Alert: ${alert.rule}
            </h2>
            
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toISOString()}</p>
            <p><strong>Hostname:</strong> ${alert.metadata.hostname}</p>
            <p><strong>Environment:</strong> ${alert.metadata.environment}</p>
            
            <h3>Relevant Metrics:</h3>
            <ul>
                ${Object.entries(alert.metrics).map(([key, value]) => 
                    `<li><strong>${key}:</strong> ${value}</li>`
                ).join('')}
            </ul>
            
            <hr>
            <p><em>Sent by Gate.io P2P Scraper Monitoring System</em></p>
        </body>
        </html>
        `;
    }

    /**
     * Generate email text content
     */
    generateEmailText(alert) {
        return `
${alert.severity.toUpperCase()} Alert: ${alert.rule}

Message: ${alert.message}
Timestamp: ${new Date(alert.timestamp).toISOString()}
Hostname: ${alert.metadata.hostname}
Environment: ${alert.metadata.environment}

Relevant Metrics:
${Object.entries(alert.metrics).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

---
Sent by Gate.io P2P Scraper Monitoring System
        `;
    }

    /**
     * Get severity color for UI
     */
    getSeverityColor(severity) {
        const colors = {
            critical: '#ff0000',
            error: '#ff6600',
            warning: '#ffcc00',
            info: '#0099cc'
        };
        return colors[severity] || '#666666';
    }

    /**
     * Extract relevant metrics for alert
     */
    extractRelevantMetrics(metrics, rule) {
        // Extract a subset of metrics relevant to the alert
        const relevant = {};
        
        // Always include overall stats
        relevant.timestamp = metrics.timestamp;
        relevant.uptime = metrics.uptime;
        
        // Include metrics mentioned in rule name or related to the alert type
        const ruleName = rule.name.toLowerCase();
        
        if (ruleName.includes('memory')) {
            relevant['system.memory.usage'] = metrics.gauges['system.memory.usage'];
            relevant['process.memory.rss'] = metrics.gauges['process.memory.rss'];
        }
        
        if (ruleName.includes('cpu')) {
            relevant['system.cpu.usage'] = metrics.gauges['system.cpu.usage'];
            relevant['system.loadavg.1m'] = metrics.gauges['system.loadavg.1m'];
        }
        
        if (ruleName.includes('scraper')) {
            relevant['scraper.runs.total'] = metrics.counters['scraper.runs.total'];
            relevant['scraper.runs.success'] = metrics.counters['scraper.runs.success'];
            relevant['scraper.runs.failed'] = metrics.counters['scraper.runs.failed'];
        }
        
        if (ruleName.includes('browser')) {
            relevant['browser.crashes.count'] = metrics.counters['browser.crashes.count'];
            relevant['browser.timeouts.count'] = metrics.counters['browser.timeouts.count'];
        }
        
        if (ruleName.includes('database')) {
            relevant['database.queries.total'] = metrics.counters['database.queries.total'];
            relevant['database.queries.success'] = metrics.counters['database.queries.success'];
            relevant['database.queries.failed'] = metrics.counters['database.queries.failed'];
        }
        
        return relevant;
    }

    /**
     * Check if alert rule is in cooldown
     */
    isInCooldown(ruleName) {
        const cooldownEnd = this.activeCooldowns.get(ruleName);
        return cooldownEnd && Date.now() < cooldownEnd;
    }

    /**
     * Start cooldown period for a rule
     */
    startCooldown(ruleName, duration) {
        this.activeCooldowns.set(ruleName, Date.now() + duration);
    }

    /**
     * Check if channel is rate limited
     */
    isRateLimited(channelName) {
        const now = Date.now();
        const hourAgo = now - 3600000; // 1 hour
        
        if (!this.rateLimits.has(channelName)) {
            this.rateLimits.set(channelName, []);
        }
        
        const timestamps = this.rateLimits.get(channelName);
        
        // Clean old timestamps
        const recentTimestamps = timestamps.filter(ts => ts > hourAgo);
        this.rateLimits.set(channelName, recentTimestamps);
        
        return recentTimestamps.length >= this.config.maxAlertsPerHour;
    }

    /**
     * Update rate limiting for channel
     */
    updateRateLimit(channelName) {
        if (!this.rateLimits.has(channelName)) {
            this.rateLimits.set(channelName, []);
        }
        
        this.rateLimits.get(channelName).push(Date.now());
    }

    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit = 50) {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Get active cooldowns
     */
    getActiveCooldowns() {
        const now = Date.now();
        const active = {};
        
        for (const [rule, endTime] of this.activeCooldowns) {
            if (endTime > now) {
                active[rule] = {
                    endTime,
                    remainingMs: endTime - now
                };
            }
        }
        
        return active;
    }

    /**
     * Get alert statistics
     */
    getStatistics() {
        const now = Date.now();
        const hourAgo = now - 3600000;
        const dayAgo = now - 86400000;
        
        const recentAlerts = this.alertHistory.filter(a => a.timestamp > hourAgo);
        const dailyAlerts = this.alertHistory.filter(a => a.timestamp > dayAgo);
        
        const stats = {
            total: this.alertHistory.length,
            lastHour: recentAlerts.length,
            last24Hours: dailyAlerts.length,
            bySeverity: {},
            byRule: {},
            channels: {
                enabled: Array.from(this.channels.keys()).filter(name => 
                    this.channels.get(name).enabled
                ),
                rateLimited: Object.keys(this.rateLimits).filter(name => 
                    this.isRateLimited(name)
                )
            }
        };
        
        // Count by severity
        for (const alert of this.alertHistory) {
            stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
            stats.byRule[alert.rule] = (stats.byRule[alert.rule] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            rules: {
                total: this.rules.size,
                enabled: Array.from(this.rules.values()).filter(r => r.enabled).length
            },
            channels: {
                total: this.channels.size,
                enabled: Array.from(this.channels.values()).filter(c => c.enabled).length
            },
            cooldowns: Object.keys(this.getActiveCooldowns()).length,
            alertHistory: this.alertHistory.length
        };
    }
}

module.exports = AlertManager;
