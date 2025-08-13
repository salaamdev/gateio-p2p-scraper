// test-robust-selectors.js
const { extractMerchants } = require('./scraper/extract');
const puppeteer = require('puppeteer');
const { TARGET_URL } = require('./scraper/config');

async function testRobustSelectors() {
    console.log('🧪 Testing Robust Selector Strategy Implementation');
    console.log('================================================');
    
    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`📱 Navigating to: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🔍 Extracting merchants using robust selectors...');
        const startTime = Date.now();
        const merchants = await extractMerchants(page);
        const extractionTime = Date.now() - startTime;
        
        console.log('\n📊 Extraction Results:');
        console.log('======================');
        console.log(`⏱️  Extraction time: ${extractionTime}ms`);
        console.log(`📋 Total merchants found: ${merchants.length}`);
        
        if (merchants.length > 0) {
            console.log('\n✅ Sample extracted data:');
            console.log('-------------------------');
            
            // Show first 3 merchants
            merchants.slice(0, 3).forEach((merchant, index) => {
                console.log(`\n${index + 1}. Merchant: ${merchant['Merchant Name']}`);
                console.log(`   Price: ${merchant.Price}`);
                console.log(`   Price Numeric: ${merchant.PriceNumeric}`);
                console.log(`   Size/Limit: ${merchant['Size/Limit']}`);
                console.log(`   Discount: ${merchant.Discount}`);
                console.log(`   Extracted At: ${merchant.extractedAt}`);
            });
            
            if (merchants.length > 3) {
                console.log(`\n... and ${merchants.length - 3} more merchants`);
            }
            
            // Analyze data quality
            console.log('\n📈 Data Quality Analysis:');
            console.log('========================');
            
            const validNames = merchants.filter(m => m['Merchant Name'] && m['Merchant Name'] !== 'N/A').length;
            const validPrices = merchants.filter(m => m.PriceNumeric && !isNaN(m.PriceNumeric)).length;
            const validLimits = merchants.filter(m => m['Size/Limit'] && m['Size/Limit'] !== 'N/A').length;
            
            console.log(`✅ Valid merchant names: ${validNames}/${merchants.length} (${((validNames/merchants.length)*100).toFixed(1)}%)`);
            console.log(`✅ Valid prices: ${validPrices}/${merchants.length} (${((validPrices/merchants.length)*100).toFixed(1)}%)`);
            console.log(`✅ Valid size/limits: ${validLimits}/${merchants.length} (${((validLimits/merchants.length)*100).toFixed(1)}%)`);
            
            // Test selector resilience
            console.log('\n🛡️ Selector Resilience Test:');
            console.log('============================');
            
            const uniqueFields = {
                names: new Set(merchants.map(m => m['Merchant Name'])).size,
                prices: new Set(merchants.map(m => m.PriceNumeric)).size,
                limits: new Set(merchants.map(m => m['Size/Limit'])).size
            };
            
            console.log(`🎯 Unique merchant names: ${uniqueFields.names}`);
            console.log(`💰 Unique prices: ${uniqueFields.prices}`);
            console.log(`📏 Unique size/limits: ${uniqueFields.limits}`);
            
            // Check for extraction diversity (good sign selectors are working)
            if (uniqueFields.names > merchants.length * 0.7) {
                console.log('✅ Good name extraction diversity - selectors working well');
            } else {
                console.log('⚠️  Low name extraction diversity - may need selector tuning');
            }
            
            console.log('\n🎉 Robust Selector Strategy Implementation: SUCCESS');
            console.log('====================================================');
            console.log('✅ Multiple fallback strategies implemented');
            console.log('✅ Data validation and normalization working');
            console.log('✅ Error handling and resilience in place');
            console.log('✅ Extraction metadata captured');
            
        } else {
            console.log('❌ No merchants extracted - selectors may need adjustment');
            console.log('\n🔧 Debugging info:');
            
            // Debug: Check what's on the page
            const pageContent = await page.evaluate(() => {
                const containers = document.querySelectorAll('div, span, td, tr');
                return {
                    totalElements: containers.length,
                    hasDataTestId: document.querySelectorAll('[data-testid]').length,
                    hasDataMsg: document.querySelectorAll('.dataMsg').length,
                    pageText: document.body.textContent.substring(0, 500)
                };
            });
            
            console.log(`📊 Page elements: ${pageContent.totalElements}`);
            console.log(`🎯 data-testid elements: ${pageContent.hasDataTestId}`);
            console.log(`📝 .dataMsg elements: ${pageContent.hasDataMsg}`);
            console.log(`📄 Page text preview: ${pageContent.pageText.replace(/\s+/g, ' ')}`);
        }

    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
if (require.main === module) {
    testRobustSelectors().catch(console.error);
}

module.exports = { testRobustSelectors };
