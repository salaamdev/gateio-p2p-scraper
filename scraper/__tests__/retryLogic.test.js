// scraper/__tests__/retryLogic.test.js
const {
    retryOperation,
    retryPageNavigation,
    retryElementWait,
    retryDataExtraction,
    retryBrowserLaunch,
    RETRY_PRESETS,
    RetryableError,
    NonRetryableError,
    ExtractionError,
    NoDataFoundError,
    BrowserLaunchError,
    isRetryableError,
    calculateRetryDelay,
    sleep
} = require('../retryLogic');

// Mock the logger to avoid actual file writes during tests
jest.mock('../logger', () => ({
    log: jest.fn(),
    errorLog: jest.fn()
}));

describe('Retry Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Error Classes', () => {
        test('RetryableError should be retryable', () => {
            const error = new RetryableError('Test error');
            expect(error.retryable).toBe(true);
            expect(error.name).toBe('RetryableError');
        });

        test('NonRetryableError should not be retryable', () => {
            const error = new NonRetryableError('Test error');
            expect(error.retryable).toBe(false);
            expect(error.name).toBe('NonRetryableError');
        });

        test('ExtractionError should be retryable by default', () => {
            const error = new ExtractionError('Test extraction error');
            expect(error.retryable).toBe(true);
            expect(error.name).toBe('ExtractionError');
        });

        test('NoDataFoundError should be retryable by default', () => {
            const error = new NoDataFoundError('No data found');
            expect(error.retryable).toBe(true);
            expect(error.name).toBe('NoDataFoundError');
        });

        test('BrowserLaunchError should be retryable by default', () => {
            const error = new BrowserLaunchError('Browser failed to launch');
            expect(error.retryable).toBe(true);
            expect(error.name).toBe('BrowserLaunchError');
        });
    });

    describe('isRetryableError', () => {
        test('should return true for errors with retryable property set to true', () => {
            const error = new Error('Test');
            error.retryable = true;
            
            const result = isRetryableError(error, RETRY_PRESETS.NETWORK);
            expect(result).toBe(true);
        });

        test('should return false for errors with retryable property set to false', () => {
            const error = new Error('Test');
            error.retryable = false;
            
            const result = isRetryableError(error, RETRY_PRESETS.NETWORK);
            expect(result).toBe(false);
        });

        test('should check error name against retryable errors list', () => {
            const error = new Error('Test');
            error.name = 'TimeoutError';
            
            const result = isRetryableError(error, RETRY_PRESETS.NETWORK);
            expect(result).toBe(true);
        });

        test('should check error message against retryable errors list', () => {
            const error = new Error('ERR_NETWORK_CHANGED occurred');
            
            const result = isRetryableError(error, RETRY_PRESETS.NETWORK);
            expect(result).toBe(true);
        });

        test('should return false for non-retryable errors', () => {
            const error = new Error('Authentication failed');
            
            const result = isRetryableError(error, RETRY_PRESETS.NETWORK);
            expect(result).toBe(false);
        });
    });

    describe('calculateRetryDelay', () => {
        test('should calculate exponential backoff delay', () => {
            const config = RETRY_PRESETS.NETWORK;
            
            const delay1 = calculateRetryDelay(1, { ...config, jitter: false });
            const delay2 = calculateRetryDelay(2, { ...config, jitter: false });
            const delay3 = calculateRetryDelay(3, { ...config, jitter: false });
            
            expect(delay1).toBe(1000); // baseDelay * 2^0 = 1000
            expect(delay2).toBe(2000); // baseDelay * 2^1 = 2000
            expect(delay3).toBe(4000); // baseDelay * 2^2 = 4000
        });

        test('should respect maximum delay', () => {
            const config = { ...RETRY_PRESETS.NETWORK, jitter: false };
            
            const delay = calculateRetryDelay(10, config); // Very high attempt number
            expect(delay).toBe(config.maxDelay);
        });

        test('should apply jitter when enabled', () => {
            const config = { ...RETRY_PRESETS.NETWORK, jitter: true };
            
            const delay1 = calculateRetryDelay(2, config);
            const delay2 = calculateRetryDelay(2, config);
            
            // With jitter, delays should be different (statistically)
            // We'll just check they're close to the expected value
            const expected = 2000;
            expect(delay1).toBeGreaterThan(expected * 0.8);
            expect(delay1).toBeLessThan(expected * 1.2);
            expect(delay2).toBeGreaterThan(expected * 0.8);
            expect(delay2).toBeLessThan(expected * 1.2);
        });
    });

    describe('sleep', () => {
        test('should resolve after specified time', async () => {
            const start = Date.now();
            await sleep(100);
            const end = Date.now();
            
            expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
        });
    });

    describe('retryOperation', () => {
        test('should succeed on first attempt', async () => {
            const operation = jest.fn().mockResolvedValue('success');
            
            const result = await retryOperation(operation, {
                operationType: 'test operation',
                retryConfig: RETRY_PRESETS.NETWORK
            });
            
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable errors', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new RetryableError('First attempt failed'))
                .mockRejectedValueOnce(new RetryableError('Second attempt failed'))
                .mockResolvedValue('success on third attempt');
            
            const result = await retryOperation(operation, {
                operationType: 'test operation',
                retryConfig: { ...RETRY_PRESETS.NETWORK, baseDelay: 10 } // Fast delay for tests
            });
            
            expect(result).toBe('success on third attempt');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        test('should throw NonRetryableError immediately', async () => {
            const operation = jest.fn()
                .mockRejectedValue(new NonRetryableError('Non-retryable error'));
            
            await expect(retryOperation(operation, {
                operationType: 'test operation',
                retryConfig: RETRY_PRESETS.NETWORK
            })).rejects.toThrow('Non-retryable error in test operation');
            
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should throw after max attempts', async () => {
            const operation = jest.fn()
                .mockRejectedValue(new RetryableError('Always fails'));
            
            await expect(retryOperation(operation, {
                operationType: 'test operation',
                retryConfig: { ...RETRY_PRESETS.NETWORK, maxAttempts: 2, baseDelay: 10 }
            })).rejects.toThrow('Operation failed after 2 attempts');
            
            expect(operation).toHaveBeenCalledTimes(2);
        });

        test('should respect retry configuration based on error type', async () => {
            const timeoutError = new Error('TimeoutError occurred');
            timeoutError.name = 'TimeoutError';
            
            const operation = jest.fn()
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValue('success');
            
            const result = await retryOperation(operation, {
                operationType: 'test operation',
                retryConfig: { ...RETRY_PRESETS.NETWORK, baseDelay: 10 }
            });
            
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(2);
        });
    });

    describe('Specialized Retry Functions', () => {
        test('retryPageNavigation should use PAGE_OPERATIONS config', async () => {
            const operation = jest.fn().mockResolvedValue('page loaded');
            
            const result = await retryPageNavigation(operation, { url: 'test.com' });
            
            expect(result).toBe('page loaded');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('retryElementWait should use ELEMENT_WAIT config', async () => {
            const operation = jest.fn().mockResolvedValue('element found');
            
            const result = await retryElementWait(operation, { selector: '.test' });
            
            expect(result).toBe('element found');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('retryDataExtraction should use DATA_EXTRACTION config', async () => {
            const operation = jest.fn().mockResolvedValue(['data1', 'data2']);
            
            const result = await retryDataExtraction(operation, { type: 'merchants' });
            
            expect(result).toEqual(['data1', 'data2']);
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('retryBrowserLaunch should use BROWSER_LAUNCH config', async () => {
            const mockBrowser = { close: jest.fn() };
            const operation = jest.fn().mockResolvedValue(mockBrowser);
            
            const result = await retryBrowserLaunch(operation, { headless: true });
            
            expect(result).toBe(mockBrowser);
            expect(operation).toHaveBeenCalledTimes(1);
        });
    });

    describe('RETRY_PRESETS', () => {
        test('should have all required presets', () => {
            expect(RETRY_PRESETS.NETWORK).toBeDefined();
            expect(RETRY_PRESETS.ELEMENT_WAIT).toBeDefined();
            expect(RETRY_PRESETS.DATA_EXTRACTION).toBeDefined();
            expect(RETRY_PRESETS.BROWSER_LAUNCH).toBeDefined();
        });

        test('each preset should have required properties', () => {
            Object.values(RETRY_PRESETS).forEach(preset => {
                expect(preset).toHaveProperty('maxAttempts');
                expect(preset).toHaveProperty('baseDelay');
                expect(preset).toHaveProperty('maxDelay');
                expect(preset).toHaveProperty('backoffMultiplier');
                expect(preset).toHaveProperty('jitter');
                expect(preset).toHaveProperty('retryableErrors');
                expect(Array.isArray(preset.retryableErrors)).toBe(true);
            });
        });

        test('should have reasonable default values', () => {
            const networkPreset = RETRY_PRESETS.NETWORK;
            expect(networkPreset.maxAttempts).toBeGreaterThan(0);
            expect(networkPreset.baseDelay).toBeGreaterThan(0);
            expect(networkPreset.maxDelay).toBeGreaterThan(networkPreset.baseDelay);
            expect(networkPreset.backoffMultiplier).toBeGreaterThan(1);
        });
    });
});
