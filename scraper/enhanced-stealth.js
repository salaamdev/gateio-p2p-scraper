// scraper/enhanced-stealth.js
const { errorLog, log } = require('./logger');

/**
 * Enhanced Stealth Module with Advanced Features:
 * 1. Human-Like Behavior Simulation
 * 2. User Agent Rotation
 * 3. Proxy Support for IP Rotation
 */

/**
 * Expanded user agents pool with more variety and recent versions
 */
const ENHANCED_USER_AGENTS = [
    // Chrome on Windows (Latest versions)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    
    // Chrome on macOS (Latest versions)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    
    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    
    // Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Firefox on Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    
    // Opera
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0'
];

/**
 * Enhanced screen resolutions including ultrawide and high-DPI displays
 */
const ENHANCED_SCREEN_RESOLUTIONS = [
    // Standard resolutions
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
    { width: 1536, height: 864 },
    { width: 1680, height: 1050 },
    
    // High resolution displays
    { width: 2560, height: 1440 },
    { width: 2560, height: 1600 },
    { width: 3440, height: 1440 }, // Ultrawide
    { width: 1920, height: 1200 },
    { width: 2048, height: 1152 },
    
    // 4K and higher
    { width: 3840, height: 2160 },
    { width: 2880, height: 1800 }, // MacBook Pro
    { width: 2560, height: 1800 }   // MacBook Air
];

/**
 * Comprehensive language and locale combinations
 */
const ENHANCED_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9,es;q=0.8',
    'en-GB,en;q=0.9,fr;q=0.8',
    'en-US,en;q=0.9,de;q=0.8',
    'en-CA,en;q=0.9',
    'en-AU,en;q=0.9',
    'en-US,en;q=0.9,zh-CN;q=0.8',
    'en-GB,en;q=0.9,es;q=0.8,fr;q=0.7',
    'en-US,en;q=0.9,ja;q=0.8',
    'en-US,en;q=0.9,pt;q=0.8',
    'en-GB,en;q=0.9,de;q=0.8,it;q=0.7'
];

/**
 * Expanded timezone list covering major regions
 */
const ENHANCED_TIMEZONES = [
    // North America
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'America/Denver',
    'America/Toronto',
    'America/Vancouver',
    'America/Phoenix',
    'America/Mexico_City',
    
    // Europe
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Amsterdam',
    'Europe/Stockholm',
    'Europe/Warsaw',
    
    // Asia Pacific
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Seoul',
    'Asia/Mumbai',
    'Australia/Sydney',
    'Australia/Melbourne',
    
    // Others
    'Pacific/Auckland',
    'America/Sao_Paulo',
    'Africa/Cairo'
];

/**
 * Proxy configuration support
 */
class ProxyManager {
    constructor(proxies = []) {
        this.proxies = proxies;
        this.currentIndex = 0;
        this.failedProxies = new Set();
        this.proxyStats = new Map();
        this.rotationHistory = [];
    }

    /**
     * Add a proxy to the pool
     * @param {Object} proxy - Proxy configuration
     */
    addProxy(proxy) {
        if (this.isValidProxy(proxy)) {
            this.proxies.push(proxy);
            this.proxyStats.set(proxy.host + ':' + proxy.port, {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastUsed: null,
                avgResponseTime: 0
            });
            log(`Added proxy: ${proxy.host}:${proxy.port}`);
        } else {
            errorLog('Invalid proxy configuration:', proxy);
        }
    }

    /**
     * Validate proxy configuration
     * @param {Object} proxy - Proxy to validate
     * @returns {boolean} True if valid
     */
    isValidProxy(proxy) {
        return proxy && 
               typeof proxy.host === 'string' && 
               typeof proxy.port === 'number' &&
               proxy.port > 0 && proxy.port <= 65535;
    }

    /**
     * Get the next available proxy using round-robin with failure handling
     * @returns {Object|null} Next proxy or null if none available
     */
    getNextProxy() {
        if (this.proxies.length === 0) {
            return null;
        }

        const availableProxies = this.proxies.filter(proxy => 
            !this.failedProxies.has(proxy.host + ':' + proxy.port)
        );

        if (availableProxies.length === 0) {
            // Reset failed proxies if all have failed
            log('All proxies failed, resetting failure list');
            this.failedProxies.clear();
            return this.proxies[0];
        }

        // Use round-robin on available proxies
        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex++;

        // Record usage
        const proxyKey = proxy.host + ':' + proxy.port;
        const stats = this.proxyStats.get(proxyKey);
        if (stats) {
            stats.attempts++;
            stats.lastUsed = new Date();
        }

        this.rotationHistory.push({
            proxy: proxyKey,
            timestamp: new Date(),
            index: this.currentIndex - 1
        });

        // Keep rotation history limited
        if (this.rotationHistory.length > 100) {
            this.rotationHistory = this.rotationHistory.slice(-50);
        }

        log(`Selected proxy: ${proxyKey}`);
        return proxy;
    }

    /**
     * Mark a proxy as failed
     * @param {Object} proxy - Failed proxy
     */
    markProxyFailed(proxy) {
        const proxyKey = proxy.host + ':' + proxy.port;
        this.failedProxies.add(proxyKey);
        
        const stats = this.proxyStats.get(proxyKey);
        if (stats) {
            stats.failures++;
        }

        errorLog(`Marked proxy as failed: ${proxyKey}`);
    }

    /**
     * Mark a proxy as successful
     * @param {Object} proxy - Successful proxy
     * @param {number} responseTime - Response time in ms
     */
    markProxySuccess(proxy, responseTime = 0) {
        const proxyKey = proxy.host + ':' + proxy.port;
        
        const stats = this.proxyStats.get(proxyKey);
        if (stats) {
            stats.successes++;
            if (responseTime > 0) {
                stats.avgResponseTime = ((stats.avgResponseTime * (stats.successes - 1)) + responseTime) / stats.successes;
            }
        }

        log(`Proxy success: ${proxyKey} (${responseTime}ms)`);
    }

    /**
     * Get proxy statistics
     * @returns {Object} Proxy statistics
     */
    getStats() {
        return {
            totalProxies: this.proxies.length,
            failedProxies: this.failedProxies.size,
            availableProxies: this.proxies.length - this.failedProxies.size,
            rotationHistory: this.rotationHistory.slice(-10),
            proxyStats: Object.fromEntries(this.proxyStats)
        };
    }

    /**
     * Reset all proxy failures
     */
    resetFailures() {
        this.failedProxies.clear();
        log('Reset all proxy failures');
    }
}

/**
 * User Agent Rotation Manager
 */
class UserAgentManager {
    constructor() {
        this.userAgents = [...ENHANCED_USER_AGENTS];
        this.usageHistory = new Map();
        this.lastUsed = new Map();
        this.rotationIndex = 0;
    }

    /**
     * Get a random user agent with intelligent rotation
     * @param {Object} options - Rotation options
     * @returns {string} Selected user agent
     */
    getRotatedUserAgent(options = {}) {
        const {
            avoidRecent = true,
            preferUnused = true,
            browserType = null, // 'chrome', 'firefox', 'safari', 'edge'
            platform = null     // 'windows', 'macos', 'linux'
        } = options;

        let candidates = [...this.userAgents];

        // Filter by browser type
        if (browserType) {
            candidates = candidates.filter(ua => {
                const lowerUA = ua.toLowerCase();
                switch (browserType.toLowerCase()) {
                    case 'chrome':
                        return lowerUA.includes('chrome') && !lowerUA.includes('edg');
                    case 'firefox':
                        return lowerUA.includes('firefox');
                    case 'safari':
                        return lowerUA.includes('safari') && !lowerUA.includes('chrome');
                    case 'edge':
                        return lowerUA.includes('edg');
                    default:
                        return true;
                }
            });
        }

        // Filter by platform
        if (platform) {
            candidates = candidates.filter(ua => {
                const lowerUA = ua.toLowerCase();
                switch (platform.toLowerCase()) {
                    case 'windows':
                        return lowerUA.includes('windows');
                    case 'macos':
                    case 'mac':
                        return lowerUA.includes('macintosh');
                    case 'linux':
                        return lowerUA.includes('linux') || lowerUA.includes('ubuntu');
                    default:
                        return true;
                }
            });
        }

        // Avoid recently used user agents
        if (avoidRecent && this.lastUsed.size > 0) {
            const recentThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
            candidates = candidates.filter(ua => {
                const lastUsedTime = this.lastUsed.get(ua);
                return !lastUsedTime || lastUsedTime < recentThreshold;
            });
        }

        // Prefer unused user agents
        if (preferUnused && candidates.length > 0) {
            const unused = candidates.filter(ua => !this.usageHistory.has(ua));
            if (unused.length > 0) {
                candidates = unused;
            }
        }

        // Fallback to all user agents if no candidates
        if (candidates.length === 0) {
            candidates = [...this.userAgents];
        }

        // Select user agent (intelligent or random)
        let selectedUA;
        if (options.intelligent !== false) {
            // Use rotation index for more predictable distribution
            selectedUA = candidates[this.rotationIndex % candidates.length];
            this.rotationIndex++;
        } else {
            // Pure random selection
            selectedUA = candidates[Math.floor(Math.random() * candidates.length)];
        }

        // Record usage
        this.recordUsage(selectedUA);

        return selectedUA;
    }

    /**
     * Record user agent usage
     * @param {string} userAgent - Used user agent
     */
    recordUsage(userAgent) {
        const now = Date.now();
        
        if (!this.usageHistory.has(userAgent)) {
            this.usageHistory.set(userAgent, 0);
        }
        
        this.usageHistory.set(userAgent, this.usageHistory.get(userAgent) + 1);
        this.lastUsed.set(userAgent, now);

        log(`User agent selected: ${userAgent.substring(0, 80)}...`);
    }

    /**
     * Get user agent usage statistics
     * @returns {Object} Usage statistics
     */
    getUsageStats() {
        const stats = {
            totalUserAgents: this.userAgents.length,
            usedUserAgents: this.usageHistory.size,
            unusedUserAgents: this.userAgents.length - this.usageHistory.size,
            mostUsed: null,
            leastUsed: null,
            rotationIndex: this.rotationIndex
        };

        if (this.usageHistory.size > 0) {
            const sorted = [...this.usageHistory.entries()].sort((a, b) => b[1] - a[1]);
            stats.mostUsed = { userAgent: sorted[0][0].substring(0, 50) + '...', count: sorted[0][1] };
            stats.leastUsed = { userAgent: sorted[sorted.length - 1][0].substring(0, 50) + '...', count: sorted[sorted.length - 1][1] };
        }

        return stats;
    }

    /**
     * Reset usage statistics
     */
    resetStats() {
        this.usageHistory.clear();
        this.lastUsed.clear();
        this.rotationIndex = 0;
        log('Reset user agent usage statistics');
    }
}

/**
 * Advanced Human Behavior Simulator
 */
class HumanBehaviorSimulator {
    constructor(page) {
        this.page = page;
        this.viewport = null;
        this.behaviorProfile = this.generateBehaviorProfile();
    }

    /**
     * Generate a unique behavior profile for this session
     * @returns {Object} Behavior profile
     */
    generateBehaviorProfile() {
        return {
            readingSpeed: 150 + Math.random() * 100, // words per minute
            scrollSpeed: 0.5 + Math.random() * 1.5,  // multiplier
            mouseActivity: 0.3 + Math.random() * 0.7, // activity level
            pauseProbability: 0.2 + Math.random() * 0.3, // chance of long pause
            clickPrecision: 0.7 + Math.random() * 0.3, // how precise clicks are
            typingSpeed: 200 + Math.random() * 150, // characters per minute
            distractionLevel: Math.random() * 0.4 // chance of random actions
        };
    }

    /**
     * Simulate realistic mouse movements with curves and acceleration
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {Object} options - Movement options
     */
    async moveMouseRealistic(targetX, targetY, options = {}) {
        const {
            duration = 500 + Math.random() * 1000,
            steps = 20 + Math.random() * 30,
            overshoot = true
        } = options;

        try {
            // Get current mouse position (start from random if not set)
            const currentPos = await this.page.evaluate(() => {
                return { x: window.mouseX || Math.random() * window.innerWidth, 
                        y: window.mouseY || Math.random() * window.innerHeight };
            });

            const startX = currentPos.x;
            const startY = currentPos.y;
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;

            // Generate curve points using Bezier curve
            const controlPoint1X = startX + deltaX * 0.3 + (Math.random() - 0.5) * 100;
            const controlPoint1Y = startY + deltaY * 0.3 + (Math.random() - 0.5) * 100;
            const controlPoint2X = startX + deltaX * 0.7 + (Math.random() - 0.5) * 100;
            const controlPoint2Y = startY + deltaY * 0.7 + (Math.random() - 0.5) * 100;

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                
                // Cubic Bezier curve calculation
                const x = Math.pow(1 - t, 3) * startX +
                         3 * Math.pow(1 - t, 2) * t * controlPoint1X +
                         3 * (1 - t) * Math.pow(t, 2) * controlPoint2X +
                         Math.pow(t, 3) * targetX;
                         
                const y = Math.pow(1 - t, 3) * startY +
                         3 * Math.pow(1 - t, 2) * t * controlPoint1Y +
                         3 * (1 - t) * Math.pow(t, 2) * controlPoint2Y +
                         Math.pow(t, 3) * targetY;

                // Add slight randomness and human imprecision
                const jitterX = x + (Math.random() - 0.5) * 2;
                const jitterY = y + (Math.random() - 0.5) * 2;

                await this.page.mouse.move(jitterX, jitterY);
                
                // Variable delay between steps (acceleration/deceleration)
                const progress = i / steps;
                const easeInOut = 0.5 - 0.5 * Math.cos(progress * Math.PI);
                const delay = (duration / steps) * (0.5 + 0.5 * easeInOut);
                await this.sleep(delay);
            }

            // Overshoot and correct (human-like)
            if (overshoot && Math.random() < 0.3) {
                const overshootX = targetX + (Math.random() - 0.5) * 20;
                const overshootY = targetY + (Math.random() - 0.5) * 20;
                await this.page.mouse.move(overshootX, overshootY);
                await this.sleep(50 + Math.random() * 100);
                await this.page.mouse.move(targetX, targetY);
            }

            // Update mouse position in page context
            await this.page.evaluate((x, y) => {
                window.mouseX = x;
                window.mouseY = y;
            }, targetX, targetY);

        } catch (error) {
            errorLog('Error in realistic mouse movement:', error);
        }
    }

    /**
     * Simulate realistic scrolling with varying speeds and patterns
     * @param {Object} options - Scrolling options
     */
    async simulateRealisticScrolling(options = {}) {
        const {
            direction = 'down',
            distance = 'random',
            pattern = 'human'
        } = options;

        try {
            await this.page.evaluate(async (opts, profile) => {
                const { direction, distance, pattern } = opts;
                const { scrollSpeed, pauseProbability } = profile;

                // Calculate scroll distance
                let totalDistance;
                if (distance === 'random') {
                    totalDistance = 200 + Math.random() * 800;
                } else if (typeof distance === 'number') {
                    totalDistance = distance;
                } else {
                    totalDistance = 400;
                }

                if (direction === 'up') totalDistance = -totalDistance;

                // Different scrolling patterns
                if (pattern === 'human') {
                    // Human-like scrolling with variable speed and pauses
                    let scrolled = 0;
                    const segments = 5 + Math.random() * 10;
                    
                    for (let i = 0; i < segments; i++) {
                        const segmentDistance = totalDistance / segments;
                        const segmentSteps = 3 + Math.random() * 7;
                        const stepDistance = segmentDistance / segmentSteps;
                        
                        for (let j = 0; j < segmentSteps; j++) {
                            window.scrollBy(0, stepDistance * scrollSpeed);
                            scrolled += Math.abs(stepDistance);
                            
                            // Variable speed during scroll
                            const delay = 20 + Math.random() * 40;
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        
                        // Random pause between segments
                        if (Math.random() < pauseProbability) {
                            const pauseDuration = 200 + Math.random() * 800;
                            await new Promise(resolve => setTimeout(resolve, pauseDuration));
                        }
                    }
                } else if (pattern === 'smooth') {
                    // Smooth continuous scroll
                    const steps = 20 + Math.random() * 30;
                    const stepDistance = totalDistance / steps;
                    
                    for (let i = 0; i < steps; i++) {
                        window.scrollBy(0, stepDistance);
                        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
                    }
                }
                
                // Final pause after scrolling
                await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
                
            }, options, this.behaviorProfile);

            log(`Performed ${pattern} scrolling (${direction})`);
        } catch (error) {
            errorLog('Error in realistic scrolling:', error);
        }
    }

    /**
     * Simulate reading behavior with eye movement patterns
     * @param {Object} options - Reading options
     */
    async simulateReading(options = {}) {
        const {
            readingTime = null,
            textSelector = null,
            scanMode = false
        } = options;

        try {
            let estimatedReadingTime;
            
            if (readingTime) {
                estimatedReadingTime = readingTime;
            } else if (textSelector) {
                // Estimate reading time based on text content
                const wordCount = await this.page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.innerText || '';
                        return text.split(/\s+/).filter(word => word.length > 0).length;
                    }
                    return 100; // Default word count
                }, textSelector);
                
                estimatedReadingTime = (wordCount / this.behaviorProfile.readingSpeed) * 60000; // Convert to ms
            } else {
                estimatedReadingTime = 3000 + Math.random() * 7000; // 3-10 seconds
            }

            log(`Simulating reading for ${Math.round(estimatedReadingTime)}ms`);

            if (scanMode) {
                // Quick scanning behavior
                const scanDuration = estimatedReadingTime * 0.3;
                await this.simulateEyeMovementScanning(scanDuration);
            } else {
                // Normal reading behavior
                await this.simulateEyeMovementReading(estimatedReadingTime);
            }

        } catch (error) {
            errorLog('Error in reading simulation:', error);
        }
    }

    /**
     * Simulate eye movement patterns during reading
     * @param {number} duration - Reading duration in ms
     */
    async simulateEyeMovementReading(duration) {
        const startTime = Date.now();
        const viewport = await this.getViewport();
        
        // Simulate reading from top-left, moving right and down
        let currentX = viewport.width * 0.1; // Start from left margin
        let currentY = viewport.height * 0.2; // Start from top
        
        while (Date.now() - startTime < duration) {
            // Simulate saccadic eye movements (quick jumps)
            const jumpDistance = 50 + Math.random() * 100;
            currentX += jumpDistance;
            
            // Line break - move to next line
            if (currentX > viewport.width * 0.9) {
                currentX = viewport.width * 0.1;
                currentY += 20 + Math.random() * 15; // Line height
            }
            
            // Page break - scroll and reset
            if (currentY > viewport.height * 0.8) {
                await this.simulateRealisticScrolling({ distance: 200, pattern: 'smooth' });
                currentY = viewport.height * 0.2;
                await this.sleep(300 + Math.random() * 500); // Pause after scroll
            }
            
            // Micro-movements during fixation
            for (let i = 0; i < 3; i++) {
                const microX = currentX + (Math.random() - 0.5) * 10;
                const microY = currentY + (Math.random() - 0.5) * 5;
                await this.page.mouse.move(microX, microY);
                await this.sleep(50 + Math.random() * 100);
            }
            
            // Reading fixation time
            await this.sleep(200 + Math.random() * 300);
            
            // Occasional regression (re-reading)
            if (Math.random() < 0.1) {
                currentX -= 100 + Math.random() * 100;
                await this.sleep(150 + Math.random() * 200);
            }
        }
    }

    /**
     * Simulate eye movement patterns during scanning
     * @param {number} duration - Scanning duration in ms
     */
    async simulateEyeMovementScanning(duration) {
        const startTime = Date.now();
        const viewport = await this.getViewport();
        
        while (Date.now() - startTime < duration) {
            // Random jump to different areas (F-pattern scanning)
            const targetX = Math.random() * viewport.width;
            const targetY = Math.random() * viewport.height;
            
            await this.moveMouseRealistic(targetX, targetY, { duration: 200 + Math.random() * 300 });
            
            // Brief pause at each point
            await this.sleep(100 + Math.random() * 200);
            
            // Occasional scroll during scanning
            if (Math.random() < 0.3) {
                await this.simulateRealisticScrolling({ distance: 100, pattern: 'smooth' });
            }
        }
    }

    /**
     * Simulate distraction and attention shifts
     */
    async simulateDistraction() {
        if (Math.random() < this.behaviorProfile.distractionLevel) {
            log('Simulating distraction behavior');
            
            // Random mouse movement to different area
            const viewport = await this.getViewport();
            const randomX = Math.random() * viewport.width;
            const randomY = Math.random() * viewport.height;
            
            await this.moveMouseRealistic(randomX, randomY);
            await this.sleep(500 + Math.random() * 1500);
            
            // Possible scroll during distraction
            if (Math.random() < 0.5) {
                await this.simulateRealisticScrolling({ distance: 'random', pattern: 'human' });
            }
        }
    }

    /**
     * Get current viewport dimensions
     * @returns {Object} Viewport dimensions
     */
    async getViewport() {
        if (!this.viewport) {
            this.viewport = await this.page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight
            }));
        }
        return this.viewport;
    }

    /**
     * Sleep for specified duration with small random variation
     * @param {number} ms - Duration in milliseconds
     */
    async sleep(ms) {
        const variation = ms * 0.1; // 10% variation
        const actualMs = ms + (Math.random() - 0.5) * variation;
        await new Promise(resolve => setTimeout(resolve, actualMs));
    }

    /**
     * Comprehensive human behavior simulation
     * @param {Object} options - Simulation options
     */
    async simulateComprehensiveHumanBehavior(options = {}) {
        const {
            duration = 'auto',
            includeMouse = true,
            includeScrolling = true,
            includeReading = true,
            includeDistraction = true
        } = options;

        try {
            log('Starting comprehensive human behavior simulation');
            
            const startTime = Date.now();
            let totalDuration;
            
            if (duration === 'auto') {
                totalDuration = 5000 + Math.random() * 10000; // 5-15 seconds
            } else {
                totalDuration = duration;
            }

            // Initial page arrival behavior
            await this.sleep(500 + Math.random() * 1000);

            // Phase 1: Initial scanning and orientation
            if (includeReading) {
                await this.simulateReading({ scanMode: true, readingTime: totalDuration * 0.2 });
            }

            // Phase 2: Detailed reading/interaction
            if (includeReading) {
                await this.simulateReading({ readingTime: totalDuration * 0.4 });
            }

            // Phase 3: Exploration with scrolling and mouse movement
            const explorationTime = totalDuration * 0.3;
            const explorationStart = Date.now();
            
            while (Date.now() - explorationStart < explorationTime) {
                // Random mouse movements
                if (includeMouse && Math.random() < 0.7) {
                    const viewport = await this.getViewport();
                    const targetX = Math.random() * viewport.width;
                    const targetY = Math.random() * viewport.height;
                    await this.moveMouseRealistic(targetX, targetY);
                }

                // Scrolling behavior
                if (includeScrolling && Math.random() < 0.6) {
                    const direction = Math.random() < 0.8 ? 'down' : 'up';
                    await this.simulateRealisticScrolling({ direction, pattern: 'human' });
                }

                // Distraction behavior
                if (includeDistraction) {
                    await this.simulateDistraction();
                }

                // Pause between actions
                await this.sleep(800 + Math.random() * 1500);
            }

            // Phase 4: Final review/decision phase
            await this.simulateReading({ readingTime: totalDuration * 0.1, scanMode: true });

            log(`Comprehensive human behavior simulation completed (${Math.round(Date.now() - startTime)}ms)`);

        } catch (error) {
            errorLog('Error in comprehensive human behavior simulation:', error);
        }
    }
}

/**
 * Main Enhanced Stealth Manager
 */
class EnhancedStealthManager {
    constructor(options = {}) {
        this.proxyManager = new ProxyManager(options.proxies || []);
        this.userAgentManager = new UserAgentManager();
        this.currentProxy = null;
        this.currentUserAgent = null;
        this.sessionStartTime = Date.now();
        this.config = {
            enableProxy: options.enableProxy !== false,
            enableUserAgentRotation: options.enableUserAgentRotation !== false,
            enableHumanBehavior: options.enableHumanBehavior !== false,
            proxyRotationInterval: options.proxyRotationInterval || 300000, // 5 minutes
            userAgentRotationInterval: options.userAgentRotationInterval || 600000, // 10 minutes
            ...options
        };
    }

    /**
     * Apply enhanced stealth measures to a page
     * @param {puppeteer.Page} page - Puppeteer page instance
     * @param {Object} options - Stealth options
     */
    async applyEnhancedStealth(page, options = {}) {
        try {
            log('Applying enhanced stealth measures...');

            // 1. User Agent Rotation
            if (this.config.enableUserAgentRotation) {
                this.currentUserAgent = this.userAgentManager.getRotatedUserAgent(options.userAgent);
                await page.setUserAgent(this.currentUserAgent);
            }

            // 2. Enhanced HTTP Headers
            const language = this.getRandomLanguage();
            const headers = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': language,
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'sec-ch-ua': this.generateSecChUa(),
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': this.generatePlatform()
            };

            await page.setExtraHTTPHeaders(headers);

            // 3. Advanced Browser Fingerprinting Protection
            await this.injectAdvancedStealthScripts(page);

            // 4. Viewport and Resolution Randomization
            const resolution = this.getRandomResolution();
            await page.setViewport({
                width: resolution.width,
                height: resolution.height,
                deviceScaleFactor: 1 + Math.random() * 0.5,
                hasTouch: false,
                isLandscape: resolution.width > resolution.height,
                isMobile: false
            });

            // 5. Timezone Randomization (only if not already set)
            try {
                const timezone = this.getRandomTimezone();
                await page.emulateTimezone(timezone);
                log(`Timezone set to: ${timezone}`);
            } catch (timezoneError) {
                log(`Timezone already set or error: ${timezoneError.message}`);
            }

            // 6. Permission Overrides (only if context is available)
            try {
                const context = page.browser().defaultBrowserContext();
                await context.overridePermissions(page.url() || 'https://www.gate.io', []);
            } catch (permissionError) {
                log(`Permission override skipped: ${permissionError.message}`);
            }

            log('Enhanced stealth measures applied successfully');

        } catch (error) {
            errorLog('Error applying enhanced stealth measures:', error);
            throw error;
        }
    }

    /**
     * Inject advanced stealth scripts into the page
     * @param {puppeteer.Page} page - Puppeteer page instance
     */
    async injectAdvancedStealthScripts(page) {
        await page.evaluateOnNewDocument(() => {
            // Advanced webdriver detection removal
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });

            // Remove automation indicators
            delete navigator.__proto__.webdriver;
            delete window.navigator.webdriver;

            // Mock chrome object with more realistic properties
            Object.defineProperty(window, 'chrome', {
                get: () => ({
                    runtime: {
                        onConnect: null,
                        onConnectExternal: null,
                        onSuspend: null,
                        onStartup: null,
                        onInstalled: null,
                        onSuspendCanceled: null,
                        onUpdateAvailable: null,
                        id: undefined
                    },
                    loadTimes: function() {
                        return {
                            commitLoadTime: Math.random() * 1000 + 1000,
                            connectionInfo: 'h2',
                            finishDocumentLoadTime: Math.random() * 1000 + 2000,
                            finishLoadTime: Math.random() * 1000 + 2500,
                            firstPaintAfterLoadTime: 0,
                            firstPaintTime: Math.random() * 1000 + 1500,
                            navigationType: 'Other',
                            npnNegotiatedProtocol: 'h2',
                            requestTime: Date.now() / 1000 - Math.random() * 10,
                            startLoadTime: Math.random() * 1000 + 500,
                            wasAlternateProtocolAvailable: false,
                            wasFetchedViaSpdy: true,
                            wasNpnNegotiated: true
                        };
                    },
                    csi: function() {
                        return {
                            pageT: Math.random() * 1000 + 1000,
                            startE: Date.now() - Math.random() * 10000,
                            tran: 15
                        };
                    },
                    app: {
                        isInstalled: false,
                        InstallState: {
                            DISABLED: 'disabled',
                            INSTALLED: 'installed',
                            NOT_INSTALLED: 'not_installed'
                        },
                        RunningState: {
                            CANNOT_RUN: 'cannot_run',
                            READY_TO_RUN: 'ready_to_run',
                            RUNNING: 'running'
                        }
                    }
                }),
                configurable: true
            });

            // Enhanced plugin mocking
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        {
                            0: {
                                type: "application/x-google-chrome-pdf",
                                suffixes: "pdf",
                                description: "Portable Document Format",
                                enabledPlugin: {}
                            },
                            description: "Portable Document Format",
                            filename: "internal-pdf-viewer",
                            length: 1,
                            name: "Chrome PDF Plugin"
                        },
                        {
                            0: {
                                type: "application/pdf",
                                suffixes: "pdf",
                                description: "",
                                enabledPlugin: {}
                            },
                            description: "",
                            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                            length: 1,
                            name: "Chrome PDF Viewer"
                        }
                    ];
                    
                    // Make plugins array-like
                    plugins.refresh = function() {};
                    plugins.namedItem = function(name) {
                        return plugins.find(plugin => plugin.name === name) || null;
                    };
                    
                    return plugins;
                },
                configurable: true
            });

            // Mock languages with more variety
            const languages = ['en-US', 'en'];
            Object.defineProperty(navigator, 'languages', {
                get: () => languages,
                configurable: true
            });

            // Mock hardwareConcurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4 + Math.floor(Math.random() * 8), // 4-11 cores
                configurable: true
            });

            // Mock deviceMemory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
                configurable: true
            });

            // Override permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => {
                return parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters);
            };

            // Mock WebGL fingerprinting
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                    return 'Intel Inc.';
                }
                if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.call(this, parameter);
            };

            // Mock canvas fingerprinting
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                // Add slight noise to canvas fingerprinting
                const context = this.getContext('2d');
                if (context) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] += Math.floor(Math.random() * 10) - 5; // R
                        imageData.data[i + 1] += Math.floor(Math.random() * 10) - 5; // G
                        imageData.data[i + 2] += Math.floor(Math.random() * 10) - 5; // B
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, arguments);
            };

            // Mock getBattery
            if (navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 0.8 + Math.random() * 0.2
                });
            }
        });
    }

    /**
     * Apply proxy configuration to browser launch options
     * @param {Object} launchOptions - Puppeteer launch options
     * @returns {Object} Modified launch options
     */
    applyProxyToLaunchOptions(launchOptions = {}) {
        if (!this.config.enableProxy) {
            return launchOptions;
        }

        const proxy = this.proxyManager.getNextProxy();
        if (!proxy) {
            log('No proxy available, launching without proxy');
            return launchOptions;
        }

        this.currentProxy = proxy;
        
        const args = launchOptions.args || [];
        args.push(`--proxy-server=${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`);

        if (proxy.username && proxy.password) {
            // Note: Proxy authentication might need to be handled at page level
            log(`Using authenticated proxy: ${proxy.host}:${proxy.port}`);
        } else {
            log(`Using proxy: ${proxy.host}:${proxy.port}`);
        }

        return {
            ...launchOptions,
            args
        };
    }

    /**
     * Handle proxy authentication if needed
     * @param {puppeteer.Page} page - Puppeteer page instance
     */
    async handleProxyAuthentication(page) {
        if (!this.currentProxy || !this.currentProxy.username) {
            return;
        }

        await page.authenticate({
            username: this.currentProxy.username,
            password: this.currentProxy.password
        });

        log('Proxy authentication configured');
    }

    /**
     * Perform comprehensive human behavior simulation
     * @param {puppeteer.Page} page - Puppeteer page instance
     * @param {Object} options - Behavior options
     */
    async simulateHumanBehavior(page, options = {}) {
        if (!this.config.enableHumanBehavior) {
            return;
        }

        const simulator = new HumanBehaviorSimulator(page);
        await simulator.simulateComprehensiveHumanBehavior(options);
    }

    /**
     * Generate realistic sec-ch-ua header
     * @returns {string} sec-ch-ua header value
     */
    generateSecChUa() {
        const chromeVersion = 115 + Math.floor(Math.random() * 10);
        return `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not=A?Brand";v="24"`;
    }

    /**
     * Generate realistic platform header
     * @returns {string} Platform string
     */
    generatePlatform() {
        const platforms = ['"Windows"', '"macOS"', '"Linux"'];
        return platforms[Math.floor(Math.random() * platforms.length)];
    }

    /**
     * Get random language from enhanced list
     * @returns {string} Language string
     */
    getRandomLanguage() {
        return ENHANCED_LANGUAGES[Math.floor(Math.random() * ENHANCED_LANGUAGES.length)];
    }

    /**
     * Get random timezone from enhanced list
     * @returns {string} Timezone string
     */
    getRandomTimezone() {
        return ENHANCED_TIMEZONES[Math.floor(Math.random() * ENHANCED_TIMEZONES.length)];
    }

    /**
     * Get random resolution from enhanced list
     * @returns {Object} Resolution object
     */
    getRandomResolution() {
        return ENHANCED_SCREEN_RESOLUTIONS[Math.floor(Math.random() * ENHANCED_SCREEN_RESOLUTIONS.length)];
    }

    /**
     * Get comprehensive stealth statistics
     * @returns {Object} Stealth statistics
     */
    getStealthStats() {
        return {
            sessionDuration: Date.now() - this.sessionStartTime,
            currentProxy: this.currentProxy ? `${this.currentProxy.host}:${this.currentProxy.port}` : null,
            currentUserAgent: this.currentUserAgent ? this.currentUserAgent.substring(0, 80) + '...' : null,
            proxyStats: this.proxyManager.getStats(),
            userAgentStats: this.userAgentManager.getUsageStats(),
            config: this.config
        };
    }

    /**
     * Reset all stealth components
     */
    resetAll() {
        this.proxyManager.resetFailures();
        this.userAgentManager.resetStats();
        this.sessionStartTime = Date.now();
        log('Reset all stealth components');
    }
}

module.exports = {
    EnhancedStealthManager,
    ProxyManager,
    UserAgentManager,
    HumanBehaviorSimulator,
    ENHANCED_USER_AGENTS,
    ENHANCED_SCREEN_RESOLUTIONS,
    ENHANCED_LANGUAGES,
    ENHANCED_TIMEZONES
};
