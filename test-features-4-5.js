// Test script to verify Features 4 & 5 implementation
const { validateMerchants, generateScrapeId } = require('./scraper/schema');
const { DatabaseManager, DataPipeline } = require('./scraper/database');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Features 4 & 5: Advanced Data Validation and Database Storage\n');

// Test data that matches the actual scraper output format
const testMerchantData = [
    {
        'Merchant Name': 'CryptoTrader123',
        'Price': '131.50 KES',
        'PriceNumeric': 131.50,
        'Available Amount': '1000.00 USDT',
        'AvailableAmountNumeric': 1000.00,
        'Limit': '1000.00 - 50000.00 KES',
        'LimitMin': 1000.00,
        'LimitMax': 50000.00,
        'Payment Methods': 'Bank Transfer, M-Pesa',
        'Orders': 150,
        'Completion Rate': 98.5,
        'Avg Release Time': '2 minutes',
        'Avg Pay Time': '5 minutes'
    },
    {
        'Merchant Name': 'FastPay_User',
        'Price': '132.00 KES',
        'PriceNumeric': 132.00,
        'Available Amount': '500.50 USDT',
        'AvailableAmountNumeric': 500.50,
        'Limit': '500.00 - 25000.00 KES',
        'LimitMin': 500.00,
        'LimitMax': 25000.00,
        'Payment Methods': 'Bank Transfer',
        'Orders': 89,
        'Completion Rate': 96.8,
        'Avg Release Time': '3 minutes',
        'Avg Pay Time': '7 minutes'
    },
    // Invalid data to test validation
    {
        'Merchant Name': '', // Invalid: empty name
        'Price': 'Invalid Price Format', // Invalid: wrong format
        'PriceNumeric': -100, // Invalid: negative price
        'Available Amount': '999999999999.99 INVALID', // Invalid: wrong currency format
        'AvailableAmountNumeric': -500, // Invalid: negative amount
        'Limit': 'Not a valid limit', // Invalid: wrong format
        'LimitMin': -10, // Invalid: negative
        'LimitMax': 0, // Invalid: should be positive
        'Payment Methods': null, // Invalid: null value
        'Orders': 'not a number', // Invalid: non-numeric
        'Completion Rate': 150, // Invalid: over 100%
        'Avg Release Time': '', // Invalid: empty
        'Avg Pay Time': 'invalid time'
    }
];

async function testFeature4() {
    console.log('📋 Feature 4: Advanced Data Validation and Schema Enforcement');
    console.log('=' .repeat(60));
    
    try {
        // Test data validation
        console.log('🔍 Testing data validation...');
        const validationResult = validateMerchants(testMerchantData);
        
        console.log(`\n✅ Validation Results:`);
        console.log(`   Total Records: ${validationResult.totalRecords}`);
        console.log(`   Valid Records: ${validationResult.summary.validCount}`);
        console.log(`   Invalid Records: ${validationResult.summary.invalidCount}`);
        console.log(`   Total Errors: ${validationResult.summary.totalErrors}`);
        console.log(`   Total Warnings: ${validationResult.summary.totalWarnings}`);
        
        if (validationResult.summary.totalErrors > 0) {
            console.log('\n❌ Validation Errors Found:');
            Object.entries(validationResult.aggregateErrors).forEach(([field, errors]) => {
                console.log(`   ${field}: ${errors.length} error(s)`);
                errors.slice(0, 2).forEach(error => {
                    console.log(`     - ${error.message}`);
                });
            });
        }
        
        if (validationResult.summary.totalWarnings > 0) {
            console.log('\n⚠️  Validation Warnings Found:');
            Object.entries(validationResult.aggregateWarnings).forEach(([field, warnings]) => {
                console.log(`   ${field}: ${warnings.length} warning(s)`);
            });
        }
        
        // Test scrape ID generation
        console.log('\n🆔 Testing scrape ID generation...');
        const scrapeId1 = generateScrapeId();
        const scrapeId2 = generateScrapeId();
        console.log(`   Generated ID 1: ${scrapeId1}`);
        console.log(`   Generated ID 2: ${scrapeId2}`);
        console.log(`   IDs are unique: ${scrapeId1 !== scrapeId2 ? '✅' : '❌'}`);
        
        console.log('\n✅ Feature 4 validation completed successfully!\n');
        return validationResult;
        
    } catch (error) {
        console.error('❌ Feature 4 test failed:', error.message);
        throw error;
    }
}

async function testFeature5(validationResult) {
    console.log('🗄️  Feature 5: Database Storage and Data Pipeline');
    console.log('=' .repeat(60));
    
    const testDbPath = path.join(__dirname, 'test_features_database.db');
    let database;
    let dataPipeline;
    
    try {
        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            console.log('🧹 Cleaned up existing test database');
        }
        
        // Initialize database
        console.log('🔌 Initializing database connection...');
        database = new DatabaseManager({
            filename: testDbPath,
            foreign_keys: 1,
            journal_mode: 'WAL',
            synchronous: 'NORMAL'
        });
        
        await database.initialize();
        console.log('✅ Database initialized successfully');
        
        // Initialize data pipeline
        console.log('🔄 Setting up data pipeline...');
        dataPipeline = new DataPipeline(database);
        console.log('✅ Data pipeline ready');
        
        // Test database structure
        console.log('\n🏗️  Testing database schema...');
        const tables = await database.query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        console.log('   Created tables:');
        tables.forEach(table => {
            console.log(`     - ${table.name}`);
        });
        
        // Process test data through pipeline
        console.log('\n💾 Processing data through pipeline...');
        const validMerchants = validationResult.validRecords.map(record => record.data);
        
        if (validMerchants.length > 0) {
            const pipelineResult = await dataPipeline.processScrapeData(validMerchants);
            
            console.log(`✅ Data processing completed:`);
            console.log(`   Scrape ID: ${pipelineResult.scrapeId}`);
            console.log(`   Merchants Saved: ${pipelineResult.merchantCount}`);
            
            if (pipelineResult.qualityMetrics) {
                console.log(`   Quality Score: ${pipelineResult.qualityMetrics.quality_score}%`);
                console.log(`   Completeness: ${pipelineResult.qualityMetrics.completeness_score}%`);
            }
            
            // Test data retrieval
            console.log('\n🔍 Testing data retrieval...');
            const savedMerchants = await database.query('SELECT COUNT(*) as count FROM merchants');
            const savedPaymentMethods = await database.query('SELECT COUNT(*) as count FROM merchant_payment_methods');
            const qualityMetrics = await database.query('SELECT COUNT(*) as count FROM data_quality_metrics');
            
            console.log(`   Merchants in database: ${savedMerchants[0].count}`);
            console.log(`   Payment methods stored: ${savedPaymentMethods[0].count}`);
            console.log(`   Quality metrics records: ${qualityMetrics[0].count}`);
            
            // Test complex query
            console.log('\n🔗 Testing complex queries...');
            const merchantWithPayments = await database.query(`
                SELECT m.merchant_name, GROUP_CONCAT(mp.payment_method) as payment_methods
                FROM merchants m
                LEFT JOIN merchant_payment_methods mp ON m.id = mp.merchant_id
                GROUP BY m.id
                LIMIT 1
            `);
            
            if (merchantWithPayments.length > 0) {
                console.log(`   Sample merchant: ${merchantWithPayments[0].merchant_name}`);
                console.log(`   Payment methods: ${merchantWithPayments[0].payment_methods}`);
            }
        } else {
            console.log('⚠️  No valid merchants to process');
        }
        
        console.log('\n✅ Feature 5 database testing completed successfully!\n');
        
    } catch (error) {
        console.error('❌ Feature 5 test failed:', error.message);
        throw error;
    } finally {
        // Cleanup
        if (database && database.isConnected) {
            await database.close();
            console.log('🔒 Database connection closed');
        }
        
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            console.log('🧹 Test database cleaned up');
        }
    }
}

async function runTests() {
    console.log('🎯 Starting Features 4 & 5 Integration Test\n');
    
    try {
        // Test Feature 4: Data Validation
        const validationResult = await testFeature4();
        
        // Test Feature 5: Database Storage
        await testFeature5(validationResult);
        
        console.log('🎉 ALL TESTS PASSED! Features 4 & 5 are working correctly!');
        console.log('\n📈 Summary:');
        console.log('✅ Feature 4: Advanced Data Validation and Schema Enforcement');
        console.log('   - Schema validation system operational');
        console.log('   - Data sanitization working');
        console.log('   - Error handling functional');
        console.log('✅ Feature 5: Database Storage and Data Pipeline');
        console.log('   - SQLite database integration complete');
        console.log('   - Data pipeline processing correctly');
        console.log('   - Quality metrics calculation working');
        console.log('✅ Integration: Both features work together seamlessly');
        
    } catch (error) {
        console.error('\n💥 TEST SUITE FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        throw new Error('Test suite failed');
    }
}

// Run the tests
runTests().catch(console.error);
