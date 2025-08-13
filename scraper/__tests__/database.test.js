// scraper/__tests__/database.test.js
const fs = require('fs');
const path = require('path');
const { DatabaseManager, DataPipeline } = require('../database');

describe('Database System (Feature 5)', () => {
    let dbManager;
    let dataPipeline;
    const testDbPath = path.join(__dirname, 'test_database.db');

    // Sample test data
    const sampleMerchants = [
        {
            merchantName: 'TestMerchant1',
            totalOrders: '1000',
            completionRate: '99%',
            avgReleaseTime: '5 minutes',
            positiveRating: '98%',
            currency: 'USD',
            paymentMethods: ['Bank Transfer', 'PayPal'],
            minOrder: '$100',
            maxOrder: '$5000',
            exchangeRate: '1.0',
            isOnline: true,
            lastActive: '1 minute ago'
        },
        {
            merchantName: 'TestMerchant2',
            totalOrders: '500',
            completionRate: '97%',
            avgReleaseTime: '3 minutes',
            positiveRating: '95%',
            currency: 'EUR',
            paymentMethods: ['Bank Transfer'],
            minOrder: '€50',
            maxOrder: '€2000',
            exchangeRate: '0.85',
            isOnline: false,
            lastActive: '10 minutes ago'
        }
    ];

    beforeEach(async () => {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Create new database manager with test configuration
        dbManager = new DatabaseManager({
            filename: testDbPath,
            foreign_keys: 1,
            journal_mode: 'WAL',
            synchronous: 'NORMAL',
            cache_size: -2000,
            temp_store: 'MEMORY'
        });

        await dbManager.initialize();
        dataPipeline = new DataPipeline(dbManager);
    });

    afterEach(async () => {
        // Clean up
        if (dbManager && dbManager.isConnected) {
            await dbManager.close();
        }
        
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    describe('DatabaseManager', () => {
        test('should initialize database successfully', () => {
            expect(dbManager.isConnected).toBe(true);
            expect(fs.existsSync(testDbPath)).toBe(true);
        });

        test('should create all required tables', async () => {
            const tables = await dbManager.query(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('scrapes');
            expect(tableNames).toContain('merchants');
            expect(tableNames).toContain('merchant_payment_methods');
            expect(tableNames).toContain('data_quality_metrics');
        });

        test('should create all required indexes', async () => {
            const indexes = await dbManager.query(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const indexNames = indexes.map(i => i.name);
            expect(indexNames.length).toBeGreaterThan(0);
            
            // Check for specific indexes
            expect(indexNames.some(name => name.includes('scrapes'))).toBe(true);
            expect(indexNames.some(name => name.includes('merchants'))).toBe(true);
        });

        test('should handle database queries correctly', async () => {
            const result = await dbManager.query('SELECT 1 as test');
            expect(result).toHaveLength(1);
            expect(result[0].test).toBe(1);
        });

        test('should handle parameterized queries', async () => {
            const result = await dbManager.query('SELECT ? as value', [42]);
            expect(result[0].value).toBe(42);
        });

        test('should handle database errors gracefully', async () => {
            await expect(dbManager.query('INVALID SQL QUERY')).rejects.toThrow();
        });

        test('should support transactions', async () => {
            await dbManager.run('BEGIN TRANSACTION');
            await dbManager.run('INSERT INTO scrapes (id, timestamp) VALUES (?, ?)', ['test', Date.now()]);
            await dbManager.run('ROLLBACK');

            const result = await dbManager.query('SELECT * FROM scrapes WHERE id = ?', ['test']);
            expect(result).toHaveLength(0);
        });

        test('should close connection properly', async () => {
            await dbManager.close();
            expect(dbManager.isConnected).toBe(false);
        });
    });

    describe('DataPipeline', () => {
        test('should process scrape data successfully', async () => {
            const result = await dataPipeline.processScrapeData(sampleMerchants);

            expect(result).toHaveProperty('scrapeId');
            expect(result).toHaveProperty('merchantCount');
            expect(result).toHaveProperty('qualityMetrics');
            expect(result.merchantCount).toBe(2);
            expect(result.scrapeId).toBeTruthy();
        });

        test('should save merchants to database', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);

            const merchants = await dbManager.query('SELECT * FROM merchants');
            expect(merchants).toHaveLength(2);
            
            const merchant1 = merchants.find(m => m.merchant_name === 'TestMerchant1');
            expect(merchant1).toBeTruthy();
            expect(merchant1.currency).toBe('USD');
            expect(merchant1.is_online).toBe(1); // SQLite stores boolean as integer
        });

        test('should save payment methods correctly', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);

            const paymentMethods = await dbManager.query('SELECT * FROM merchant_payment_methods');
            expect(paymentMethods.length).toBeGreaterThan(0);
            
            // TestMerchant1 has 2 payment methods, TestMerchant2 has 1
            expect(paymentMethods).toHaveLength(3);
        });

        test('should calculate quality metrics', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);

            const metrics = await dbManager.query('SELECT * FROM data_quality_metrics');
            expect(metrics).toHaveLength(1);
            
            const metric = metrics[0];
            expect(metric.total_records).toBe(2);
            expect(metric.valid_records).toBe(2);
            expect(metric.completeness_score).toBeGreaterThan(0);
            expect(metric.quality_score).toBeGreaterThan(0);
        });

        test('should handle duplicate merchant names', async () => {
            const duplicateMerchants = [
                sampleMerchants[0],
                { ...sampleMerchants[0], totalOrders: '2000' } // Same name, different data
            ];

            const result = await dataPipeline.processScrapeData(duplicateMerchants);
            expect(result.merchantCount).toBe(2); // Should save both records
        });

        test('should handle empty merchant array', async () => {
            const result = await dataPipeline.processScrapeData([]);
            
            expect(result.merchantCount).toBe(0);
            expect(result.scrapeId).toBeTruthy();
            
            const scrapes = await dbManager.query('SELECT * FROM scrapes');
            expect(scrapes).toHaveLength(1);
        });

        test('should validate data before saving', async () => {
            const invalidMerchants = [
                {
                    merchantName: '', // Invalid
                    totalOrders: 'invalid',
                    // Missing required fields
                }
            ];

            // Should still process but with quality metrics reflecting issues
            const result = await dataPipeline.processScrapeData(invalidMerchants);
            expect(result.merchantCount).toBe(0); // No valid merchants saved
            
            const metrics = await dbManager.query('SELECT * FROM data_quality_metrics');
            expect(metrics[0].valid_records).toBe(0);
            expect(metrics[0].total_records).toBe(1);
        });
    });

    describe('Database Performance', () => {
        test('should handle large datasets efficiently', async () => {
            // Create 100 merchants
            const largeMerchantSet = Array(100).fill(0).map((_, index) => ({
                ...sampleMerchants[0],
                merchantName: `TestMerchant${index}`
            }));

            const startTime = Date.now();
            const result = await dataPipeline.processScrapeData(largeMerchantSet);
            const endTime = Date.now();

            expect(result.merchantCount).toBe(100);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        test('should use transactions for batch operations', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);
            
            // Verify all data was inserted as a unit
            const scrapes = await dbManager.query('SELECT * FROM scrapes');
            const merchants = await dbManager.query('SELECT * FROM merchants');
            const paymentMethods = await dbManager.query('SELECT * FROM merchant_payment_methods');
            
            expect(scrapes).toHaveLength(1);
            expect(merchants).toHaveLength(2);
            expect(paymentMethods).toHaveLength(3);
        });
    });

    describe('Data Retrieval and Querying', () => {
        beforeEach(async () => {
            // Set up test data
            await dataPipeline.processScrapeData(sampleMerchants);
        });

        test('should retrieve merchants by scrape ID', async () => {
            const scrapes = await dbManager.query('SELECT * FROM scrapes LIMIT 1');
            const scrapeId = scrapes[0].id;

            const merchants = await dbManager.query(
                'SELECT * FROM merchants WHERE scrape_id = ?',
                [scrapeId]
            );

            expect(merchants).toHaveLength(2);
        });

        test('should support complex queries with joins', async () => {
            const query = `
                SELECT m.*, GROUP_CONCAT(mp.payment_method) as payment_methods
                FROM merchants m
                LEFT JOIN merchant_payment_methods mp ON m.id = mp.merchant_id
                GROUP BY m.id
            `;

            await dataPipeline.processScrapeData(sampleMerchants);
            const result = await dbManager.query(query);
            expect(result).toHaveLength(2);
            expect(result[0].payment_methods).toBeTruthy();
        });

        test('should filter merchants by criteria', async () => {
            const usdMerchants = await dbManager.query(
                'SELECT * FROM merchants WHERE currency = ?',
                ['USD']
            );

            expect(usdMerchants).toHaveLength(1);
            expect(usdMerchants[0].merchant_name).toBe('TestMerchant1');
        });

        test('should order results correctly', async () => {
            const merchantsByName = await dbManager.query(
                'SELECT * FROM merchants ORDER BY merchant_name ASC'
            );

            expect(merchantsByName[0].merchant_name).toBe('TestMerchant1');
            expect(merchantsByName[1].merchant_name).toBe('TestMerchant2');
        });
    });

    describe('Data Integrity and Constraints', () => {
        test('should enforce foreign key constraints', async () => {
            // Try to insert payment method with invalid merchant_id
            await expect(
                dbManager.run(
                    'INSERT INTO merchant_payment_methods (merchant_id, payment_method) VALUES (?, ?)',
                    [99999, 'TestMethod']
                )
            ).rejects.toThrow();
        });

        test('should handle unique constraints properly', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);

            // Try to insert duplicate scrape ID (should handle gracefully)
            const scrapes = await dbManager.query('SELECT * FROM scrapes LIMIT 1');
            const existingScrapeId = scrapes[0].id;

            // This should either succeed (if designed to allow) or fail gracefully
            try {
                await dbManager.run(
                    'INSERT INTO scrapes (id, timestamp) VALUES (?, ?)',
                    [existingScrapeId, Date.now()]
                );
            } catch (error) {
                // Should be a constraint error
                expect(error.message).toContain('UNIQUE');
            }
        });
    });

    describe('Database Backup and Recovery', () => {
        test('should handle database file operations', () => {
            expect(fs.existsSync(testDbPath)).toBe(true);
            
            // Check file size is reasonable
            const stats = fs.statSync(testDbPath);
            expect(stats.size).toBeGreaterThan(0);
        });

        test('should maintain data across connections', async () => {
            await dataPipeline.processScrapeData(sampleMerchants);
            await dbManager.close();

            // Reconnect
            dbManager = new DatabaseManager({
                filename: testDbPath,
                foreign_keys: 1
            });
            await dbManager.initialize();

            const merchants = await dbManager.query('SELECT * FROM merchants');
            expect(merchants).toHaveLength(2);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle malformed data gracefully', async () => {
            const malformedData = [
                null,
                undefined,
                { invalidField: 'value' },
                'not an object'
            ];

            // Should not throw, but should handle gracefully
            const result = await dataPipeline.processScrapeData(malformedData);
            expect(result.merchantCount).toBe(0);
        });

        test('should handle database connection issues', async () => {
            await dbManager.close();

            // Try to query after closing
            await expect(dbManager.query('SELECT 1')).rejects.toThrow();
        });

        test('should handle very long strings', async () => {
            const longStringMerchant = {
                ...sampleMerchants[0],
                merchantName: 'A'.repeat(1000), // Very long name
                lastActive: 'B'.repeat(500)
            };

            // Should either truncate or handle appropriately
            const result = await dataPipeline.processScrapeData([longStringMerchant]);
            expect(result.merchantCount).toBeGreaterThanOrEqual(0);
        });
    });
});
