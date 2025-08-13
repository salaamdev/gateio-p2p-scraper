# Enhanced Stealth Features Implementation

## 🎯 Overview

This document describes the implementation of three advanced stealth features for the Gate.io P2P scraper:

1. **Human-Like Behavior Simulation**
2. **User Agent Rotation**  
3. **Proxy Support for IP Rotation**

## 🚀 Features Implemented

### 1. Human-Like Behavior Simulation

#### **HumanBehaviorSimulator Class**
- **Realistic Mouse Movements**: Bezier curves with acceleration/deceleration
- **Natural Scrolling Patterns**: Variable speed with human-like pauses
- **Reading Behavior Simulation**: Eye movement patterns and fixation times
- **Attention & Distraction Modeling**: Random focus shifts and micro-movements
- **Behavior Profiles**: Unique characteristics per session (reading speed, attention span, etc.)

#### **Key Methods:**
```javascript
// Realistic mouse movement with curves and overshoot
await moveMouseRealistic(targetX, targetY, options)

// Natural scrolling with variable speeds
await simulateRealisticScrolling({ direction, pattern, distance })

// Reading behavior with eye movement patterns
await simulateReading({ readingTime, textSelector, scanMode })

// Comprehensive behavior combining all patterns
await simulateComprehensiveHumanBehavior(options)
```

### 2. User Agent Rotation

#### **UserAgentManager Class**
- **Enhanced UA Pool**: 22+ recent user agents (Chrome, Firefox, Safari, Edge, Opera)
- **Intelligent Rotation**: Avoids recently used agents, prefers unused ones
- **Browser/Platform Filtering**: Target specific browsers or operating systems
- **Usage Tracking**: Comprehensive statistics and rotation history
- **Smart Distribution**: Prevents over-use of any single user agent

#### **Key Features:**
```javascript
// Get rotated user agent with options
const userAgent = userAgentManager.getRotatedUserAgent({
    browserType: 'chrome',    // 'chrome', 'firefox', 'safari', 'edge'
    platform: 'windows',     // 'windows', 'macos', 'linux'
    avoidRecent: true,        // Avoid recently used agents
    preferUnused: true,       // Prefer unused agents
    intelligent: true         // Use intelligent rotation vs random
});
```

### 3. Proxy Support for IP Rotation

#### **ProxyManager Class**
- **Proxy Pool Management**: Add, remove, and rotate multiple proxies
- **Health Monitoring**: Track proxy success/failure rates and response times
- **Automatic Failover**: Disable failed proxies and recover automatically
- **Authentication Support**: Username/password proxy authentication
- **Round-Robin Rotation**: Intelligent proxy selection algorithms
- **Statistics Tracking**: Comprehensive proxy usage analytics

#### **Key Features:**
```javascript
// Add proxies to the pool
proxyManager.addProxy({ 
    host: 'proxy.example.com', 
    port: 8080, 
    username: 'user', 
    password: 'pass' 
});

// Get next available proxy
const proxy = proxyManager.getNextProxy();

// Mark proxy status
proxyManager.markProxySuccess(proxy, responseTime);
proxyManager.markProxyFailed(proxy);
```

### 4. Enhanced Browser Fingerprinting Protection

#### **Advanced Anti-Detection Measures:**
- **WebDriver Detection Removal**: Complete elimination of automation indicators
- **Chrome Object Mocking**: Realistic browser API simulation
- **Plugin Simulation**: Mock PDF viewer and other common plugins
- **Hardware Fingerprinting**: Random device memory, CPU cores, screen resolution
- **WebGL Spoofing**: Consistent but randomized graphics fingerprints
- **Canvas Fingerprinting Protection**: Noise injection to prevent tracking
- **Timezone & Language Randomization**: Geographic diversity simulation

## 📁 File Structure

```
scraper/
├── enhanced-stealth.js      # Main enhanced stealth implementation
├── enhanced-scraper.js      # Enhanced scraper with stealth integration
└── ...

test-enhanced-stealth-features.js  # Comprehensive test suite
index.js                           # Updated main entry point
```

## 🛠 Usage

### Basic Usage (Enhanced Mode - Default)

```bash
# Run with all enhanced stealth features
npm start

# Run single test
node test-enhanced-stealth-features.js
```

### Legacy Mode (Backward Compatibility)

```bash
# Run without enhanced features
npm start -- --legacy
```

### Advanced Configuration

```javascript
const enhancedScraper = new EnhancedScraper({
    // Enable/disable features
    enableProxy: true,
    enableUserAgentRotation: true,
    enableHumanBehavior: true,
    
    // Proxy configuration
    proxies: [
        { host: 'proxy1.com', port: 8080, username: 'user', password: 'pass' },
        { host: 'proxy2.com', port: 3128 }
    ],
    
    // Rotation intervals
    proxyRotationInterval: 300000,      // 5 minutes
    userAgentRotationInterval: 600000,  // 10 minutes
    
    // Behavior settings
    humanBehaviorEnabled: true,
    autoScrollEnabled: true,
    validationEnabled: true,
    databaseEnabled: true
});

await enhancedScraper.initialize();
await enhancedScraper.runSingleScrape();
```

### Continuous Scraping

```javascript
await enhancedScraper.runContinuousScraping({
    interval: 300000,    // 5 minutes between scrapes
    maxScrapes: 0,       // Unlimited (0 = no limit)
    
    onScrapeComplete: async (result) => {
        console.log(`Scraped ${result.merchantCount} merchants`);
    },
    
    onError: async (error, scrapeCount) => {
        console.log(`Error on scrape ${scrapeCount}:`, error.message);
        return true; // Continue scraping
    }
});
```

