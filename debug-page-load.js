// debug-page-load.js
const puppeteer = require('puppeteer');
const { TARGET_URL } = require('./scraper/config');

async function debugPageLoad() {
    console.log('🔍 Debugging page load and element detection');
    console.log('============================================');
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            devtools: false
        });

        const page = await browser.newPage();
        
        // Set a more realistic user agent
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });
        
        console.log(`📱 Navigating to: ${TARGET_URL}`);
        
        // Navigate and wait for load
        await page.goto(TARGET_URL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        });
        
        console.log('✅ Page loaded successfully');
        
        // Wait for dynamic content
        console.log('⏳ Waiting for dynamic content...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Debug: Check page content
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                readyState: document.readyState,
                bodyText: document.body ? document.body.textContent.substring(0, 1000) : 'No body',
                hasDataMsg: document.querySelectorAll('.dataMsg').length,
                hasP2PElements: document.querySelectorAll('[class*="p2p"]').length,
                hasMantineElements: document.querySelectorAll('[class*="mantine"]').length,
                hasTableElements: document.querySelectorAll('table, tbody, tr, td').length,
                totalDivs: document.querySelectorAll('div').length,
                totalSpans: document.querySelectorAll('span').length,
                hasTestIds: document.querySelectorAll('[data-testid]').length
            };
        });
        
        console.log('\n📊 Page Analysis:');
        console.log('================');
        console.log(`Title: ${pageInfo.title}`);
        console.log(`URL: ${pageInfo.url}`);
        console.log(`Ready State: ${pageInfo.readyState}`);
        console.log(`Total DIVs: ${pageInfo.totalDivs}`);
        console.log(`Total SPANs: ${pageInfo.totalSpans}`);
        console.log(`Table elements: ${pageInfo.hasTableElements}`);
        console.log(`Data-testid elements: ${pageInfo.hasTestIds}`);
        console.log(`P2P-related elements: ${pageInfo.hasP2PElements}`);
        console.log(`Mantine elements: ${pageInfo.hasMantineElements}`);
        console.log(`DataMsg elements: ${pageInfo.hasDataMsg}`);
        
        console.log('\n📄 Page Content Preview:');
        console.log('========================');
        console.log(pageInfo.bodyText.substring(0, 500).replace(/\s+/g, ' '));
        
        // Try to find merchant-like content
        console.log('\n🔍 Looking for merchant-like content...');
        const merchantContent = await page.evaluate(() => {
            // Look for elements that might contain prices
            const priceElements = [];
            const textElements = document.querySelectorAll('div, span, td');
            
            for (const el of textElements) {
                const text = el.textContent || '';
                // Look for KES prices or USDT mentions
                if (text.includes('KES') || text.includes('USDT') || /\d+\.\d+/.test(text)) {
                    priceElements.push({
                        tagName: el.tagName,
                        className: el.className,
                        textContent: text.substring(0, 100),
                        parentClassName: el.parentElement ? el.parentElement.className : ''
                    });
                    
                    if (priceElements.length >= 10) break; // Limit results
                }
            }
            
            return priceElements;
        });
        
        if (merchantContent.length > 0) {
            console.log('✅ Found potential merchant content:');
            merchantContent.forEach((element, index) => {
                console.log(`${index + 1}. ${element.tagName}.${element.className}: "${element.textContent}"`);
            });
        } else {
            console.log('❌ No merchant-like content found');
        }
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'debug-page-screenshot.png', fullPage: true });
        console.log('\n📸 Screenshot saved as debug-page-screenshot.png');
        
        // Keep browser open for manual inspection
        console.log('\n🔍 Browser will stay open for 30 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
    } catch (error) {
        console.error('❌ Error during debugging:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the debug
if (require.main === module) {
    debugPageLoad().catch(console.error);
}
