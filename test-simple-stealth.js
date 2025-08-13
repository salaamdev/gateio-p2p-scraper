// test-simple-stealth.js
const { 
    ProxyManager, 
    UserAgentManager, 
    EnhancedStealthManager 
} = require('./scraper/enhanced-stealth');
const { log } = require('./scraper/logger');

async function testBasicComponents() {
    log('='.repeat(60));
    log('TESTING BASIC STEALTH COMPONENTS');
    log('='.repeat(60));
    
    try {
        // Test 1: User Agent Manager
        log('\n1. Testing User Agent Manager...');
        const uaManager = new UserAgentManager();
        
        log('Testing user agent rotation:');
        for (let i = 0; i < 3; i++) {
            const ua = uaManager.getRotatedUserAgent({
                browserType: i % 2 === 0 ? 'chrome' : 'firefox',
                intelligent: true
            });
            log(`   UA ${i + 1}: ${ua.substring(0, 60)}...`);
        }
        
        const uaStats = uaManager.getUsageStats();
        log(`✅ User Agent Stats: Used ${uaStats.usedUserAgents}/${uaStats.totalUserAgents} agents`);
        
        // Test 2: Proxy Manager  
        log('\n2. Testing Proxy Manager...');
        const proxyManager = new ProxyManager();
        
        // Add test proxies
        proxyManager.addProxy({ host: 'test1.proxy.com', port: 8080 });
        proxyManager.addProxy({ host: 'test2.proxy.com', port: 3128, username: 'user', password: 'pass' });
        
        const proxy1 = proxyManager.getNextProxy();
        const proxy2 = proxyManager.getNextProxy();
        
        log(`   Proxy 1: ${proxy1 ? `${proxy1.host}:${proxy1.port}` : 'None'}`);
        log(`   Proxy 2: ${proxy2 ? `${proxy2.host}:${proxy2.port}` : 'None'}`);
        
        if (proxy1) {
            proxyManager.markProxySuccess(proxy1, 200);
        }
        
        const proxyStats = proxyManager.getStats();
        log(`✅ Proxy Stats: ${proxyStats.totalProxies} total, ${proxyStats.availableProxies} available`);
        
        // Test 3: Enhanced Stealth Manager
        log('\n3. Testing Enhanced Stealth Manager...');
        const stealthManager = new EnhancedStealthManager({
            enableProxy: false,
            enableUserAgentRotation: true,
            enableHumanBehavior: true,
            proxies: []
        });
        
        const stealthStats = stealthManager.getStealthStats();
        log(`✅ Stealth Manager initialized`);
        log(`   Session duration: ${stealthStats.sessionDuration}ms`);
        log(`   User agent stats: ${JSON.stringify(stealthStats.userAgentStats)}`);
        log(`   Proxy stats: ${JSON.stringify(stealthStats.proxyStats)}`);
        
        log('\n' + '='.repeat(60));
        log('✅ BASIC STEALTH COMPONENTS TEST PASSED');
        log('='.repeat(60));
        
        return true;
        
    } catch (error) {
        log(`❌ Test failed: ${error.message}`);
        return false;
    }
}

async function main() {
    const success = await testBasicComponents();
    
    if (success) {
        log('\n🎉 All basic stealth components are working correctly!');
        log('\nNext steps:');
        log('1. Configure real proxies for production use');
        log('2. Test with actual browser instances');
        log('3. Monitor stealth effectiveness in production');
    } else {
        log('\n❌ Basic component tests failed');
    }
}

if (require.main === module) {
    main();
}
