// scraper/__tests__/schema.test.js
const {
    MERCHANT_SCHEMA,
    VALIDATION_RULES,
    ValidationResult,
    validateData,
    validateMerchants,
    generateScrapeId,
    sanitizeHtml,
    sanitizeUrl,
    sanitizeCurrency,
    sanitizeNumeric,
    typeValidators
} = require('../schema');

describe('Schema Validation System (Feature 4)', () => {
    // Sample valid merchant data
    const validMerchant = {
        merchantName: 'TestMerchant123',
        totalOrders: '1,234',
        completionRate: '99.5%',
        avgReleaseTime: '2 minutes',
        positiveRating: '98.5%',
        currency: 'USD',
        paymentMethods: ['Bank Transfer', 'PayPal'],
        minOrder: '$50',
        maxOrder: '$10,000',
        exchangeRate: '1.05',
        isOnline: true,
        lastActive: '2 minutes ago'
    };

    const invalidMerchant = {
        merchantName: '', // Invalid: empty
        totalOrders: 'invalid', // Invalid: not numeric
        completionRate: '150%', // Invalid: over 100%
        avgReleaseTime: '', // Invalid: empty
        positiveRating: 'abc%', // Invalid: not numeric
        currency: 'INVALID_CURRENCY', // Invalid: not standard currency
        paymentMethods: 'not_array', // Invalid: should be array
        minOrder: 'abc', // Invalid: not numeric
        maxOrder: '', // Invalid: empty
        exchangeRate: -1, // Invalid: negative
        isOnline: 'yes', // Invalid: should be boolean
        lastActive: '' // Invalid: empty
    };

    describe('MERCHANT_SCHEMA structure', () => {
        test('should have all required fields defined', () => {
            const requiredFields = [
                'merchantName', 'totalOrders', 'completionRate', 'avgReleaseTime',
                'positiveRating', 'currency', 'paymentMethods', 'minOrder',
                'maxOrder', 'exchangeRate', 'isOnline', 'lastActive'
            ];

            requiredFields.forEach(field => {
                expect(MERCHANT_SCHEMA).toHaveProperty(field);
                expect(MERCHANT_SCHEMA[field]).toHaveProperty('type');
                expect(MERCHANT_SCHEMA[field]).toHaveProperty('required');
                expect(MERCHANT_SCHEMA[field]).toHaveProperty('rules');
            });
        });

        test('should have proper validation rules structure', () => {
            Object.values(MERCHANT_SCHEMA).forEach(fieldSchema => {
                expect(Array.isArray(fieldSchema.rules)).toBe(true);
                fieldSchema.rules.forEach(rule => {
                    expect(rule).toHaveProperty('type');
                    expect(Object.values(VALIDATION_RULES)).toContain(rule.type);
                });
            });
        });
    });

    describe('ValidationResult class', () => {
        test('should create valid result correctly', () => {
            const result = new ValidationResult(true, [], [], {}, 1);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
            expect(result.sanitizedData).toEqual({});
            expect(result.validCount).toBe(1);
        });

        test('should create invalid result correctly', () => {
            const errors = ['Error 1', 'Error 2'];
            const warnings = ['Warning 1'];
            const result = new ValidationResult(false, errors, warnings, null, 0);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(errors);
            expect(result.warnings).toEqual(warnings);
            expect(result.sanitizedData).toBe(null);
            expect(result.validCount).toBe(0);
        });
    });

    describe('Type validators', () => {
        test('validateString should work correctly', () => {
            expect(typeValidators.validateString('test')).toBe(true);
            expect(typeValidators.validateString('')).toBe(true);
            expect(typeValidators.validateString(123)).toBe(false);
            expect(typeValidators.validateString(null)).toBe(false);
        });

        test('validateNumber should work correctly', () => {
            expect(typeValidators.validateNumber(123)).toBe(true);
            expect(typeValidators.validateNumber(0)).toBe(true);
            expect(typeValidators.validateNumber(-123)).toBe(true);
            expect(typeValidators.validateNumber('123')).toBe(false);
            expect(typeValidators.validateNumber(null)).toBe(false);
        });

        test('validateBoolean should work correctly', () => {
            expect(typeValidators.validateBoolean(true)).toBe(true);
            expect(typeValidators.validateBoolean(false)).toBe(true);
            expect(typeValidators.validateBoolean('true')).toBe(false);
            expect(typeValidators.validateBoolean(1)).toBe(false);
        });

        test('validateArray should work correctly', () => {
            expect(typeValidators.validateArray([])).toBe(true);
            expect(typeValidators.validateArray(['a', 'b'])).toBe(true);
            expect(typeValidators.validateArray('not array')).toBe(false);
            expect(typeValidators.validateArray(null)).toBe(false);
        });
    });

    describe('Sanitization functions', () => {
        test('sanitizeHtml should remove HTML tags', () => {
            expect(sanitizeHtml('<script>alert("xss")</script>test')).toBe('test');
            expect(sanitizeHtml('<b>bold</b> text')).toBe('bold text');
            expect(sanitizeHtml('plain text')).toBe('plain text');
        });

        test('sanitizeUrl should validate and clean URLs', () => {
            expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
            expect(sanitizeUrl('javascript:alert("xss")')).toBe('');
            expect(sanitizeUrl('not-a-url')).toBe('');
        });

        test('sanitizeCurrency should normalize currency codes', () => {
            expect(sanitizeCurrency('usd')).toBe('USD');
            expect(sanitizeCurrency('EUR')).toBe('EUR');
            expect(sanitizeCurrency('invalid')).toBe('');
        });

        test('sanitizeNumeric should extract numbers from strings', () => {
            expect(sanitizeNumeric('$1,234.56')).toBe('1234.56');
            expect(sanitizeNumeric('99.5%')).toBe('99.5');
            expect(sanitizeNumeric('no numbers')).toBe('');
        });
    });

    describe('validateData function', () => {
        test('should validate correct merchant data', () => {
            const result = validateData(validMerchant);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.validCount).toBe(1);
            expect(result.sanitizedData).toBeDefined();
        });

        test('should detect invalid merchant data', () => {
            const result = validateData(invalidMerchant);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.validCount).toBe(0);
        });

        test('should handle empty data', () => {
            const result = validateData({});
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.validCount).toBe(0);
        });

        test('should handle null/undefined data', () => {
            expect(() => validateData(null)).not.toThrow();
            expect(() => validateData(undefined)).not.toThrow();
            
            const nullResult = validateData(null);
            expect(nullResult.isValid).toBe(false);
            expect(nullResult.errors.length).toBeGreaterThan(0);
        });
    });

    describe('validateMerchants function', () => {
        test('should validate array of valid merchants', () => {
            const merchants = [validMerchant, validMerchant];
            const result = validateMerchants(merchants);
            
            expect(result.isValid).toBe(true);
            expect(result.validCount).toBe(2);
            expect(result.sanitizedData).toHaveLength(2);
        });

        test('should handle mixed valid/invalid merchants', () => {
            const merchants = [validMerchant, invalidMerchant];
            const result = validateMerchants(merchants);
            
            expect(result.validCount).toBe(1);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.sanitizedData).toHaveLength(1);
        });

        test('should handle empty array', () => {
            const result = validateMerchants([]);
            
            expect(result.isValid).toBe(true);
            expect(result.validCount).toBe(0);
            expect(result.sanitizedData).toHaveLength(0);
        });

        test('should handle non-array input', () => {
            const result = validateMerchants(validMerchant);
            
            expect(result.isValid).toBe(true);
            expect(result.validCount).toBe(1);
            expect(result.sanitizedData).toHaveLength(1);
        });
    });

    describe('generateScrapeId function', () => {
        test('should generate unique scrape IDs', () => {
            const id1 = generateScrapeId();
            const id2 = generateScrapeId();
            
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(0);
        });

        test('should include timestamp in ID', () => {
            const id = generateScrapeId();
            const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            
            expect(id).toContain(timestamp.replace(/-/g, ''));
        });
    });

    describe('Real-world validation scenarios', () => {
        test('should handle merchant with partial data', () => {
            const partialMerchant = {
                merchantName: 'TestMerchant',
                totalOrders: '100',
                completionRate: '95%'
                // Missing other fields
            };
            
            const result = validateData(partialMerchant);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        test('should sanitize and normalize data', () => {
            const messyMerchant = {
                merchantName: '<script>TestMerchant</script>',
                totalOrders: '$1,234 orders',
                completionRate: '99.5 percent',
                avgReleaseTime: '2 minutes',
                positiveRating: '98.5 %',
                currency: 'usd',
                paymentMethods: ['Bank Transfer'],
                minOrder: '$50.00',
                maxOrder: '$10,000.00',
                exchangeRate: '1.05',
                isOnline: true,
                lastActive: '2 minutes ago'
            };
            
            const result = validateData(messyMerchant);
            if (result.sanitizedData) {
                expect(result.sanitizedData.merchantName).not.toContain('<script>');
                expect(result.sanitizedData.currency).toBe('USD');
            }
        });

        test('should handle edge cases for numeric fields', () => {
            const edgeCaseMerchant = {
                ...validMerchant,
                totalOrders: '0',
                completionRate: '0%',
                positiveRating: '100%',
                exchangeRate: 0.001
            };
            
            const result = validateData(edgeCaseMerchant);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Performance and large data handling', () => {
        test('should handle large arrays efficiently', () => {
            const largeMerchantArray = Array(100).fill(validMerchant);
            const startTime = Date.now();
            
            const result = validateMerchants(largeMerchantArray);
            const endTime = Date.now();
            
            expect(result.isValid).toBe(true);
            expect(result.validCount).toBe(100);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
        });
    });
});
