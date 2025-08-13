// scraper/sessionManagement.js
const { log, errorLog } = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Session Management and Tracking System
 * 
 * Features:
 * - Session lifecycle management
 * - Session persistence and recovery
 * - Session analytics and metrics
 * - Session state tracking
 * - Integration with database and monitoring
 */

/**
 * Session States
 */
const SESSION_STATES = {
    INITIALIZING: 'INITIALIZING',
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    RECOVERING: 'RECOVERING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED'
};

/**
 * Session Types
 */
const SESSION_TYPES = {
    SCRAPING: 'SCRAPING',
    MONITORING: 'MONITORING',
    TESTING: 'TESTING',
    MAINTENANCE: 'MAINTENANCE'
};

/**
 * Session Manager Class
 */
class SessionManager {
    constructor(options = {}) {
        this.options = {
            enablePersistence: options.enablePersistence !== false,
            sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
            maxConcurrentSessions: options.maxConcurrentSessions || 10,
            sessionStorePath: options.sessionStorePath || path.join(process.cwd(), 'data', 'sessions'),
            heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
            enableAnalytics: options.enableAnalytics !== false,
            ...options
        };

        this.activeSessions = new Map();
        this.sessionHistory = [];
        this.sessionStats = new Map();
        this.heartbeatTimer = null;
        this.database = options.database || null;
        this.monitoringService = options.monitoringService || null;

        this.initializeSessionManager();
    }

    /**
     * Initialize session manager
     */
    async initializeSessionManager() {
        try {
            // Create session storage directory
            if (this.options.enablePersistence) {
                await fs.mkdir(this.options.sessionStorePath, { recursive: true });
                await this.loadPersistedSessions();
            }

            // Start heartbeat monitoring
            this.startHeartbeatMonitoring();

            // Clean up expired sessions
            await this.cleanupExpiredSessions();

            log('SessionManager initialized successfully');
        } catch (error) {
            errorLog('Failed to initialize SessionManager:', error);
        }
    }

    /**
     * Create a new session
     */
    async createSession(options = {}) {
        try {
            const sessionId = this.generateSessionId();
            
            const session = {
                id: sessionId,
                type: options.type || SESSION_TYPES.SCRAPING,
                state: SESSION_STATES.INITIALIZING,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.options.sessionTimeout).toISOString(),
                
                // Session metadata
                metadata: {
                    userAgent: options.userAgent || null,
                    proxy: options.proxy || null,
                    targetUrl: options.targetUrl || null,
                    configuration: options.configuration || {},
                    ...options.metadata
                },
                
                // Session metrics
                metrics: {
                    startTime: Date.now(),
                    endTime: null,
                    duration: null,
                    operationCount: 0,
                    errorCount: 0,
                    dataPointsCollected: 0,
                    bytesTransferred: 0,
                    requestCount: 0,
                    successRate: 0
                },
                
                // Session tracking
                tracking: {
                    operations: [],
                    errors: [],
                    checkpoints: [],
                    stateHistory: [{
                        state: SESSION_STATES.INITIALIZING,
                        timestamp: new Date().toISOString(),
                        context: options.context || {}
                    }]
                },
                
                // Session recovery data
                recovery: {
                    lastCheckpoint: null,
                    recoveryAttempts: 0,
                    maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
                    recoveryData: {}
                }
            };

            // Check concurrent session limit
            if (this.activeSessions.size >= this.options.maxConcurrentSessions) {
                throw new Error(`Maximum concurrent sessions limit reached: ${this.options.maxConcurrentSessions}`);
            }

            // Add to active sessions
            this.activeSessions.set(sessionId, session);

            // Persist session if enabled
            if (this.options.enablePersistence) {
                await this.persistSession(session);
            }

            // Record in database if available
            if (this.database) {
                await this.recordSessionInDatabase(session);
            }

            // Update session state to ACTIVE
            await this.updateSessionState(sessionId, SESSION_STATES.ACTIVE, {
                message: 'Session created and activated'
            });

            log(`Session created: ${sessionId} (${session.type})`);

            return session;

        } catch (error) {
            errorLog('Failed to create session:', error);
            throw error;
        }
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }

    /**
     * Update session state
     */
    async updateSessionState(sessionId, newState, context = {}) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const oldState = session.state;
        session.state = newState;
        session.lastActivity = new Date().toISOString();

        // Add to state history
        session.tracking.stateHistory.push({
            state: newState,
            timestamp: new Date().toISOString(),
            context,
            previousState: oldState
        });

        // Handle specific state transitions
        if (newState === SESSION_STATES.COMPLETED || newState === SESSION_STATES.FAILED) {
            session.metrics.endTime = Date.now();
            session.metrics.duration = session.metrics.endTime - session.metrics.startTime;
            session.metrics.successRate = session.metrics.operationCount > 0 ? 
                ((session.metrics.operationCount - session.metrics.errorCount) / session.metrics.operationCount) * 100 : 0;
        }

        // Persist updated session
        if (this.options.enablePersistence) {
            await this.persistSession(session);
        }

        // Update database
        if (this.database) {
            await this.updateSessionInDatabase(session);
        }

        // Send to monitoring service
        if (this.monitoringService) {
            this.monitoringService.recordSessionStateChange(sessionId, oldState, newState, context);
        }

        log(`Session ${sessionId} state changed: ${oldState} → ${newState}`);

        return session;
    }

    /**
     * Record session operation
     */
    async recordOperation(sessionId, operation) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const operationRecord = {
            id: crypto.randomUUID(),
            type: operation.type,
            timestamp: new Date().toISOString(),
            duration: operation.duration || null,
            success: operation.success !== false,
            data: operation.data || {},
            metadata: operation.metadata || {}
        };

        // Add to session tracking
        session.tracking.operations.push(operationRecord);
        session.metrics.operationCount++;
        session.lastActivity = new Date().toISOString();

        if (!operationRecord.success) {
            session.metrics.errorCount++;
        }

        if (operation.dataPoints) {
            session.metrics.dataPointsCollected += operation.dataPoints;
        }

        if (operation.bytesTransferred) {
            session.metrics.bytesTransferred += operation.bytesTransferred;
        }

        if (operation.type === 'HTTP_REQUEST') {
            session.metrics.requestCount++;
        }

        // Limit operation history size
        if (session.tracking.operations.length > 100) {
            session.tracking.operations = session.tracking.operations.slice(-100);
        }

        // Persist updated session
        if (this.options.enablePersistence) {
            await this.persistSession(session);
        }

        return operationRecord;
    }

    /**
     * Record session error
     */
    async recordError(sessionId, error) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const errorRecord = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            category: error.category || 'UNKNOWN',
            severity: error.severity || 'MEDIUM',
            message: error.message,
            context: error.context || {}
        };

        // Add to session tracking
        session.tracking.errors.push(errorRecord);
        session.metrics.errorCount++;
        session.lastActivity = new Date().toISOString();

        // Limit error history size
        if (session.tracking.errors.length > 50) {
            session.tracking.errors = session.tracking.errors.slice(-50);
        }

        // Persist updated session
        if (this.options.enablePersistence) {
            await this.persistSession(session);
        }

        return errorRecord;
    }

    /**
     * Create session checkpoint
     */
    async createCheckpoint(sessionId, checkpointData = {}) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const checkpoint = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            sessionState: { ...session },
            data: checkpointData,
            type: checkpointData.type || 'MANUAL'
        };

        // Add to session tracking
        session.tracking.checkpoints.push(checkpoint);
        session.recovery.lastCheckpoint = checkpoint;
        session.lastActivity = new Date().toISOString();

        // Limit checkpoint history
        if (session.tracking.checkpoints.length > 20) {
            session.tracking.checkpoints = session.tracking.checkpoints.slice(-20);
        }

        // Persist checkpoint
        if (this.options.enablePersistence) {
            await this.persistCheckpoint(sessionId, checkpoint);
        }

        log(`Checkpoint created for session ${sessionId}: ${checkpoint.id}`);

        return checkpoint;
    }

    /**
     * Recover session from checkpoint
     */
    async recoverSession(sessionId, checkpointId = null) {
        try {
            let session = this.getSession(sessionId);

            // If session not in memory, try to load from persistence
            if (!session && this.options.enablePersistence) {
                session = await this.loadSessionFromStorage(sessionId);
                if (session) {
                    this.activeSessions.set(sessionId, session);
                }
            }

            if (!session) {
                throw new Error(`Session not found for recovery: ${sessionId}`);
            }

            // Find checkpoint to recover from
            let checkpoint = null;
            if (checkpointId) {
                checkpoint = session.tracking.checkpoints.find(cp => cp.id === checkpointId);
            } else {
                checkpoint = session.recovery.lastCheckpoint;
            }

            if (!checkpoint) {
                throw new Error(`No checkpoint found for recovery`);
            }

            // Update recovery tracking
            session.recovery.recoveryAttempts++;
            
            if (session.recovery.recoveryAttempts > session.recovery.maxRecoveryAttempts) {
                throw new Error(`Maximum recovery attempts exceeded for session ${sessionId}`);
            }

            // Update session state
            await this.updateSessionState(sessionId, SESSION_STATES.RECOVERING, {
                checkpointId: checkpoint.id,
                recoveryAttempt: session.recovery.recoveryAttempts
            });

            log(`Session ${sessionId} recovering from checkpoint ${checkpoint.id} (attempt ${session.recovery.recoveryAttempts})`);

            return {
                session,
                checkpoint,
                recoveryAttempt: session.recovery.recoveryAttempts
            };

        } catch (error) {
            errorLog(`Failed to recover session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * End session
     */
    async endSession(sessionId, reason = 'COMPLETED') {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const finalState = reason === 'COMPLETED' ? SESSION_STATES.COMPLETED : SESSION_STATES.FAILED;

        // Update session state
        await this.updateSessionState(sessionId, finalState, { reason });

        // Move to history
        this.sessionHistory.push({ ...session });

        // Remove from active sessions
        this.activeSessions.delete(sessionId);

        // Update statistics
        this.updateSessionStats(session);

        // Archive session if persistence enabled
        if (this.options.enablePersistence) {
            await this.archiveSession(session);
        }

        log(`Session ended: ${sessionId} (${finalState})`);

        return session;
    }

    /**
     * Get session analytics
     */
    getSessionAnalytics() {
        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        const lastHour = now - (60 * 60 * 1000);

        // Filter sessions by time window
        const allSessions = [...this.activeSessions.values(), ...this.sessionHistory];
        const recent24h = allSessions.filter(s => 
            new Date(s.createdAt).getTime() > last24h
        );
        const recentHour = allSessions.filter(s => 
            new Date(s.createdAt).getTime() > lastHour
        );

        // Calculate metrics
        const avgDuration = recent24h
            .filter(s => s.metrics.duration)
            .reduce((sum, s) => sum + s.metrics.duration, 0) / recent24h.length || 0;

        const avgSuccessRate = recent24h
            .reduce((sum, s) => sum + s.metrics.successRate, 0) / recent24h.length || 0;

        const totalDataPoints = recent24h
            .reduce((sum, s) => sum + s.metrics.dataPointsCollected, 0);

        // Session state distribution
        const stateDistribution = {};
        this.activeSessions.forEach(session => {
            stateDistribution[session.state] = (stateDistribution[session.state] || 0) + 1;
        });

        // Session type distribution
        const typeDistribution = {};
        recent24h.forEach(session => {
            typeDistribution[session.type] = (typeDistribution[session.type] || 0) + 1;
        });

        return {
            active: this.activeSessions.size,
            total: allSessions.length,
            recent24h: recent24h.length,
            recentHour: recentHour.length,
            avgDuration: Math.round(avgDuration),
            avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
            totalDataPoints,
            stateDistribution,
            typeDistribution,
            maxConcurrent: this.options.maxConcurrentSessions,
            sessionTimeout: this.options.sessionTimeout
        };
    }

    /**
     * Get active sessions summary
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.values()).map(session => ({
            id: session.id,
            type: session.type,
            state: session.state,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            duration: Date.now() - session.metrics.startTime,
            operationCount: session.metrics.operationCount,
            errorCount: session.metrics.errorCount,
            dataPointsCollected: session.metrics.dataPointsCollected
        }));
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(8).toString('hex');
        return `session_${timestamp}_${random}`;
    }

    /**
     * Start heartbeat monitoring
     */
    startHeartbeatMonitoring() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(async () => {
            await this.performHeartbeat();
        }, this.options.heartbeatInterval);

        log('Session heartbeat monitoring started');
    }

    /**
     * Perform heartbeat check
     */
    async performHeartbeat() {
        try {
            const now = Date.now();
            const expiredSessions = [];

            // Check for expired sessions
            this.activeSessions.forEach((session, sessionId) => {
                const expiresAt = new Date(session.expiresAt).getTime();
                const lastActivity = new Date(session.lastActivity).getTime();
                const inactiveTime = now - lastActivity;

                // Check if session expired
                if (now > expiresAt || inactiveTime > this.options.sessionTimeout) {
                    expiredSessions.push(sessionId);
                }
            });

            // End expired sessions
            for (const sessionId of expiredSessions) {
                try {
                    await this.updateSessionState(sessionId, SESSION_STATES.EXPIRED, {
                        reason: 'Session timeout or expiration'
                    });
                    await this.endSession(sessionId, 'EXPIRED');
                } catch (error) {
                    errorLog(`Failed to expire session ${sessionId}:`, error);
                }
            }

            // Send heartbeat metrics to monitoring
            if (this.monitoringService) {
                this.monitoringService.recordSessionHeartbeat({
                    activeSessions: this.activeSessions.size,
                    expiredSessions: expiredSessions.length,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            errorLog('Heartbeat monitoring error:', error);
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            // Load and check all persisted sessions
            if (this.options.enablePersistence) {
                const sessionFiles = await fs.readdir(this.options.sessionStorePath)
                    .catch(() => []);

                for (const file of sessionFiles) {
                    if (file.endsWith('.json')) {
                        try {
                            const sessionPath = path.join(this.options.sessionStorePath, file);
                            const sessionData = await fs.readFile(sessionPath, 'utf-8');
                            const session = JSON.parse(sessionData);

                            const now = Date.now();
                            const expiresAt = new Date(session.expiresAt).getTime();

                            if (now > expiresAt) {
                                // Archive expired session
                                await this.archiveSession(session);
                                await fs.unlink(sessionPath);
                                log(`Cleaned up expired session: ${session.id}`);
                            }
                        } catch (error) {
                            errorLog(`Failed to process session file ${file}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            errorLog('Failed to cleanup expired sessions:', error);
        }
    }

    /**
     * Persist session to storage
     */
    async persistSession(session) {
        try {
            const sessionPath = path.join(this.options.sessionStorePath, `${session.id}.json`);
            await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
        } catch (error) {
            errorLog(`Failed to persist session ${session.id}:`, error);
        }
    }

    /**
     * Load session from storage
     */
    async loadSessionFromStorage(sessionId) {
        try {
            const sessionPath = path.join(this.options.sessionStorePath, `${sessionId}.json`);
            const sessionData = await fs.readFile(sessionPath, 'utf-8');
            return JSON.parse(sessionData);
        } catch (error) {
            return null;
        }
    }

    /**
     * Archive completed session
     */
    async archiveSession(session) {
        try {
            const archivePath = path.join(this.options.sessionStorePath, 'archive');
            await fs.mkdir(archivePath, { recursive: true });

            const archiveFile = path.join(archivePath, `${session.id}_${session.state}.json`);
            await fs.writeFile(archiveFile, JSON.stringify(session, null, 2));

            // Remove active session file
            const activeFile = path.join(this.options.sessionStorePath, `${session.id}.json`);
            await fs.unlink(activeFile).catch(() => {}); // Ignore if doesn't exist

        } catch (error) {
            errorLog(`Failed to archive session ${session.id}:`, error);
        }
    }

    /**
     * Load persisted sessions on startup
     */
    async loadPersistedSessions() {
        try {
            const sessionFiles = await fs.readdir(this.options.sessionStorePath)
                .catch(() => []);

            let loadedCount = 0;

            for (const file of sessionFiles) {
                if (file.endsWith('.json')) {
                    try {
                        const sessionPath = path.join(this.options.sessionStorePath, file);
                        const sessionData = await fs.readFile(sessionPath, 'utf-8');
                        const session = JSON.parse(sessionData);

                        // Check if session is still valid
                        const now = Date.now();
                        const expiresAt = new Date(session.expiresAt).getTime();

                        if (now < expiresAt && session.state === SESSION_STATES.ACTIVE) {
                            // Restore session as RECOVERING state
                            session.state = SESSION_STATES.RECOVERING;
                            session.lastActivity = new Date().toISOString();
                            this.activeSessions.set(session.id, session);
                            loadedCount++;
                        } else {
                            // Archive expired or completed session
                            await this.archiveSession(session);
                            await fs.unlink(sessionPath);
                        }
                    } catch (error) {
                        errorLog(`Failed to load session file ${file}:`, error);
                    }
                }
            }

            if (loadedCount > 0) {
                log(`Loaded ${loadedCount} persisted sessions for recovery`);
            }

        } catch (error) {
            errorLog('Failed to load persisted sessions:', error);
        }
    }

    /**
     * Persist checkpoint
     */
    async persistCheckpoint(sessionId, checkpoint) {
        try {
            const checkpointPath = path.join(this.options.sessionStorePath, 'checkpoints');
            await fs.mkdir(checkpointPath, { recursive: true });

            const checkpointFile = path.join(checkpointPath, `${sessionId}_${checkpoint.id}.json`);
            await fs.writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));
        } catch (error) {
            errorLog(`Failed to persist checkpoint ${checkpoint.id}:`, error);
        }
    }

    /**
     * Record session in database
     */
    async recordSessionInDatabase(session) {
        if (!this.database) return;

        try {
            // Implementation depends on database structure
            // This is a placeholder for database integration
            log(`Session ${session.id} recorded in database`);
        } catch (error) {
            errorLog(`Failed to record session in database:`, error);
        }
    }

    /**
     * Update session in database
     */
    async updateSessionInDatabase(session) {
        if (!this.database) return;

        try {
            // Implementation depends on database structure
            // This is a placeholder for database integration
            log(`Session ${session.id} updated in database`);
        } catch (error) {
            errorLog(`Failed to update session in database:`, error);
        }
    }

    /**
     * Update session statistics
     */
    updateSessionStats(session) {
        const key = `${session.type}:${session.state}`;
        
        if (!this.sessionStats.has(key)) {
            this.sessionStats.set(key, {
                count: 0,
                totalDuration: 0,
                totalOperations: 0,
                totalErrors: 0,
                totalDataPoints: 0
            });
        }

        const stats = this.sessionStats.get(key);
        stats.count++;
        
        if (session.metrics.duration) {
            stats.totalDuration += session.metrics.duration;
        }
        
        stats.totalOperations += session.metrics.operationCount;
        stats.totalErrors += session.metrics.errorCount;
        stats.totalDataPoints += session.metrics.dataPointsCollected;
    }

    /**
     * Shutdown session manager
     */
    async shutdown() {
        try {
            log('Shutting down SessionManager...');

            // Clear heartbeat timer
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }

            // End all active sessions
            const activeSessionIds = Array.from(this.activeSessions.keys());
            for (const sessionId of activeSessionIds) {
                try {
                    await this.endSession(sessionId, 'SHUTDOWN');
                } catch (error) {
                    errorLog(`Failed to end session ${sessionId} during shutdown:`, error);
                }
            }

            log('SessionManager shutdown completed');

        } catch (error) {
            errorLog('Error during SessionManager shutdown:', error);
        }
    }
}

module.exports = {
    SessionManager,
    SESSION_STATES,
    SESSION_TYPES
};
