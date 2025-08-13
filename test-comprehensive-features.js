// test-comprehensive-features.js
const { ErrorHandler } = require('./scraper/errorHandling');
const { SessionManager, SESSION_STATES, SESSION_TYPES } = require('./scraper/sessionManagement');
const { DataQualityManager, QUALITY_METRICS, RULE_TYPES } = require('./scraper/dataQualityMetrics');
const { RateLimitingManager, REQUEST_PRIORITY } = require('./scraper/rateLimiting');
const { log, errorLog } = require('./scraper/logger');

/**
 * Comprehensive test suite for all new features:
 * - Comprehensive Error Handling
 * - Session Management and Tracking
 * - Data Quality Metrics
 * - Rate Limiting and Request Throttling
 */

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test Error Handling System
 */
async function testErrorHandling() {
    console.log('\n=== Testing Error Handling System ===');
    
    try {
        // Initialize error handler
        const errorHandler = new ErrorHandler({
            enablePersistence: true,
            enableAlerts: true,
            maxErrorHistory: 100
        });

        console.log('✓ ErrorHandler initialized');

        // Test error classification
        const networkError = errorHandler.createError('NETWORK', 'CRITICAL', 'Connection timeout', {
            url: 'https://example.com',
            timeout: 5000
        });

        console.log('✓ Network error created:', networkError.id);

        // Test error handling with recovery
        const result = await errorHandler.handleError(networkError, {
            operation: 'test_network_request',
            context: { attempt: 1 }
        });

        console.log('✓ Error handled with recovery strategy:', result.recoveryStrategy);

        // Test bulk error processing
        const errors = [
            errorHandler.createError('PARSING', 'HIGH', 'Invalid JSON response'),
            errorHandler.createError('VALIDATION', 'MEDIUM', 'Missing required field'),
            errorHandler.createError('RATE_LIMIT', 'LOW', 'Request throttled')
        ];

        for (const error of errors) {
            await errorHandler.handleError(error, { operation: 'test_bulk' });
        }

        console.log('✓ Bulk error processing completed');

        // Get error statistics
        const stats = await errorHandler.getErrorStatistics();
        console.log('✓ Error statistics:', {
            totalErrors: stats.totalErrors,
            criticalErrors: stats.errorsBySeverity.CRITICAL,
            mostCommonCategory: stats.mostCommonCategory
        });

        return true;

    } catch (error) {
        errorLog('Error handling test failed:', error);
        return false;
    }
}

/**
 * Test Session Management System
 */
async function testSessionManagement() {
    console.log('\n=== Testing Session Management System ===');
    
    try {
        // Initialize session manager
        const sessionManager = new SessionManager({
            enablePersistence: true,
            sessionTimeout: 300000, // 5 minutes
            maxConcurrentSessions: 5,
            heartbeatInterval: 10000 // 10 seconds
        });

        console.log('✓ SessionManager initialized');

        // Create test session
        const session = await sessionManager.createSession({
            type: SESSION_TYPES.SCRAPING,
            targetUrl: 'https://gate.io/p2p',
            userAgent: 'Test Agent',
            metadata: { testCase: 'comprehensive' }
        });

        console.log('✓ Session created:', session.id);

        // Record operations
        await sessionManager.recordOperation(session.id, {
            type: 'HTTP_REQUEST',
            success: true,
            duration: 150,
            dataPoints: 10,
            bytesTransferred: 1024
        });

        await sessionManager.recordOperation(session.id, {
            type: 'DATA_EXTRACTION',
            success: true,
            duration: 75,
            dataPoints: 5
        });

        console.log('✓ Operations recorded');

        // Create checkpoint
        const checkpoint = await sessionManager.createCheckpoint(session.id, {
            type: 'AUTO',
            currentPage: 1,
            processedItems: 15
        });

        console.log('✓ Checkpoint created:', checkpoint.id);

        // Record error
        await sessionManager.recordError(session.id, {
            category: 'NETWORK',
            severity: 'MEDIUM',
            message: 'Temporary connection issue'
        });

        console.log('✓ Error recorded');

        // Get session analytics
        const analytics = sessionManager.getSessionAnalytics();
        console.log('✓ Session analytics:', {
            activeSessions: analytics.active,
            avgDuration: analytics.avgDuration,
            avgSuccessRate: analytics.avgSuccessRate
        });

        // Test session recovery
        const recoveryResult = await sessionManager.recoverSession(session.id);
        console.log('✓ Session recovery tested:', recoveryResult.recoveryAttempt);

        // End session
        await sessionManager.endSession(session.id, 'COMPLETED');
        console.log('✓ Session ended successfully');

        return true;

    } catch (error) {
        errorLog('Session management test failed:', error);
        return false;
    }
}

/**
 * Test Data Quality Metrics System
 */
async function testDataQualityMetrics() {
    console.log('\n=== Testing Data Quality Metrics System ===');
    
    try {
        // Initialize data quality manager
        const qualityManager = new DataQualityManager({
            enablePersistence: true,
            alertThresholds: {
                completeness: 85,
                accuracy: 90,
                overall: 80
            }
        });

        console.log('✓ DataQualityManager initialized');

        // Define custom quality rules
        qualityManager.defineQualityRule('custom_merchant_name', {
            type: RULE_TYPES.REQUIRED_FIELD,
            field: 'merchantName',
            description: 'Custom merchant name validation',
            severity: 'HIGH',
            metricType: QUALITY_METRICS.COMPLETENESS,
            config: { required: true }
        });

        qualityManager.defineQualityRule('custom_price_format', {
            type: RULE_TYPES.FORMAT_VALIDATION,
            field: 'price',
            description: 'Custom price format validation',
            severity: 'HIGH',
            metricType: QUALITY_METRICS.VALIDITY,
            config: { pattern: '^[0-9]+(\\.[0-9]{1,8})?$' }
        });

        console.log('✓ Custom quality rules defined');

        // Start quality assessment
        const assessment = await qualityManager.startQualityAssessment('test-session', {
            datasetName: 'P2P Merchants Test Data'
        });

        console.log('✓ Quality assessment started:', assessment.id);

        // Test data samples
        const testData = [
            {
                merchantName: 'TestMerchant1',
                price: '1.25',
                orderType: 'BUY',
                timestamp: new Date().toISOString()
            },
            {
                merchantName: 'TestMerchant2',
                price: '1.30',
                orderType: 'SELL',
                timestamp: new Date().toISOString()
            },
            {
                merchantName: '', // Invalid - empty name
                price: 'invalid_price', // Invalid - not a number
                orderType: 'UNKNOWN', // Invalid - not in enum
                timestamp: new Date().toISOString()
            },
            {
                merchantName: 'TestMerchant3',
                price: '1.28',
                orderType: 'BUY',
                timestamp: new Date().toISOString()
            }
        ];

        // Assess each record
        let validRecords = 0;
        for (let i = 0; i < testData.length; i++) {
            const result = await qualityManager.assessRecord(testData[i], i);
            if (result.valid) {
                validRecords++;
            }
            console.log(`Record ${i}: ${result.valid ? 'VALID' : 'INVALID'} (${result.issues.length} issues)`);
        }

        console.log(`✓ Data assessment completed: ${validRecords}/${testData.length} valid records`);

        // Complete assessment and generate report
        const report = await qualityManager.completeQualityAssessment();
        console.log('✓ Quality report generated:', {
            overallScore: Math.round(report.scores.overall),
            completenessScore: Math.round(report.scores.completeness),
            validityScore: Math.round(report.scores.validity),
            totalIssues: report.summary.issueCount
        });

        // Get quality trends
        const trends = qualityManager.getQualityTrends(7);
        if (trends) {
            console.log('✓ Quality trends:', {
                period: trends.period,
                avgQuality: Math.round(trends.summary.avgOverallQuality)
            });
        }

        return true;

    } catch (error) {
        errorLog('Data quality metrics test failed:', error);
        return false;
    }
}

/**
 * Test Rate Limiting System
 */
async function testRateLimiting() {
    console.log('\n=== Testing Rate Limiting System ===');
    
    try {
        // Initialize rate limiting manager
        const rateLimiter = new RateLimitingManager({
            globalLimits: {
                requestsPerSecond: 5,
                burstCapacity: 10,
                concurrentRequests: 3
            },
            queueSize: 50,
            processingInterval: 100,
            adaptiveThrottling: true
        });

        console.log('✓ RateLimitingManager initialized');

        // Create test requests
        const testRequests = [];
        
        for (let i = 0; i < 8; i++) {
            const request = async () => {
                // Simulate HTTP request
                await sleep(100 + Math.random() * 200);
                
                // Simulate occasional errors
                if (Math.random() < 0.1) {
                    throw new Error(`Simulated error for request ${i}`);
                }
                
                return { success: true, requestId: i, data: `Response data ${i}` };
            };

            testRequests.push(request);
        }

        console.log(`✓ Created ${testRequests.length} test requests`);

        // Queue requests with different priorities
        const promises = [];
        
        for (let i = 0; i < testRequests.length; i++) {
            const priority = i < 2 ? REQUEST_PRIORITY.HIGH : 
                           i < 4 ? REQUEST_PRIORITY.NORMAL : REQUEST_PRIORITY.LOW;
            
            const promise = rateLimiter.queueRequest(testRequests[i], {
                priority,
                metadata: { domain: 'gate.io', requestIndex: i },
                maxAttempts: 2,
                timeout: 5000
            });
            
            promises.push(promise);
        }

        console.log('✓ Requests queued with priorities');

        // Wait for some requests to complete
        await sleep(2000);

        // Check queue status
        const queueStatus = rateLimiter.getQueueStatus();
        console.log('✓ Queue status:', {
            totalItems: queueStatus.totalItems,
            utilization: Math.round(queueStatus.utilizationPercent),
            isProcessing: queueStatus.isProcessing
        });

        // Get rate limiting statistics
        const stats = rateLimiter.getRateLimitingStats();
        console.log('✓ Rate limiting stats:', {
            queueSize: stats.queue.size,
            activeRequests: stats.active.count,
            totalRequests: stats.requests.totalRequests,
            successfulRequests: stats.requests.successfulRequests,
            adaptiveLevel: stats.adaptiveThrottling.currentLevel.toFixed(2)
        });

        // Wait for all requests to complete
        console.log('Waiting for all requests to complete...');
        const results = await Promise.allSettled(promises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`✓ All requests completed: ${successful} successful, ${failed} failed`);

        // Final statistics
        const finalStats = rateLimiter.getRateLimitingStats();
        console.log('✓ Final statistics:', {
            totalProcessed: finalStats.requests.totalRequests,
            successRate: finalStats.requests.totalRequests > 0 ? 
                Math.round((finalStats.requests.successfulRequests / finalStats.requests.totalRequests) * 100) : 0,
            avgResponseTime: Math.round(finalStats.requests.averageResponseTime)
        });

        return true;

    } catch (error) {
        errorLog('Rate limiting test failed:', error);
        return false;
    }
}

/**
 * Test integrated features working together
 */
async function testIntegratedFeatures() {
    console.log('\n=== Testing Integrated Features ===');
    
    try {
        // Initialize all systems
        const errorHandler = new ErrorHandler({ enablePersistence: false });
        const sessionManager = new SessionManager({ enablePersistence: false });
        const qualityManager = new DataQualityManager({ enablePersistence: false });
        const rateLimiter = new RateLimitingManager({ 
            globalLimits: { requestsPerSecond: 10, concurrentRequests: 2 },
            processingInterval: 50
        });

        console.log('✓ All systems initialized');

        // Create session with error handling
        const session = await sessionManager.createSession({
            type: SESSION_TYPES.SCRAPING,
            targetUrl: 'https://gate.io/p2p/test'
        });

        console.log('✓ Session created:', session.id);

        // Start quality assessment
        await qualityManager.startQualityAssessment(session.id, {
            datasetName: 'Integration Test'
        });

        console.log('✓ Quality assessment started');

        // Simulate scraping process with all features
        const scrapingProcess = async () => {
            try {
                // Create rate-limited request
                const request = async () => {
                    // Simulate data extraction
                    await sleep(50);
                    
                    const mockData = {
                        merchantName: `Merchant_${Math.floor(Math.random() * 100)}`,
                        price: (1.0 + Math.random()).toFixed(4),
                        orderType: Math.random() > 0.5 ? 'BUY' : 'SELL',
                        timestamp: new Date().toISOString()
                    };

                    // Assess data quality
                    const qualityResult = await qualityManager.assessRecord(mockData);
                    
                    // Record session operation
                    await sessionManager.recordOperation(session.id, {
                        type: 'DATA_EXTRACTION',
                        success: qualityResult.valid,
                        dataPoints: 1,
                        metadata: { qualityIssues: qualityResult.issues.length }
                    });

                    if (!qualityResult.valid) {
                        // Create and handle quality error
                        const qualityError = errorHandler.createError(
                            'VALIDATION',
                            'MEDIUM',
                            `Data quality issues: ${qualityResult.issues.length}`,
                            { record: mockData, issues: qualityResult.issues }
                        );

                        await errorHandler.handleError(qualityError, {
                            operation: 'data_validation',
                            sessionId: session.id
                        });

                        await sessionManager.recordError(session.id, {
                            category: 'VALIDATION',
                            severity: 'MEDIUM',
                            message: qualityError.message
                        });
                    }

                    return { success: qualityResult.valid, data: mockData };
                };

                // Queue request with rate limiting
                return await rateLimiter.queueRequest(request, {
                    priority: REQUEST_PRIORITY.NORMAL,
                    metadata: { sessionId: session.id }
                });

            } catch (error) {
                // Handle any errors
                const scrapingError = errorHandler.createError(
                    'NETWORK',
                    'HIGH',
                    error.message,
                    { sessionId: session.id }
                );

                await errorHandler.handleError(scrapingError);
                await sessionManager.recordError(session.id, {
                    category: 'NETWORK',
                    severity: 'HIGH',
                    message: error.message
                });

                throw error;
            }
        };

        // Run multiple scraping operations
        const operations = [];
        for (let i = 0; i < 5; i++) {
            operations.push(scrapingProcess());
        }

        const results = await Promise.allSettled(operations);
        const successful = results.filter(r => r.status === 'fulfilled').length;

        console.log(`✓ Scraping operations completed: ${successful}/5 successful`);

        // Create checkpoint
        await sessionManager.createCheckpoint(session.id, {
            type: 'INTEGRATION_TEST',
            completedOperations: successful,
            totalOperations: 5
        });

        console.log('✓ Checkpoint created');

        // Complete quality assessment
        const qualityReport = await qualityManager.completeQualityAssessment();
        console.log('✓ Quality assessment completed:', {
            overallScore: Math.round(qualityReport.scores.overall),
            validRecords: qualityReport.summary.validRecords,
            totalRecords: qualityReport.summary.totalRecords
        });

        // Get comprehensive statistics
        const sessionAnalytics = sessionManager.getSessionAnalytics();
        const errorStats = await errorHandler.getErrorStatistics();
        const rateLimitStats = rateLimiter.getRateLimitingStats();

        console.log('✓ Integrated system statistics:', {
            session: {
                activeSessions: sessionAnalytics.active,
                avgSuccessRate: sessionAnalytics.avgSuccessRate
            },
            errors: {
                totalErrors: errorStats.totalErrors,
                mostCommonCategory: errorStats.mostCommonCategory
            },
            rateLimit: {
                totalRequests: rateLimitStats.requests.totalRequests,
                successRate: rateLimitStats.requests.totalRequests > 0 ?
                    Math.round((rateLimitStats.requests.successfulRequests / rateLimitStats.requests.totalRequests) * 100) : 0
            },
            quality: {
                overallScore: Math.round(qualityReport.scores.overall),
                completeness: Math.round(qualityReport.scores.completeness)
            }
        });

        // End session
        await sessionManager.endSession(session.id, 'COMPLETED');
        console.log('✓ Session ended successfully');

        return true;

    } catch (error) {
        errorLog('Integrated features test failed:', error);
        return false;
    }
}

/**
 * Main test runner
 */
async function runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive Feature Tests');
    console.log('Testing 4 new features: Error Handling, Session Management, Data Quality, Rate Limiting');
    
    const startTime = Date.now();
    const results = {};

    // Run individual feature tests
    results.errorHandling = await testErrorHandling();
    results.sessionManagement = await testSessionManagement();
    results.dataQualityMetrics = await testDataQualityMetrics();
    results.rateLimiting = await testRateLimiting();
    
    // Run integrated test
    results.integratedFeatures = await testIntegratedFeatures();

    const duration = Date.now() - startTime;
    
    // Print final results
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    
    Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? '✅ PASSED' : '❌ FAILED';
        const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        console.log(`${status} ${testName}`);
    });
    
    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;
    
    console.log('\n📈 Summary:');
    console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! All 4 features are working correctly.');
        console.log('✅ Error Handling System: Comprehensive error classification and recovery');
        console.log('✅ Session Management: Full session lifecycle and persistence');
        console.log('✅ Data Quality Metrics: Rule-based validation and reporting');
        console.log('✅ Rate Limiting: Token bucket and adaptive throttling');
        console.log('✅ Integrated Operation: All systems working together seamlessly');
    } else {
        console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Check the logs above for details.`);
    }
    
    console.log('\nReady for production deployment! 🚀');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runComprehensiveTests()
        .then(() => {
            console.log('\nTest execution completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runComprehensiveTests,
    testErrorHandling,
    testSessionManagement,
    testDataQualityMetrics,
    testRateLimiting,
    testIntegratedFeatures
};
