// scraper/stealth.js
const { errorLog, log } = require('./logger');

/**
 * User agents pool for rotation
 * Using recent, popular browser versions to avoid detection
 */
const USER_AGENTS = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    
    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

/**
 * Common screen resolutions for viewport randomization
 */
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
    { width: 1536, height: 864 },
    { width: 1680, height: 1050 }
];

/**
 * Languages for Accept-Language header randomization
 */
const LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9,es;q=0.8',
    'en-GB,en;q=0.9,fr;q=0.8',
    'en-US,en;q=0.9,de;q=0.8',
    'en-CA,en;q=0.9',
    'en-AU,en;q=0.9'
];

/**
 * Timezones for timezone spoofing
 */
const TIMEZONES = [
    'America/New_York',
    'America/Los_Angeles', 
    'America/Chicago',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'America/Toronto',
    'Australia/Sydney'
];

/**
 * Get a random user agent from the pool
 * @returns {string} Random user agent
 */
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get a random screen resolution
 * @returns {Object} Random resolution with width and height
 */
function getRandomResolution() {
    return SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)];
}

/**
 * Get a random language
 * @returns {string} Random Accept-Language header value
 */
function getRandomLanguage() {
    return LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
}

/**
 * Get a random timezone
 * @returns {string} Random timezone
 */
function getRandomTimezone() {
    return TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
}

/**
 * Generate random delays that mimic human behavior
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} Random delay
 */
function getRandomDelay(min = 100, max = 300) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Apply stealth configurations to a Puppeteer page
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @param {Object} options - Stealth options
 */
async function applyStealth(page, options = {}) {
    const {
        userAgent = getRandomUserAgent(),
        language = getRandomLanguage(),
        timezone = getRandomTimezone()
    } = options;

    try {
        log('Applying stealth measures...');

        // Set custom user agent
        await page.setUserAgent(userAgent);
        log(`Set user agent: ${userAgent.substring(0, 50)}...`);

        // Set extra HTTP headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': language,
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        log(`Set language: ${language}`);

        // Override permissions
        const context = page.browser().defaultBrowserContext();
        await context.overridePermissions('https://www.gate.io', []);

        // Inject stealth scripts before any page content loads
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
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
                    },
                    {
                        0: {
                            type: "application/x-nacl",
                            suffixes: "",
                            description: "Native Client Executable",
                            enabledPlugin: {}
                        },
                        1: {
                            type: "application/x-pnacl",
                            suffixes: "",
                            description: "Portable Native Client Executable", 
                            enabledPlugin: {}
                        },
                        description: "",
                        filename: "internal-nacl-plugin",
                        length: 2,
                        name: "Native Client"
                    }
                ],
            });

            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override the `chrome` object
            Object.defineProperty(window, 'chrome', {
                get: () => ({
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                }),
            });

            // Pass the permissions test
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Remove automation indicators
            delete navigator.__proto__.webdriver;
        });

        // Set timezone
        await page.emulateTimezone(timezone);
        log(`Set timezone: ${timezone}`);

        // Randomize viewport
        const resolution = getRandomResolution();
        await page.setViewport({
            width: resolution.width,
            height: resolution.height,
            deviceScaleFactor: 1 + Math.random() * 0.5, // 1.0 to 1.5
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });
        log(`Set viewport: ${resolution.width}x${resolution.height}`);

        log('Stealth measures applied successfully');

    } catch (error) {
        errorLog('Error applying stealth measures:', error);
        throw error;
    }
}

/**
 * Simulate human-like mouse movements
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @param {number} movements - Number of movements to perform
 */
async function simulateMouseMovements(page, movements = 3) {
    try {
        const viewport = page.viewport();
        const maxX = viewport.width;
        const maxY = viewport.height;

        for (let i = 0; i < movements; i++) {
            const x = Math.random() * maxX;
            const y = Math.random() * maxY;
            
            await page.mouse.move(x, y, { steps: 10 + Math.random() * 10 });
            await new Promise(resolve => setTimeout(resolve, getRandomDelay(50, 200)));
        }
        
        log(`Performed ${movements} human-like mouse movements`);
    } catch (error) {
        errorLog('Error during mouse simulation:', error);
    }
}

/**
 * Simulate human-like scrolling behavior
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @param {Object} options - Scrolling options
 */
async function simulateHumanScrolling(page, options = {}) {
    const {
        maxScrolls = 5,
        minDelay = 500,
        maxDelay = 2000,
        scrollDistance = 100
    } = options;

    try {
        await page.evaluate(async (opts) => {
            const { maxScrolls, minDelay, maxDelay, scrollDistance } = opts;
            
            for (let i = 0; i < maxScrolls; i++) {
                // Random scroll distance and direction
                const distance = scrollDistance + Math.random() * scrollDistance;
                const direction = Math.random() > 0.1 ? 1 : -1; // 90% down, 10% up
                
                // Smooth scroll with varying speed
                const steps = 5 + Math.random() * 10;
                const stepDistance = (distance * direction) / steps;
                
                for (let step = 0; step < steps; step++) {
                    window.scrollBy(0, stepDistance);
                    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
                }
                
                // Random pause between scrolls
                const delay = minDelay + Math.random() * (maxDelay - minDelay);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Occasionally pause for longer (human-like)
                if (Math.random() < 0.2) {
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
                }
            }
        }, { maxScrolls, minDelay, maxDelay, scrollDistance });

        log(`Performed human-like scrolling with ${maxScrolls} scroll actions`);
    } catch (error) {
        errorLog('Error during human scrolling simulation:', error);
    }
}

/**
 * Add random delays between actions to mimic human behavior
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 */
async function humanDelay(min = 500, max = 1500) {
    const delay = getRandomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
    log(`Applied human delay: ${delay}ms`);
}

/**
 * Simulate human-like page interaction before scraping
 * @param {puppeteer.Page} page - Puppeteer page instance
 */
async function simulateHumanBehavior(page) {
    try {
        log('Starting human behavior simulation...');

        // Wait for initial page load
        await humanDelay(1000, 2000);

        // Simulate reading time
        await humanDelay(2000, 4000);

        // Random mouse movements
        await simulateMouseMovements(page, 2 + Math.random() * 3);

        // Human-like scrolling
        await simulateHumanScrolling(page, {
            maxScrolls: 2 + Math.random() * 3,
            minDelay: 800,
            maxDelay: 1500
        });

        // Final pause before extraction
        await humanDelay(1000, 2000);

        log('Human behavior simulation completed');
    } catch (error) {
        errorLog('Error during human behavior simulation:', error);
    }
}

/**
 * Get optimized browser launch arguments for stealth
 * @param {Object} options - Launch options
 * @returns {Array} Array of Chrome arguments
 */
function getStealthLaunchArgs(options = {}) {
    const {
        disableImages = false,
        disableJavaScript = false
    } = options;

    const args = [
        // Basic security and sandbox
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        
        // Performance optimizations
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        
        // Anti-detection measures
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-features=TranslateUI',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-first-run',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-blink-features=AutomationControlled',
        
        // Window size randomization
        `--window-size=${1200 + Math.floor(Math.random() * 400)},${800 + Math.floor(Math.random() * 200)}`
    ];

    // Resource blocking for performance
    if (disableImages) {
        args.push('--blink-settings=imagesEnabled=false');
    }

    if (disableJavaScript) {
        args.push('--disable-javascript');
    }

    return args;
}

module.exports = {
    applyStealth,
    simulateHumanBehavior,
    simulateMouseMovements,
    simulateHumanScrolling,
    humanDelay,
    getStealthLaunchArgs,
    getRandomUserAgent,
    getRandomResolution,
    getRandomLanguage,
    getRandomTimezone,
    getRandomDelay,
    USER_AGENTS,
    SCREEN_RESOLUTIONS,
    LANGUAGES,
    TIMEZONES
};
