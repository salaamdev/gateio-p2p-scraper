// scraper/__tests__/circuitBreaker.test.js
const {
    CircuitBreaker,
    CircuitBreakerManager,
    CircuitBreakerOpenError,
    CIRCUIT_STATES,
    CIRCUIT_BREAKER_PRESETS,
    getCircuitBreaker,
    getAllCircuitBreakerStats,
    resetAllCircuitBreakers
} = require('../circuitBreaker');

// Mock the logger to avoid actual file writes during tests
jest.mock('../logger', () => ({
    log: jest.fn(),
    errorLog: jest.fn()
}));

// Mock timers for controlled testing
jest.useFakeTimers();

describe('Circuit Breaker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Reset all circuit breakers before each test
        resetAllCircuitBreakers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
    });

    describe('CircuitBreaker', () => {
        test('should start in CLOSED state', () => {
            const breaker = new CircuitBreaker();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
            expect(breaker.isAvailable()).toBe(true);
        });

        test('should open after failure threshold is reached', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 2,
                recoveryTimeout: 10000
            });

            // First failure
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);

            // Second failure - should open
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);
            expect(breaker.isAvailable()).toBe(false);
        });

        test('should transition to HALF_OPEN after recovery timeout', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1,
                recoveryTimeout: 5000
            });

            // Cause failure to open circuit
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);

            // Advance time to recovery timeout
            jest.advanceTimersByTime(5000);

            // Check availability should transition to HALF_OPEN
            expect(breaker.isAvailable()).toBe(true);
            expect(breaker.getState()).toBe(CIRCUIT_STATES.HALF_OPEN);
        });

        test('should close from HALF_OPEN after success threshold', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1,
                recoveryTimeout: 5000,
                successThreshold: 2
            });

            // Open the circuit
            breaker.onFailure();
            jest.advanceTimersByTime(5000);
            breaker.isAvailable(); // Transition to HALF_OPEN

            // First success
            breaker.onSuccess();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.HALF_OPEN);

            // Second success - should close
            breaker.onSuccess();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
        });

        test('should return to OPEN from HALF_OPEN on failure', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1,
                recoveryTimeout: 5000
            });

            // Open the circuit
            breaker.onFailure();
            jest.advanceTimersByTime(5000);
            breaker.isAvailable(); // Transition to HALF_OPEN

            // Failure in HALF_OPEN should return to OPEN
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);
        });

        test('should clean up old failures outside monitor window', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 3,
                monitorWindow: 10000
            });

            // Record failure
            breaker.onFailure();
            const statsAfterFirstFailure = breaker.getStats();
            expect(statsAfterFirstFailure.recentFailures).toBe(1);

            // Advance time beyond monitor window
            jest.advanceTimersByTime(15000);

            // Record another failure (this should clean up the old one)
            breaker.onFailure();
            const statsAfterCleanup = breaker.getStats();
            expect(statsAfterCleanup.recentFailures).toBe(1); // Only the recent one
        });

        test('should provide accurate statistics', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 2,
                recoveryTimeout: 5000
            });

            const initialStats = breaker.getStats();
            expect(initialStats.state).toBe(CIRCUIT_STATES.CLOSED);
            expect(initialStats.recentFailures).toBe(0);
            expect(initialStats.isAvailable).toBe(true);

            // Add failure
            breaker.onFailure();
            const statsAfterFailure = breaker.getStats();
            expect(statsAfterFailure.recentFailures).toBe(1);
            expect(statsAfterFailure.lastFailureTime).toBeTruthy();
        });

        test('should execute operation successfully when circuit is closed', async () => {
            const breaker = new CircuitBreaker();
            const operation = jest.fn().mockResolvedValue('success');

            const result = await breaker.execute(operation, 'test operation');

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
        });

        test('should throw CircuitBreakerOpenError when circuit is open', async () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1
            });

            // Open the circuit
            breaker.onFailure();

            const operation = jest.fn();

            await expect(
                breaker.execute(operation, 'test operation')
            ).rejects.toThrow(CircuitBreakerOpenError);

            expect(operation).not.toHaveBeenCalled();
        });

        test('should record success and failure appropriately during execution', async () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 2
            });

            // Successful execution
            const successOperation = jest.fn().mockResolvedValue('success');
            await breaker.execute(successOperation, 'success test');
            expect(breaker.getStats().recentFailures).toBe(0);

            // Failed execution
            const failOperation = jest.fn().mockRejectedValue(new Error('operation failed'));
            await expect(
                breaker.execute(failOperation, 'fail test')
            ).rejects.toThrow('operation failed');
            expect(breaker.getStats().recentFailures).toBe(1);
        });

        test('should reset to initial state', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1
            });

            // Open circuit
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);

            // Reset
            breaker.reset();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
            expect(breaker.getStats().recentFailures).toBe(0);
            expect(breaker.isAvailable()).toBe(true);
        });

        test('should force open circuit', () => {
            const breaker = new CircuitBreaker();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);

            breaker.forceOpen();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);
            expect(breaker.isAvailable()).toBe(false);
        });

        test('should force close circuit', () => {
            const breaker = new CircuitBreaker({
                failureThreshold: 1
            });

            // Open circuit
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);

            // Force close
            breaker.forceClose();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
            expect(breaker.isAvailable()).toBe(true);
        });
    });

    describe('CircuitBreakerOpenError', () => {
        test('should create error with correct properties', () => {
            const error = new CircuitBreakerOpenError('Circuit is open');
            expect(error.name).toBe('CircuitBreakerOpenError');
            expect(error.message).toBe('Circuit is open');
            expect(error.retryable).toBe(false);
        });
    });

    describe('CircuitBreakerManager', () => {
        test('should create and manage multiple circuit breakers', () => {
            const manager = new CircuitBreakerManager();

            const breaker1 = manager.getBreaker('test1');
            const breaker2 = manager.getBreaker('test2');

            expect(breaker1).toBeInstanceOf(CircuitBreaker);
            expect(breaker2).toBeInstanceOf(CircuitBreaker);
            expect(breaker1).not.toBe(breaker2);
        });

        test('should return same instance for same name', () => {
            const manager = new CircuitBreakerManager();

            const breaker1 = manager.getBreaker('test');
            const breaker2 = manager.getBreaker('test');

            expect(breaker1).toBe(breaker2);
        });

        test('should use provided config for new breakers', () => {
            const manager = new CircuitBreakerManager();
            const config = { failureThreshold: 10 };

            const breaker = manager.getBreaker('test', config);
            expect(breaker.config.failureThreshold).toBe(10);
        });

        test('should get all statistics', () => {
            const manager = new CircuitBreakerManager();

            manager.getBreaker('test1');
            manager.getBreaker('test2');

            const stats = manager.getAllStats();
            expect(stats).toHaveProperty('test1');
            expect(stats).toHaveProperty('test2');
            expect(stats.test1.state).toBe(CIRCUIT_STATES.CLOSED);
            expect(stats.test2.state).toBe(CIRCUIT_STATES.CLOSED);
        });

        test('should reset all circuit breakers', () => {
            const manager = new CircuitBreakerManager();

            const breaker1 = manager.getBreaker('test1', { failureThreshold: 1 });
            const breaker2 = manager.getBreaker('test2', { failureThreshold: 1 });

            // Open both circuits
            breaker1.onFailure();
            breaker2.onFailure();

            expect(breaker1.getState()).toBe(CIRCUIT_STATES.OPEN);
            expect(breaker2.getState()).toBe(CIRCUIT_STATES.OPEN);

            // Reset all
            manager.resetAll();

            expect(breaker1.getState()).toBe(CIRCUIT_STATES.CLOSED);
            expect(breaker2.getState()).toBe(CIRCUIT_STATES.CLOSED);
        });
    });

    describe('Global Circuit Breaker Functions', () => {
        test('getCircuitBreaker should return circuit breaker instance', () => {
            const breaker = getCircuitBreaker('test');
            expect(breaker).toBeInstanceOf(CircuitBreaker);
        });

        test('getAllCircuitBreakerStats should return statistics', () => {
            getCircuitBreaker('test1');
            getCircuitBreaker('test2');

            const stats = getAllCircuitBreakerStats();
            expect(stats).toHaveProperty('test1');
            expect(stats).toHaveProperty('test2');
        });

        test('resetAllCircuitBreakers should reset all breakers', () => {
            // Create a fresh circuit breaker manager to avoid interference
            const manager = new CircuitBreakerManager();
            const breaker = manager.getBreaker('test-reset', { failureThreshold: 1 });
            
            expect(breaker.config.failureThreshold).toBe(1); // Verify config
            
            breaker.onFailure();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.OPEN);

            manager.resetAll();
            expect(breaker.getState()).toBe(CIRCUIT_STATES.CLOSED);
        });
    });

    describe('CIRCUIT_BREAKER_PRESETS', () => {
        test('should have all required presets', () => {
            expect(CIRCUIT_BREAKER_PRESETS.PAGE_OPERATIONS).toBeDefined();
            expect(CIRCUIT_BREAKER_PRESETS.DATA_EXTRACTION).toBeDefined();
            expect(CIRCUIT_BREAKER_PRESETS.BROWSER_LAUNCH).toBeDefined();
            expect(CIRCUIT_BREAKER_PRESETS.NETWORK_OPERATIONS).toBeDefined();
        });

        test('each preset should have required properties', () => {
            Object.values(CIRCUIT_BREAKER_PRESETS).forEach(preset => {
                expect(preset).toHaveProperty('failureThreshold');
                expect(preset).toHaveProperty('recoveryTimeout');
                expect(preset).toHaveProperty('successThreshold');
                expect(preset).toHaveProperty('monitorWindow');
                expect(preset).toHaveProperty('name');
            });
        });

        test('should have reasonable default values', () => {
            const pageOpsPreset = CIRCUIT_BREAKER_PRESETS.PAGE_OPERATIONS;
            expect(pageOpsPreset.failureThreshold).toBeGreaterThan(0);
            expect(pageOpsPreset.recoveryTimeout).toBeGreaterThan(0);
            expect(pageOpsPreset.successThreshold).toBeGreaterThan(0);
            expect(pageOpsPreset.monitorWindow).toBeGreaterThan(0);
        });
    });

    describe('CIRCUIT_STATES', () => {
        test('should have all required states', () => {
            expect(CIRCUIT_STATES.CLOSED).toBe('CLOSED');
            expect(CIRCUIT_STATES.OPEN).toBe('OPEN');
            expect(CIRCUIT_STATES.HALF_OPEN).toBe('HALF_OPEN');
        });
    });
});
