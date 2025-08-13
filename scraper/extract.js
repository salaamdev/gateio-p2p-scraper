// scraper/extract.js
const { errorLog, debugLog } = require('./logger');
const { 
    SELECTOR_STRATEGIES, 
    validateMerchantData 
} = require('./selectors');

/**
 * Extract merchant data from the page using robust selector strategies.
 * 
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @returns {Promise<Array>} - The list of merchant data with validation results.
 */
async function extractMerchants(page) {
    try {
        const extractionResult = await page.evaluate((selectorStrategies) => {
            // Import selector functions into page context
            const findElementWithFallback = function(container, selectorArray, options = {}) {
                const { 
                    requireText = true, 
                    minTextLength = 1,
                    excludePatterns = []
                } = options;
                
                for (let i = 0; i < selectorArray.length; i++) {
                    const selector = selectorArray[i];
                    
                    try {
                        // Handle special :contains() pseudo-selector
                        let elements;
                        if (selector.includes(':contains(')) {
                            elements = findElementsWithText(container, selector);
                        } else {
                            elements = container.querySelectorAll(selector);
                        }
                        
                        for (const element of elements) {
                            const text = element.textContent?.trim() || '';
                            
                            // Skip if text is required but missing
                            if (requireText && text.length < minTextLength) {
                                continue;
                            }
                            
                            // Skip if text matches exclude patterns
                            if (excludePatterns.some(pattern => 
                                typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)
                            )) {
                                continue;
                            }
                            
                            return element;
                        }
                    } catch {
                        continue;
                    }
                }
                
                return null;
            };

            const findElementsWithText = function(container, selector) {
                const match = selector.match(/^(.+):contains\(["']?(.+?)["']?\)$/);
                if (!match) {
                    return container.querySelectorAll(selector);
                }
                
                const [, baseSelector, searchText] = match;
                const elements = container.querySelectorAll(baseSelector);
                
                return Array.from(elements).filter(el => 
                    el.textContent && el.textContent.includes(searchText)
                );
            };

            const extractText = function(element, options = {}) {
                const {
                    fallback = 'N/A',
                    trim = true,
                    normalize = true,
                    maxLength = 1000
                } = options;
                
                if (!element) {
                    return fallback;
                }
                
                let text = element.textContent || element.innerText || '';
                
                if (trim) {
                    text = text.trim();
                }
                
                if (normalize) {
                    text = text.replace(/\s+/g, ' ');
                    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
                }
                
                if (text.length > maxLength) {
                    text = text.substring(0, maxLength) + '...';
                }
                
                return text || fallback;
            };

            const findMerchantContainers = function(document) {
                const containers = [];
                
                for (const selector of selectorStrategies.merchantContainers) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        
                        if (elements.length > 0) {
                            const validContainers = Array.from(elements).filter(container => {
                                const text = container.textContent || '';
                                return text.length > 10 && (
                                    text.includes('KES') || 
                                    text.includes('USD') || 
                                    text.includes('~') ||
                                    /\d+(\.\d+)?/.test(text)
                                );
                            });
                            
                            if (validContainers.length > 0) {
                                containers.push(...validContainers);
                                break;
                            }
                        }
                    } catch {
                        continue;
                    }
                }
                
                return containers;
            };

            // Start extraction process
            const merchantData = [];
            const extractionStats = {
                containersFound: 0,
                successfulExtractions: 0,
                failedExtractions: 0,
                selectorStats: {}
            };

            // Find merchant containers using robust strategy
            const containers = findMerchantContainers(document);
            extractionStats.containersFound = containers.length;

            containers.forEach((merchant, index) => {
                try {
                    // Extract merchant name
                    const nameElement = findElementWithFallback(
                        merchant, 
                        selectorStrategies.merchantName,
                        { requireText: true, minTextLength: 1 }
                    );
                    const name = extractText(nameElement);

                    // Extract price
                    const priceElement = findElementWithFallback(
                        merchant, 
                        selectorStrategies.price,
                        { requireText: true, minTextLength: 1 }
                    );
                    const priceRaw = extractText(priceElement);

                    // Extract currency
                    const currencyElement = findElementWithFallback(
                        merchant, 
                        selectorStrategies.currency,
                        { requireText: true, minTextLength: 1 }
                    );
                    const currency = extractText(currencyElement);

                    // Extract size/limit
                    const sizeLimitElement = findElementWithFallback(
                        merchant, 
                        selectorStrategies.sizeLimit,
                        { requireText: true, minTextLength: 1 }
                    );
                    const sizeLimit = extractText(sizeLimitElement);

                    // Extract discount
                    const discountElement = findElementWithFallback(
                        merchant, 
                        selectorStrategies.discount,
                        { requireText: false }
                    );
                    const discount = extractText(discountElement);

                    // Parse numeric price
                    const numericPrice = (() => {
                        const cleanPrice = priceRaw.replace(/[,\s]/g, '');
                        const match = cleanPrice.match(/([0-9]*\.?[0-9]+)/);
                        return match ? Number(match[1]) : null;
                    })();

                    const merchantRecord = {
                        'Merchant Name': name,
                        Price: `${priceRaw} ${currency}`.trim(),
                        'PriceNumeric': numericPrice,
                        'Size/Limit': sizeLimit,
                        Discount: discount,
                        extractedAt: new Date().toISOString(),
                        sourceUrl: window.location.href,
                        extractionIndex: index
                    };

                    merchantData.push(merchantRecord);
                    extractionStats.successfulExtractions++;

                } catch (error) {
                    extractionStats.failedExtractions++;
                    console.error(`Failed to extract merchant ${index}:`, error);
                }
            });

            return {
                merchantData,
                extractionStats,
                timestamp: new Date().toISOString(),
                pageUrl: window.location.href,
                pageTitle: document.title
            };

        }, SELECTOR_STRATEGIES);

        // Validate extracted data
        const validatedResults = {
            merchants: [],
            validationErrors: [],
            warnings: [],
            stats: extractionResult.extractionStats
        };

        extractionResult.merchantData.forEach((merchant, index) => {
            const validation = validateMerchantData(merchant);
            
            if (validation.isValid) {
                validatedResults.merchants.push(merchant);
            } else {
                validatedResults.validationErrors.push({
                    index,
                    merchant,
                    errors: validation.errors
                });
            }
            
            if (validation.warnings.length > 0) {
                validatedResults.warnings.push({
                    index,
                    merchant: merchant['Merchant Name'],
                    warnings: validation.warnings
                });
            }
        });

        // Log extraction results
        debugLog(`Extraction completed: ${validatedResults.merchants.length} valid merchants found`);
        if (validatedResults.validationErrors.length > 0) {
            errorLog(`Validation errors: ${validatedResults.validationErrors.length} merchants failed validation`);
        }
        if (validatedResults.warnings.length > 0) {
            debugLog(`Warnings: ${validatedResults.warnings.length} merchants have warnings`);
        }

        return validatedResults.merchants;
    } catch (err) {
        errorLog("Error while extracting merchants:", err);
        return [];
    }
}

module.exports = {
    extractMerchants
};
