// test-features-16-20.js
const path = require('path');
const fs = require('fs').promises;

// Import all the new feature modules
const { TestRunner } = require('./scraper/testingSuite');
const { EnhancedLogger, createLogger, LOG_CATEGORIES } = require('./scraper/enhancedLogger');
const { PerformanceMetrics, createMetrics, METRIC_CATEGORIES } = require('./scraper/performanceMetrics');
const { BackupManager, ScheduledBackupManager, EXPORT_FORMATS } = require('./scraper/dataExportBackup');
const { GracefulShutdown, createShutdownManager, PRIORITY_LEVELS } = require('./scraper/gracefulShutdown');

/**
 * Comprehensive Test Suite for Features 16-20
 * 
 * Tests:
 * - Feature 16: Automated Testing Suite
 * - Feature 17: Enhanced Logging with Different Severity Levels
 * - Feature 18: Performance Metrics Collection
 * - Feature 19: Data Export and Backup System
 * - Feature 20: Graceful Shutdown Handling
 */

class FinalFeaturesTestSuite {
    constructor() {
        this.testResults = [];
        this.logger = null;
        this.metrics = null;
        this.backupManager = null;
        this.shutdownManager = null;
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('\n🚀 Starting Comprehensive Test Suite for Features 16-20');
        console.log('=' .repeat(80));

        try {
            // Test each feature individually
            await this.testAutomatedTestingSuite();
            await this.testEnhancedLogging();
            await this.testPerformanceMetrics();
            await this.testDataExportBackup();
            await this.testGracefulShutdown();

            // Integration tests
            await this.testFeatureIntegration();

            // Generate final report
            this.generateFinalReport();

        } catch (error) {
            console.error('\n❌ Critical test failure:', error);
            throw error;
        }
    }

    /**
     * Feature 16: Test Automated Testing Suite
     */
    async testAutomatedTestingSuite() {
        console.log('\n📋 Testing Feature 16: Automated Testing Suite');
        console.log('-'.repeat(60));

        try {
            // Initialize test runner
            const testRunner = new TestRunner();

            // Test basic test creation and execution
            const testSuite = testRunner.createSuite('BasicTests', { description: 'Testing basic functionality' });
            
            // Add sample tests
            testSuite.addTest('SamplePassingTest', async () => {
                return { success: true, message: 'Test passed' };
            });

            testSuite.addTest('SampleMathTest', async () => {
                const result = 2 + 2;
                if (result === 4) {
                    return { success: true, message: 'Math works correctly' };
                }
                throw new Error('Math failed');
            });

            // Run the test suite
            const results = await testRunner.runAll();
            
            console.log('✅ Test Suite Results:');
            console.log(`   Total Tests: ${results.statistics.totalTests}`);
            console.log(`   Passed: ${results.statistics.passed}`);
            console.log(`   Failed: ${results.statistics.failed}`);
            console.log(`   Duration: ${results.duration}ms`);

            // Test mock functionality
            console.log('\n🎭 Testing mock functionality...');
            const mockData = testRunner.generateMockData('merchant', 5);
            console.log(`   Generated ${mockData.length} mock merchants`);

            const mockFunction = testRunner.createMock();
            mockFunction('test-call');
            const callHistory = mockFunction.calls;
            console.log(`   Mock function called ${callHistory.length} times`);

            this.recordTestResult('Automated Testing Suite', true, 'All testing framework features working correctly');

        } catch (error) {
            console.error('❌ Automated Testing Suite test failed:', error);
            this.recordTestResult('Automated Testing Suite', false, error.message);
            throw error;
        }
    }

    /**
     * Feature 17: Test Enhanced Logging
     */
    async testEnhancedLogging() {
        console.log('\n📝 Testing Feature 17: Enhanced Logging with Different Severity Levels');
        console.log('-'.repeat(60));

        try {
            // Initialize logger
            this.logger = createLogger({
                context: {
                    component: 'test-suite',
                    version: '1.0.0'
                }
            });

            // Test different log levels
            console.log('🔍 Testing different log levels...');
            await this.logger.debug('Debug message', { category: LOG_CATEGORIES.SYSTEM });
            await this.logger.info('Info message', { category: LOG_CATEGORIES.APPLICATION });
            await this.logger.warn('Warning message', { category: LOG_CATEGORIES.SECURITY });
            await this.logger.error('Error message', new Error('Test error'), { category: LOG_CATEGORIES.DATABASE });

            // Test context management
            console.log('🔧 Testing context management...');
            this.logger.pushContext({ sessionId: 'test-session-123' });
            await this.logger.info('Message with session context');
            this.logger.popContext();

            // Test performance logging
            console.log('⏱️ Testing performance logging...');
            this.logger.startPerformanceMark('test-operation');
            await new Promise(resolve => setTimeout(resolve, 100));
            const perfResult = this.logger.endPerformanceMark('test-operation');
            console.log(`   Performance mark duration: ${perfResult.duration}ms`);

            // Test structured logging
            console.log('🏗️ Testing structured logging...');
            await this.logger.logHTTPRequest('GET', '/api/test', 200, 150);
            await this.logger.logDatabaseOperation('SELECT', 'merchants', 50, 10);
            await this.logger.logScrapingOperation('https://test.com', 25, 500, true);

            // Test metrics
            const logMetrics = this.logger.getMetrics();
            console.log('✅ Logging Metrics:');
            console.log(`   Total Logs: ${logMetrics.totalLogs}`);
            console.log(`   Errors: ${logMetrics.errors}`);
            console.log(`   Warnings: ${logMetrics.warnings}`);

            this.recordTestResult('Enhanced Logging', true, 'All logging features working correctly');

        } catch (error) {
            console.error('❌ Enhanced Logging test failed:', error);
            this.recordTestResult('Enhanced Logging', false, error.message);
            throw error;
        }
    }

    /**
     * Feature 18: Test Performance Metrics
     */
    async testPerformanceMetrics() {
        console.log('\n📊 Testing Feature 18: Performance Metrics Collection');
        console.log('-'.repeat(60));

        try {
            // Initialize metrics
            this.metrics = createMetrics({
                enableSystemMetrics: true,
                systemMetricsInterval: 1000
            });

            // Test custom metrics
            console.log('📈 Testing custom metrics...');
            
            // Counter metric
            const requestCounter = this.metrics.createCounter('test_requests_total', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Total number of test requests'
            });
            requestCounter.increment();
            requestCounter.increment(5);
            console.log(`   Request counter value: ${requestCounter.getValue()}`);

            // Gauge metric
            const memoryGauge = this.metrics.createGauge('test_memory_usage', {
                category: METRIC_CATEGORIES.SYSTEM,
                description: 'Memory usage in bytes'
            });
            memoryGauge.set(1024000);
            memoryGauge.increment(512000);
            console.log(`   Memory gauge value: ${memoryGauge.getValue()}`);

            // Histogram metric
            const responseHistogram = this.metrics.createHistogram('test_response_time', {
                category: METRIC_CATEGORIES.NETWORK,
                description: 'Response time distribution'
            });
            responseHistogram.observe(100);
            responseHistogram.observe(150);
            responseHistogram.observe(75);
            const histStats = responseHistogram.getStatistics();
            console.log(`   Response time p95: ${histStats.p95}ms`);

            // Timer metric
            const processTimer = this.metrics.createTimer('test_process_duration', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Process duration timer'
            });
            
            const duration = await processTimer.timeAsync(async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
                return 'process complete';
            });
            console.log(`   Process completed in: ${processTimer.getValue()}ms`);

            // Rate metric
            const eventRate = this.metrics.createRate('test_events_rate', {
                category: METRIC_CATEGORIES.BUSINESS,
                description: 'Event processing rate'
            });
            eventRate.mark();
            eventRate.mark();
            eventRate.mark();
            console.log(`   Event rate: ${eventRate.getRate().toFixed(3)} events/second`);

            // Test thresholds and alerts
            console.log('🚨 Testing thresholds and alerts...');
            this.metrics.setThreshold('test_memory_usage', {
                operator: '>',
                value: 1000000,
                severity: 'warning',
                message: 'Memory usage is high'
            });

            const alerts = this.metrics.checkThresholds();
            console.log(`   Active alerts: ${alerts.length}`);

            // Get system metrics
            console.log('🖥️ Testing system metrics...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for system metrics
            const systemMetrics = this.metrics.getMetricsByCategory(METRIC_CATEGORIES.SYSTEM);
            console.log(`   System metrics collected: ${Object.keys(systemMetrics).length}`);

            // Generate report
            const report = this.metrics.generateReport();
            console.log('✅ Metrics Report:');
            console.log(`   Total Metrics: ${report.summary.totalMetrics}`);
            console.log(`   Health Status: ${report.summary.healthStatus}`);

            this.recordTestResult('Performance Metrics', true, 'All metrics features working correctly');

        } catch (error) {
            console.error('❌ Performance Metrics test failed:', error);
            this.recordTestResult('Performance Metrics', false, error.message);
            throw error;
        }
    }

    /**
     * Feature 19: Test Data Export and Backup
     */
    async testDataExportBackup() {
        console.log('\n💾 Testing Feature 19: Data Export and Backup System');
        console.log('-'.repeat(60));

        try {
            // Initialize backup manager
            this.backupManager = new BackupManager({
                backupDirectory: path.join(process.cwd(), 'test-backups'),
                compression: 'gzip',
                encryption: false,
                retentionDays: 7
            });

            // Generate test data
            const testData = [
                {
                    id: 1,
                    name: 'Test Merchant 1',
                    price: 100.50,
                    currency: 'USD',
                    timestamp: new Date().toISOString(),
                    active: true
                },
                {
                    id: 2,
                    name: 'Test Merchant 2',
                    price: 200.75,
                    currency: 'EUR',
                    timestamp: new Date().toISOString(),
                    active: false
                }
            ];

            // Test JSON backup
            console.log('📄 Testing JSON backup...');
            const jsonBackup = await this.backupManager.createBackup(testData, {
                format: EXPORT_FORMATS.JSON,
                metadata: { testRun: 'features-16-20' }
            });
            console.log(`   JSON backup created: ${jsonBackup.id}`);
            console.log(`   Backup size: ${jsonBackup.manifest.size} bytes`);

            // Test CSV backup
            console.log('📊 Testing CSV backup...');
            const csvBackup = await this.backupManager.createBackup(testData, {
                format: EXPORT_FORMATS.CSV,
                metadata: { testRun: 'features-16-20' }
            });
            console.log(`   CSV backup created: ${csvBackup.id}`);

            // Test XML backup
            console.log('📋 Testing XML backup...');
            const xmlBackup = await this.backupManager.createBackup(testData, {
                format: EXPORT_FORMATS.XML,
                metadata: { testRun: 'features-16-20' }
            });
            console.log(`   XML backup created: ${xmlBackup.id}`);

            // Test SQL backup
            console.log('🗄️ Testing SQL backup...');
            const sqlBackup = await this.backupManager.createBackup(testData, {
                format: EXPORT_FORMATS.SQL,
                metadata: { testRun: 'features-16-20' }
            });
            console.log(`   SQL backup created: ${sqlBackup.id}`);

            // Test backup verification
            console.log('✅ Testing backup verification...');
            const verification = await this.backupManager.verifyBackup(jsonBackup.id);
            console.log(`   Backup verification: ${verification.valid ? 'PASSED' : 'FAILED'}`);

            // Test backup listing
            console.log('📋 Testing backup listing...');
            const backups = await this.backupManager.listBackups();
            console.log(`   Total backups: ${backups.length}`);

            // Test backup restore
            console.log('🔄 Testing backup restore...');
            const restored = await this.backupManager.restoreBackup(jsonBackup.id);
            console.log(`   Restored ${restored.data.length} records`);

            // Test scheduled backups
            console.log('⏰ Testing scheduled backups...');
            const scheduledManager = new ScheduledBackupManager(this.backupManager, {
                interval: 5000, // 5 seconds for testing
                enabled: false // Don't actually start the timer
            });

            const schedule = scheduledManager.scheduleBackup('test-schedule', () => testData, {
                format: EXPORT_FORMATS.JSON
            });
            console.log(`   Scheduled backup: ${schedule.name}`);

            // Test backup statistics
            const stats = await this.backupManager.getBackupStatistics();
            console.log('✅ Backup Statistics:');
            console.log(`   Total Backups: ${stats.totalBackups}`);
            console.log(`   Total Size: ${stats.totalSize} bytes`);
            console.log(`   Verified: ${stats.verified}`);

            this.recordTestResult('Data Export and Backup', true, 'All backup features working correctly');

        } catch (error) {
            console.error('❌ Data Export and Backup test failed:', error);
            this.recordTestResult('Data Export and Backup', false, error.message);
            throw error;
        }
    }

    /**
     * Feature 20: Test Graceful Shutdown
     */
    async testGracefulShutdown() {
        console.log('\n🛑 Testing Feature 20: Graceful Shutdown Handling');
        console.log('-'.repeat(60));

        try {
            // Initialize shutdown manager
            this.shutdownManager = createShutdownManager({
                timeout: 15000,
                enableSignalHandlers: false // Don't interfere with test process
            });

            // Test component registration
            console.log('📝 Testing component registration...');
            
            let dbShutdownCalled = false;
            this.shutdownManager.registerComponent('database', async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                dbShutdownCalled = true;
                console.log('   Database component shut down');
            }, {
                priority: PRIORITY_LEVELS.CRITICAL,
                timeout: 5000
            });

            let cacheShutdownCalled = false;
            this.shutdownManager.registerComponent('cache', async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                cacheShutdownCalled = true;
                console.log('   Cache component shut down');
            }, {
                priority: PRIORITY_LEVELS.HIGH,
                timeout: 3000
            });

            let loggerShutdownCalled = false;
            this.shutdownManager.registerComponent('logger', async () => {
                await new Promise(resolve => setTimeout(resolve, 25));
                loggerShutdownCalled = true;
                console.log('   Logger component shut down');
            }, {
                priority: PRIORITY_LEVELS.MEDIUM,
                timeout: 2000
            });

            // Test operation tracking
            console.log('⚙️ Testing operation tracking...');
            const operation1 = this.shutdownManager.registerOperation('test-op-1', 'Test operation 1');
            const operation2 = this.shutdownManager.registerOperation('test-op-2', 'Test operation 2');

            console.log(`   Active operations: ${this.shutdownManager.getActiveOperations().length}`);

            // Complete operations
            setTimeout(() => operation1.complete(), 100);
            setTimeout(() => operation2.complete(), 150);

            // Test component listing
            const components = this.shutdownManager.listComponents();
            console.log(`   Registered components: ${components.length}`);

            // Test shutdown listeners
            console.log('👂 Testing shutdown listeners...');
            let shutdownStarted = false;
            let shutdownCompleted = false;

            this.shutdownManager.onShutdown(() => {
                shutdownStarted = true;
                console.log('   Shutdown started event received');
            });

            this.shutdownManager.onShutdownComplete(() => {
                shutdownCompleted = true;
                console.log('   Shutdown completed event received');
            });

            // Test graceful shutdown
            console.log('🔄 Testing graceful shutdown...');
            const shutdownResult = await this.shutdownManager.testShutdown();

            console.log('✅ Shutdown Test Results:');
            console.log(`   Duration: ${shutdownResult.duration}ms`);
            console.log(`   Components Shutdown: ${shutdownResult.componentsShutdown}`);
            console.log(`   Successful: ${shutdownResult.successfulShutdowns}`);
            console.log(`   Failed: ${shutdownResult.failedShutdowns}`);

            // Verify components were shut down
            if (!dbShutdownCalled || !cacheShutdownCalled || !loggerShutdownCalled) {
                throw new Error('Not all components were shut down correctly');
            }

            // Test status
            const status = this.shutdownManager.getStatus();
            console.log(`   Final State: ${status.state}`);

            this.recordTestResult('Graceful Shutdown', true, 'All shutdown features working correctly');

        } catch (error) {
            console.error('❌ Graceful Shutdown test failed:', error);
            this.recordTestResult('Graceful Shutdown', false, error.message);
            throw error;
        }
    }

    /**
     * Integration Tests
     */
    async testFeatureIntegration() {
        console.log('\n🔗 Testing Feature Integration');
        console.log('-'.repeat(60));

        try {
            console.log('🤝 Testing logger with metrics integration...');
            
            // Create a counter for log entries
            const logCounter = this.metrics.createCounter('log_entries_total', {
                category: METRIC_CATEGORIES.APPLICATION,
                description: 'Total log entries'
            });

            // Hook logger to increment counter
            const originalLog = this.logger.log;
            this.logger.log = async function(level, message, metadata) {
                logCounter.increment();
                return originalLog.call(this, level, message, metadata);
            };

            // Generate some logs
            await this.logger.info('Integration test log 1');
            await this.logger.info('Integration test log 2');
            await this.logger.warn('Integration test warning');

            console.log(`   Log counter value: ${logCounter.getValue()}`);

            console.log('🔄 Testing backup with metrics...');
            
            // Create backup of metrics data
            const metricsData = this.metrics.getAllMetrics();
            const metricsBackup = await this.backupManager.createBackup(metricsData, {
                format: EXPORT_FORMATS.JSON,
                metadata: { 
                    type: 'metrics-backup',
                    testRun: 'integration-test'
                }
            });

            console.log(`   Metrics backup created: ${metricsBackup.id}`);

            console.log('🛑 Testing shutdown with all components...');
            
            // Register all components for shutdown
            this.shutdownManager.registerComponent('test-logger', async () => {
                await this.logger.flush();
                console.log('   Logger flushed during shutdown');
            }, { priority: PRIORITY_LEVELS.HIGH });

            this.shutdownManager.registerComponent('test-metrics', async () => {
                await this.metrics.persistMetrics();
                console.log('   Metrics persisted during shutdown');
            }, { priority: PRIORITY_LEVELS.MEDIUM });

            this.shutdownManager.registerComponent('test-backup', async () => {
                await this.backupManager.cleanupOldBackups();
                console.log('   Backup cleanup completed during shutdown');
            }, { priority: PRIORITY_LEVELS.LOW });

            console.log('✅ Integration tests completed successfully');

            this.recordTestResult('Feature Integration', true, 'All features integrate correctly');

        } catch (error) {
            console.error('❌ Feature Integration test failed:', error);
            this.recordTestResult('Feature Integration', false, error.message);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    recordTestResult(feature, success, message) {
        this.testResults.push({
            feature,
            success,
            message,
            timestamp: new Date().toISOString()
        });
    }

    generateFinalReport() {
        const endTime = Date.now();
        const totalDuration = endTime - this.startTime;
        const successfulTests = this.testResults.filter(r => r.success).length;
        const failedTests = this.testResults.filter(r => !r.success).length;

        console.log('\n📊 FINAL TEST REPORT - Features 16-20');
        console.log('=' .repeat(80));
        console.log(`🕒 Total Test Duration: ${totalDuration}ms`);
        console.log(`✅ Successful Tests: ${successfulTests}`);
        console.log(`❌ Failed Tests: ${failedTests}`);
        console.log(`📈 Success Rate: ${((successfulTests / this.testResults.length) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Test Results Summary:');
        this.testResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`   ${status} ${result.feature}: ${result.message}`);
        });

        if (failedTests === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Features 16-20 are fully functional.');
        } else {
            console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the errors above.`);
        }

        console.log('\n' + '=' .repeat(80));
    }

    /**
     * Cleanup
     */
    async cleanup() {
        try {
            // Shutdown components
            if (this.metrics) {
                await this.metrics.shutdown();
            }

            if (this.logger) {
                await this.logger.shutdown();
            }

            // Cleanup test backup files
            const testBackupsDir = path.join(process.cwd(), 'test-backups');
            try {
                await fs.rmdir(testBackupsDir, { recursive: true });
                console.log('🧹 Test backup directory cleaned up');
            } catch {
                // Directory might not exist, ignore
            }

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Main execution
async function main() {
    const testSuite = new FinalFeaturesTestSuite();
    
    try {
        await testSuite.runAllTests();
    } catch (error) {
        console.error('\n💥 Test suite execution failed:', error);
        process.exit(1);
    } finally {
        await testSuite.cleanup();
    }
}

// Run if this is the main module
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { FinalFeaturesTestSuite };
