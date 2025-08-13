// scraper/__tests__/selectors.test.js
const { 
    SELECTOR_STRATEGIES, 
    validateMerchantData 
} = require('../selectors');

describe('Robust Selector Strategy', () => {
    test('should have all required selector strategies', () => {
        expect(SELECTOR_STRATEGIES).toHaveProperty('merchantContainers');
        expect(SELECTOR_STRATEGIES).toHaveProperty('merchantName');
        expect(SELECTOR_STRATEGIES).toHaveProperty('price');
        expect(SELECTOR_STRATEGIES).toHaveProperty('currency');
        expect(SELECTOR_STRATEGIES).toHaveProperty('sizeLimit');
        expect(SELECTOR_STRATEGIES).toHaveProperty('discount');
    });

    test('should have multiple fallback selectors for each strategy', () => {
        Object.entries(SELECTOR_STRATEGIES).forEach(([_key, strategy]) => {
            expect(Array.isArray(strategy)).toBe(true);
            expect(strategy.length).toBeGreaterThan(1);
            expect(strategy.length).toBeLessThan(20); // Reasonable upper limit
        });
    });

    test('should have primary selectors with data-testid or specific classes', () => {
        const strategies = ['merchantName', 'price', 'currency', 'sizeLimit', 'discount'];
        
        strategies.forEach(strategyName => {
            const selectors = SELECTOR_STRATEGIES[strategyName];
            const hasPrimarySelector = selectors.some(selector => 
                selector.includes('data-testid') || 
                selector.includes('[') ||
                selector.startsWith('.')
            );
            expect(hasPrimarySelector).toBe(true);
        });
    });

    test('should validate merchant data correctly', () => {
        const validMerchant = {
            'Merchant Name': 'TestMerchant',
            'Price': '125.50 KES',
            'PriceNumeric': 125.50,
            'Size/Limit': '10~500 USDT',
            'Discount': '5%'
        };

        const result = validateMerchantData(validMerchant);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should catch validation errors for missing merchant name', () => {
        const invalidMerchant = {
            'Merchant Name': 'N/A',
            'Price': '125.50 KES',
            'PriceNumeric': 125.50,
            'Size/Limit': '10~500 USDT',
            'Discount': '5%'
        };

        const result = validateMerchantData(invalidMerchant);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing merchant name');
    });

    test('should catch validation errors for invalid numeric price', () => {
        const invalidMerchant = {
            'Merchant Name': 'TestMerchant',
            'Price': '125.50 KES',
            'PriceNumeric': 'not_a_number',
            'Size/Limit': '10~500 USDT',
            'Discount': '5%'
        };

        const result = validateMerchantData(invalidMerchant);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid numeric price');
    });

    test('should generate warnings for suspicious price format', () => {
        const suspiciousMerchant = {
            'Merchant Name': 'TestMerchant',
            'Price': 'invalid price format',
            'PriceNumeric': 125.50,
            'Size/Limit': '10~500 USDT',
            'Discount': '5%'
        };

        const result = validateMerchantData(suspiciousMerchant);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Price format may be incorrect');
    });

    test('should generate warnings for suspicious price format', () => {
        const suspiciousMerchant = {
            'Merchant Name': 'TestMerchant',
            'Price': 'invalid price format',
            'PriceNumeric': 125.50,
            'Size/Limit': '10~500 USDT',
            'Discount': '5%'
        };

        const result = validateMerchantData(suspiciousMerchant);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Price format may be incorrect');
    });

    test('should generate warnings for missing size/limit', () => {
        const merchantWithoutLimit = {
            'Merchant Name': 'TestMerchant',
            'Price': '125.50 KES',
            'PriceNumeric': 125.50,
            'Size/Limit': 'N/A',
            'Discount': '5%'
        };

        const result = validateMerchantData(merchantWithoutLimit);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Missing size/limit information');
    });
});

describe('Selector Strategy Structure', () => {
    test('merchant container selectors should be ordered from specific to generic', () => {
        const containers = SELECTOR_STRATEGIES.merchantContainers;
        
        // First few should be specific
        expect(containers[0]).toMatch(/\[data-testid|\.[\w-]+/);
        
        // Last few should be generic
        const lastSelectors = containers.slice(-3);
        expect(lastSelectors.some(s => s === 'tr' || s === 'li')).toBe(true);
    });

    test('should not have duplicate selectors within strategies', () => {
        Object.entries(SELECTOR_STRATEGIES).forEach(([_key, strategy]) => {
            const uniqueSelectors = new Set(strategy);
            expect(uniqueSelectors.size).toBe(strategy.length);
        });
    });
});
