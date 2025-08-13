// scraper/gracefulShutdown.js
const EventEmitter = require('events');

/**
 * Graceful Shutdown Handler
 * 
 * Features:
 * - Signal handling (SIGTERM, SIGINT, SIGQUIT)
 * - Resource cleanup coordination
 * - Async operation completion
 * - Timeout handling
 * - Component shutdown prioritization
 * - Shutdown state management
 * - Emergency shutdown
 * - Shutdown event broadcasting
 */

/**
 * Shutdown States
 */
const SHUTDOWN_STATES = {
    RUNNING: 'running',
    SHUTTING_DOWN: 'shutting_down',
    SHUTDOWN_COMPLETE: 'shutdown_complete',
    SHUTDOWN_TIMEOUT: 'shutdown_timeout',
    EMERGENCY_SHUTDOWN: 'emergency_shutdown'
};

/**
 * Shutdown Component Priority Levels
 */
const PRIORITY_LEVELS = {
    CRITICAL: 0,    // Database connections, critical data operations
    HIGH: 1,        // Active scrapers, data processing
    MEDIUM: 2,      // Monitoring, metrics, logging
    LOW: 3,         // Background tasks, cleanup operations
    CLEANUP: 4      // Final cleanup, temporary file removal
};

/**
 * Shutdown Component Interface
 */
class ShutdownComponent {
    constructor(name, shutdownFn, options = {}) {
        this.name = name;
        this.shutdownFn = shutdownFn;
        this.priority = options.priority || PRIORITY_LEVELS.MEDIUM;
        this.timeout = options.timeout || 10000; // 10 seconds default
        this.dependencies = options.dependencies || [];
        this.essential = options.essential !== false; // Essential by default
        this.state = 'ready';
        this.shutdownStartTime = null;
        this.shutdownEndTime = null;
        this.error = null;
    }

    async shutdown() {
        if (this.state !== 'ready') {
            return { success: false, error: 'Component already shutting down or completed' };
        }

        this.state = 'shutting_down';
        this.shutdownStartTime = Date.now();

        try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Shutdown timeout after ${this.timeout}ms`)), this.timeout);
            });

            // Race between shutdown function and timeout
            await Promise.race([
                this.shutdownFn(),
                timeoutPromise
            ]);

            this.state = 'completed';
            this.shutdownEndTime = Date.now();
            
            return {
                success: true,
                duration: this.shutdownEndTime - this.shutdownStartTime
            };

        } catch (error) {
            this.state = 'failed';
            this.error = error;
            this.shutdownEndTime = Date.now();
            
            return {
                success: false,
                error: error.message,
                duration: this.shutdownEndTime - this.shutdownStartTime
            };
        }
    }

    getDuration() {
        if (!this.shutdownStartTime) return 0;
        const endTime = this.shutdownEndTime || Date.now();
        return endTime - this.shutdownStartTime;
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            priority: this.priority,
            essential: this.essential,
            duration: this.getDuration(),
            error: this.error?.message || null
        };
    }
}

/**
 * Main Graceful Shutdown Manager
 */
class GracefulShutdown extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            timeout: options.timeout || 30000, // 30 seconds total timeout
            forceExitTimeout: options.forceExitTimeout || 5000, // 5 seconds before force exit
            enableSignalHandlers: options.enableSignalHandlers !== false,
            signals: options.signals || ['SIGTERM', 'SIGINT', 'SIGQUIT'],
            enableUncaughtExceptionHandler: options.enableUncaughtExceptionHandler !== false,
            enableUnhandledRejectionHandler: options.enableUnhandledRejectionHandler !== false,
            emergencyShutdownSignals: options.emergencyShutdownSignals || ['SIGUSR2'],
            exitCode: options.exitCode || 0,
            ...options
        };

        this.state = SHUTDOWN_STATES.RUNNING;
        this.components = new Map();
        this.shutdownStartTime = null;
        this.shutdownEndTime = null;
        this.shutdownResults = [];
        this.signalHandlers = new Map();
        this.activeOperations = new Set();
        this.shutdownPromise = null;

        // Initialize signal handlers
        if (this.options.enableSignalHandlers) {
            this.setupSignalHandlers();
        }

        // Initialize exception handlers
        if (this.options.enableUncaughtExceptionHandler) {
            this.setupUncaughtExceptionHandler();
        }

        if (this.options.enableUnhandledRejectionHandler) {
            this.setupUnhandledRejectionHandler();
        }
    }

    /**
     * Component Management
     */
    registerComponent(name, shutdownFn, options = {}) {
        if (this.components.has(name)) {
            throw new Error(`Component '${name}' is already registered`);
        }

        const component = new ShutdownComponent(name, shutdownFn, options);
        this.components.set(name, component);
        
        this.emit('component:registered', { name, component });
        
        return component;
    }

    unregisterComponent(name) {
        const component = this.components.get(name);
        if (component && component.state === 'shutting_down') {
            throw new Error(`Cannot unregister component '${name}' while it's shutting down`);
        }
        
        const removed = this.components.delete(name);
        if (removed) {
            this.emit('component:unregistered', { name });
        }
        
        return removed;
    }

    getComponent(name) {
        return this.components.get(name);
    }

    listComponents() {
        return Array.from(this.components.values()).map(c => c.getStatus());
    }

    /**
     * Operation Tracking
     */
    registerOperation(operationId, description = '') {
        if (this.state !== SHUTDOWN_STATES.RUNNING) {
            throw new Error('Cannot register operations during shutdown');
        }

        const operation = {
            id: operationId,
            description,
            startTime: Date.now()
        };

        this.activeOperations.add(operation);
        this.emit('operation:started', operation);
        
        return {
            complete: () => this.completeOperation(operationId),
            extend: (newDescription) => {
                operation.description = newDescription;
                this.emit('operation:extended', operation);
            }
        };
    }

    completeOperation(operationId) {
        for (const operation of this.activeOperations) {
            if (operation.id === operationId) {
                operation.endTime = Date.now();
                operation.duration = operation.endTime - operation.startTime;
                this.activeOperations.delete(operation);
                this.emit('operation:completed', operation);
                return true;
            }
        }
        return false;
    }

    getActiveOperations() {
        return Array.from(this.activeOperations);
    }

    waitForOperations(timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (this.activeOperations.size === 0) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (this.activeOperations.size === 0) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutHandle);
                    resolve();
                }
            }, 100);

            const timeoutHandle = setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error(`Timeout waiting for ${this.activeOperations.size} active operations`));
            }, timeout);
        });
    }

    /**
     * Signal Handlers
     */
    setupSignalHandlers() {
        for (const signal of this.options.signals) {
            const handler = () => {
                this.emit('signal:received', { signal });
                this.initiateShutdown(signal);
            };
            
            process.on(signal, handler);
            this.signalHandlers.set(signal, handler);
        }

        // Emergency shutdown signals
        for (const signal of this.options.emergencyShutdownSignals) {
            const handler = () => {
                this.emit('signal:emergency', { signal });
                this.emergencyShutdown(signal);
            };
            
            process.on(signal, handler);
            this.signalHandlers.set(signal, handler);
        }
    }

    setupUncaughtExceptionHandler() {
        process.on('uncaughtException', (error) => {
            this.emit('error:uncaught-exception', { error });
            console.error('Uncaught Exception:', error);
            this.emergencyShutdown('uncaughtException');
        });
    }

    setupUnhandledRejectionHandler() {
        process.on('unhandledRejection', (reason, promise) => {
            this.emit('error:unhandled-rejection', { reason, promise });
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.emergencyShutdown('unhandledRejection');
        });
    }

    removeSignalHandlers() {
        for (const [signal, handler] of this.signalHandlers) {
            process.removeListener(signal, handler);
        }
        this.signalHandlers.clear();
    }

    /**
     * Shutdown Orchestration
     */
    async initiateShutdown(reason = 'manual') {
        if (this.state !== SHUTDOWN_STATES.RUNNING) {
            return this.shutdownPromise;
        }

        this.state = SHUTDOWN_STATES.SHUTTING_DOWN;
        this.shutdownStartTime = Date.now();
        
        this.emit('shutdown:started', { reason, timestamp: this.shutdownStartTime });

        this.shutdownPromise = this.performShutdown(reason);
        return this.shutdownPromise;
    }

    async performShutdown(reason) {
        try {
            // Step 1: Wait for active operations to complete
            this.emit('shutdown:waiting-operations');
            try {
                await this.waitForOperations(5000); // 5 second timeout
                this.emit('shutdown:operations-completed');
            } catch (operationError) {
                this.emit('shutdown:operations-timeout', { 
                    activeOperations: this.getActiveOperations() 
                });
            }

            // Step 2: Sort components by priority and dependencies
            const shutdownOrder = this.calculateShutdownOrder();
            this.emit('shutdown:order-calculated', { order: shutdownOrder.map(c => c.name) });

            // Step 3: Shutdown components in order
            this.emit('shutdown:components-starting');
            const results = await this.shutdownComponents(shutdownOrder);
            this.shutdownResults = results;

            // Step 4: Final cleanup
            this.emit('shutdown:cleanup-starting');
            await this.performFinalCleanup();

            this.state = SHUTDOWN_STATES.SHUTDOWN_COMPLETE;
            this.shutdownEndTime = Date.now();

            const shutdownSummary = {
                reason,
                duration: this.shutdownEndTime - this.shutdownStartTime,
                componentsShutdown: results.length,
                successfulShutdowns: results.filter(r => r.success).length,
                failedShutdowns: results.filter(r => !r.success).length,
                results
            };

            this.emit('shutdown:completed', shutdownSummary);

            // Remove signal handlers to prevent duplicate shutdowns
            this.removeSignalHandlers();

            // Exit process after a brief delay
            setTimeout(() => {
                process.exit(this.options.exitCode);
            }, 100);

            return shutdownSummary;

        } catch (error) {
            this.state = SHUTDOWN_STATES.SHUTDOWN_TIMEOUT;
            this.emit('shutdown:failed', { error, reason });
            
            // Force exit after timeout
            setTimeout(() => {
                this.forceExit();
            }, this.options.forceExitTimeout);

            throw error;
        }
    }

    calculateShutdownOrder() {
        const components = Array.from(this.components.values());
        
        // Sort by priority (lower number = higher priority = shutdown first)
        components.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // If same priority, essential components go first
            if (a.essential !== b.essential) {
                return a.essential ? -1 : 1;
            }
            // Finally, sort by name for consistency
            return a.name.localeCompare(b.name);
        });

        // TODO: Implement dependency resolution
        // For now, just return priority-sorted list
        return components;
    }

    async shutdownComponents(components) {
        const results = [];
        const concurrentGroups = this.groupComponentsByPriority(components);

        for (const group of concurrentGroups) {
            this.emit('shutdown:group-starting', { 
                priority: group[0].priority, 
                components: group.map(c => c.name) 
            });

            // Shutdown components in the same priority group concurrently
            const groupPromises = group.map(async (component) => {
                this.emit('shutdown:component-starting', { name: component.name });
                
                const result = await component.shutdown();
                result.name = component.name;
                result.priority = component.priority;
                
                this.emit('shutdown:component-completed', { 
                    name: component.name, 
                    success: result.success,
                    duration: result.duration
                });
                
                return result;
            });

            const groupResults = await Promise.allSettled(groupPromises);
            
            for (const result of groupResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({
                        name: 'unknown',
                        success: false,
                        error: result.reason.message,
                        duration: 0
                    });
                }
            }

            this.emit('shutdown:group-completed', { 
                priority: group[0].priority,
                results: results.slice(-group.length)
            });
        }

        return results;
    }

    groupComponentsByPriority(components) {
        const groups = [];
        let currentGroup = [];
        let currentPriority = null;

        for (const component of components) {
            if (currentPriority === null || component.priority === currentPriority) {
                currentGroup.push(component);
                currentPriority = component.priority;
            } else {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = [component];
                currentPriority = component.priority;
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    async performFinalCleanup() {
        try {
            // Clear any remaining timers, intervals, etc.
            // This is a placeholder for application-specific cleanup
            this.emit('shutdown:final-cleanup');
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
        } catch (cleanupError) {
            this.emit('shutdown:cleanup-error', { error: cleanupError });
        }
    }

    /**
     * Emergency Shutdown
     */
    emergencyShutdown(reason = 'emergency') {
        this.state = SHUTDOWN_STATES.EMERGENCY_SHUTDOWN;
        this.emit('shutdown:emergency', { reason });

        console.error(`EMERGENCY SHUTDOWN INITIATED: ${reason}`);

        // Try to save critical data
        this.performEmergencyDataSave();

        // Force exit after brief delay
        setTimeout(() => {
            this.forceExit();
        }, 1000);
    }

    performEmergencyDataSave() {
        try {
            // Get critical components only
            const criticalComponents = Array.from(this.components.values())
                .filter(c => c.priority === PRIORITY_LEVELS.CRITICAL);

            // Try to shutdown critical components synchronously
            for (const component of criticalComponents) {
                try {
                    if (typeof component.shutdownFn === 'function') {
                        // Call without await to avoid blocking
                        component.shutdownFn();
                    }
                } catch (componentError) {
                    console.error(`Emergency shutdown failed for ${component.name}:`, componentError);
                }
            }
        } catch (error) {
            console.error('Emergency data save failed:', error);
        }
    }

    forceExit() {
        console.error('FORCE EXITING PROCESS');
        this.emit('shutdown:force-exit');
        process.exit(1);
    }

    /**
     * Health and Status
     */
    getStatus() {
        return {
            state: this.state,
            shutdownStartTime: this.shutdownStartTime,
            shutdownEndTime: this.shutdownEndTime,
            duration: this.shutdownStartTime ? 
                (this.shutdownEndTime || Date.now()) - this.shutdownStartTime : 0,
            components: this.listComponents(),
            activeOperations: this.getActiveOperations(),
            shutdownResults: this.shutdownResults
        };
    }

    isShuttingDown() {
        return this.state === SHUTDOWN_STATES.SHUTTING_DOWN;
    }

    isShutdownComplete() {
        return this.state === SHUTDOWN_STATES.SHUTDOWN_COMPLETE;
    }

    /**
     * Convenience Methods
     */
    async gracefulExit(code = 0) {
        this.options.exitCode = code;
        return this.initiateShutdown('graceful-exit');
    }

    onShutdown(callback) {
        this.on('shutdown:started', callback);
    }

    onShutdownComplete(callback) {
        this.on('shutdown:completed', callback);
    }

    onEmergencyShutdown(callback) {
        this.on('shutdown:emergency', callback);
    }

    /**
     * Testing and Development Helpers
     */
    async testShutdown() {
        const originalState = this.state;
        const originalComponents = new Map(this.components);
        
        try {
            // Create a mock shutdown environment
            this.state = SHUTDOWN_STATES.RUNNING;
            
            // Perform shutdown
            const result = await this.initiateShutdown('test');
            
            // Restore original state
            this.state = originalState;
            this.components = originalComponents;
            
            return result;
            
        } catch (error) {
            // Restore original state on error
            this.state = originalState;
            this.components = originalComponents;
            throw error;
        }
    }

    simulateSignal(signal) {
        this.emit('signal:received', { signal });
        return this.initiateShutdown(`simulated-${signal}`);
    }
}

/**
 * Global shutdown manager instance
 */
let globalShutdownManager = null;

/**
 * Factory functions
 */
function createShutdownManager(options = {}) {
    return new GracefulShutdown(options);
}

function getGlobalShutdownManager() {
    if (!globalShutdownManager) {
        globalShutdownManager = createShutdownManager();
    }
    return globalShutdownManager;
}

function setGlobalShutdownManager(manager) {
    globalShutdownManager = manager;
}

/**
 * Convenience functions using global manager
 */
function registerShutdownComponent(name, shutdownFn, options) {
    return getGlobalShutdownManager().registerComponent(name, shutdownFn, options);
}

function registerOperation(operationId, description) {
    return getGlobalShutdownManager().registerOperation(operationId, description);
}

function initiateShutdown(reason) {
    return getGlobalShutdownManager().initiateShutdown(reason);
}

function onShutdown(callback) {
    return getGlobalShutdownManager().onShutdown(callback);
}

function isShuttingDown() {
    return getGlobalShutdownManager().isShuttingDown();
}

module.exports = {
    GracefulShutdown,
    ShutdownComponent,
    SHUTDOWN_STATES,
    PRIORITY_LEVELS,
    createShutdownManager,
    getGlobalShutdownManager,
    setGlobalShutdownManager,
    registerShutdownComponent,
    registerOperation,
    initiateShutdown,
    onShutdown,
    isShuttingDown
};
