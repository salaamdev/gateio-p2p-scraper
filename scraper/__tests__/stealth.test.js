// scraper/__tests__/stealth.test.js
const { 
    getRandomUserAgent,
    getRandomResolution,
    getRandomLanguage,
    getRandomTimezone,
    getRandomDelay,
    getStealthLaunchArgs,
    USER_AGENTS,
    SCREEN_RESOLUTIONS,
    LANGUAGES,
    TIMEZONES
} = require('../stealth');

describe('Stealth Measures', () => {
    test('should have comprehensive user agent pool', () => {
        expect(USER_AGENTS).toHaveLength(10);
        expect(USER_AGENTS.every(ua => ua.includes('Mozilla'))).toBe(true);
        expect(USER_AGENTS.some(ua => ua.includes('Chrome'))).toBe(true);
        expect(USER_AGENTS.some(ua => ua.includes('Firefox'))).toBe(true);
        expect(USER_AGENTS.some(ua => ua.includes('Edg'))).toBe(true); // Edge uses 'Edg' in user agent
    });

    test('should have diverse screen resolutions', () => {
        expect(SCREEN_RESOLUTIONS.length).toBeGreaterThan(5);
        expect(SCREEN_RESOLUTIONS.every(res => res.width > 0 && res.height > 0)).toBe(true);
        expect(SCREEN_RESOLUTIONS.some(res => res.width >= 1920)).toBe(true);
        expect(SCREEN_RESOLUTIONS.some(res => res.width <= 1366)).toBe(true);
    });

    test('should have multiple language options', () => {
        expect(LANGUAGES.length).toBeGreaterThan(3);
        expect(LANGUAGES.every(lang => lang.includes('en'))).toBe(true);
        expect(LANGUAGES.every(lang => lang.includes('q='))).toBe(true);
    });

    test('should have global timezone coverage', () => {
        expect(TIMEZONES.length).toBeGreaterThan(5);
        expect(TIMEZONES.some(tz => tz.includes('America'))).toBe(true);
        expect(TIMEZONES.some(tz => tz.includes('Europe'))).toBe(true);
        expect(TIMEZONES.some(tz => tz.includes('Australia'))).toBe(true);
    });

    test('should return random user agents', () => {
        const agents = new Set();
        for (let i = 0; i < 20; i++) {
            agents.add(getRandomUserAgent());
        }
        expect(agents.size).toBeGreaterThan(1); // Should get some variety
        Array.from(agents).forEach(agent => {
            expect(USER_AGENTS).toContain(agent);
        });
    });

    test('should return random resolutions', () => {
        const resolutions = new Set();
        for (let i = 0; i < 20; i++) {
            const res = getRandomResolution();
            resolutions.add(`${res.width}x${res.height}`);
            expect(res.width).toBeGreaterThan(0);
            expect(res.height).toBeGreaterThan(0);
        }
        expect(resolutions.size).toBeGreaterThan(1);
    });

    test('should return random languages', () => {
        const languages = new Set();
        for (let i = 0; i < 20; i++) {
            languages.add(getRandomLanguage());
        }
        expect(languages.size).toBeGreaterThan(1);
        Array.from(languages).forEach(lang => {
            expect(LANGUAGES).toContain(lang);
        });
    });

    test('should return random timezones', () => {
        const timezones = new Set();
        for (let i = 0; i < 20; i++) {
            timezones.add(getRandomTimezone());
        }
        expect(timezones.size).toBeGreaterThan(1);
        Array.from(timezones).forEach(tz => {
            expect(TIMEZONES).toContain(tz);
        });
    });

    test('should generate delays within specified range', () => {
        const min = 100;
        const max = 300;
        
        for (let i = 0; i < 50; i++) {
            const delay = getRandomDelay(min, max);
            expect(delay).toBeGreaterThanOrEqual(min);
            expect(delay).toBeLessThanOrEqual(max);
        }
    });

    test('should generate stealth launch arguments', () => {
        const args = getStealthLaunchArgs();
        
        expect(Array.isArray(args)).toBe(true);
        expect(args.length).toBeGreaterThan(10);
        
        // Check for essential stealth arguments
        expect(args).toContain('--no-sandbox');
        expect(args).toContain('--disable-setuid-sandbox');
        expect(args).toContain('--disable-blink-features=AutomationControlled');
        expect(args.some(arg => arg.startsWith('--window-size='))).toBe(true);
    });

    test('should support custom launch options', () => {
        const args = getStealthLaunchArgs({
            disableImages: true,
            disableJavaScript: true
        });
        
        expect(args).toContain('--blink-settings=imagesEnabled=false');
        expect(args).toContain('--disable-javascript');
    });

    test('should randomize window size in launch args', () => {
        const args1 = getStealthLaunchArgs();
        const args2 = getStealthLaunchArgs();
        
        const windowSize1 = args1.find(arg => arg.startsWith('--window-size='));
        const windowSize2 = args2.find(arg => arg.startsWith('--window-size='));
        
        expect(windowSize1).toBeDefined();
        expect(windowSize2).toBeDefined();
        
        // Should have different window sizes (very likely with random generation)
        // This test might occasionally fail due to randomness, but very unlikely
        let different = false;
        for (let i = 0; i < 10; i++) {
            const args = getStealthLaunchArgs();
            const windowSize = args.find(arg => arg.startsWith('--window-size='));
            if (windowSize !== windowSize1) {
                different = true;
                break;
            }
        }
        expect(different).toBe(true);
    });
});

describe('Stealth Delay Functions', () => {
    test('should respect minimum and maximum delay bounds', () => {
        const delays = [];
        for (let i = 0; i < 100; i++) {
            delays.push(getRandomDelay(50, 150));
        }
        
        expect(Math.min(...delays)).toBeGreaterThanOrEqual(50);
        expect(Math.max(...delays)).toBeLessThanOrEqual(150);
    });

    test('should produce varied delay values', () => {
        const delays = new Set();
        for (let i = 0; i < 50; i++) {
            delays.add(getRandomDelay(100, 200));
        }
        
        // Should have good variety in delays
        expect(delays.size).toBeGreaterThan(10);
    });
});

describe('Stealth Configuration Validation', () => {
    test('user agents should be valid and recent', () => {
        USER_AGENTS.forEach(ua => {
            expect(ua).toMatch(/Mozilla\/5\.0/);
            expect(ua.length).toBeGreaterThan(50);
            expect(ua.length).toBeLessThan(200);
            
            // Should contain version numbers that look recent
            if (ua.includes('Chrome')) {
                expect(ua).toMatch(/Chrome\/1[1-2]\d/); // Chrome 110+
            }
            if (ua.includes('Firefox')) {
                expect(ua).toMatch(/Firefox\/1[1-2]\d/); // Firefox 110+
            }
        });
    });

    test('screen resolutions should be realistic', () => {
        SCREEN_RESOLUTIONS.forEach(res => {
            expect(res.width).toBeGreaterThanOrEqual(1280);
            expect(res.height).toBeGreaterThanOrEqual(720);
            expect(res.width).toBeLessThanOrEqual(3840);
            expect(res.height).toBeLessThanOrEqual(2160);
            
            // Aspect ratio should be reasonable
            const aspectRatio = res.width / res.height;
            expect(aspectRatio).toBeGreaterThan(1.0);
            expect(aspectRatio).toBeLessThan(2.5);
        });
    });

    test('languages should have proper format', () => {
        LANGUAGES.forEach(lang => {
            expect(lang).toMatch(/^[a-z]{2}-[A-Z]{2}/);
            expect(lang).toMatch(/q=0\.\d/);
        });
    });

    test('timezones should be valid IANA format', () => {
        TIMEZONES.forEach(tz => {
            expect(tz).toMatch(/^[A-Z][a-zA-Z_]+\/[A-Z][a-zA-Z_]+$/);
        });
    });
});
