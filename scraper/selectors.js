// scraper/selectors.js
const { debugLog } = require('./logger');

/**
 * Selector strategies for different parts of the merchant data
 * Each field has multiple fallback selectors ordered by reliability
 */
const SELECTOR_STRATEGIES = {
    // Container selectors - where merchant rows are located
    merchantContainers: [
        // Primary selectors (most specific)
        '[data-testid="p2p-list"] .dataMsg',
        '[data-testid="merchant-row"]',
        '.p2p-newfriend-list .dataMsg',
        '.mantine-1s8spa1 .dataMsg',
        
        // Secondary selectors (structural)
        '.dataMsg',
        '[class*="merchant"][class*="row"]',
        '[class*="p2p"][class*="item"]',
        '[class*="list"][class*="item"]',
        
        // Generic fallbacks (positional)
        'tbody tr',
        '.list-item',
        '[class*="row"]:has([class*="price"])',
        'div[class*="list"] > div',
        
        // Last resort (very generic)
        'tr',
        'li'
    ],
    
    // Merchant name selectors
    merchantName: [
        // Primary selectors
        '[data-testid="merchant-name"]',
        '.markList-username',
        '.merchant-name',
        '.username',
        
        // Secondary selectors
        '[class*="username"]',
        '[class*="merchant"][class*="name"]',
        '[class*="name"]',
        
        // Structural fallbacks
        'a[href*="user"]',
        'span[class*="text"]:first-child',
        
        // Positional fallbacks
        'td:first-child',
        '.cell:first-child',
        'div:first-child span',
        'div:first-child a'
    ],
    
    // Price selectors
    price: [
        // Primary selectors
        '[data-testid="price"]',
        '[style*="font-weight: 700"]',
        '[style*="font-weight:700"]',
        
        // Secondary selectors
        '.price',
        '[class*="price"]',
        '[class*="amount"]',
        
        // Structural selectors
        'span[style*="font-weight"]',
        'div[style*="font-weight"]',
        'b',
        'strong',
        
        // Positional fallbacks
        'td:nth-child(2)',
        '.cell:nth-child(2)',
        'div:nth-child(2) span'
    ],
    
    // Currency selectors
    currency: [
        // Primary selectors
        '[data-testid="currency"]',
        '[style*="font-weight: 500"]',
        '[style*="font-weight:500"]',
        
        // Secondary selectors
        '.currency',
        '[class*="currency"]',
        
        // Contextual selectors (near price)
        '[style*="font-weight: 700"] + span',
        '[data-testid="price"] + span',
        '.price + span',
        
        // Pattern-based fallbacks
        'span:contains("KES")',
        'span:contains("USD")',
        'span:contains("EUR")'
    ],
    
    // Size/Limit selectors
    sizeLimit: [
        // Primary selectors
        '[data-testid="limit"]',
        '[data-testid="size-limit"]',
        '[style*="color: var(--color-text-1)"] div:nth-child(2)',
        
        // Secondary selectors
        '.limit',
        '.size-limit',
        '[class*="limit"]',
        '[class*="size"]',
        
        // Structural selectors
        'div:contains("~")',
        'span:contains("~")',
        'div:contains("USDT")',
        
        // Positional fallbacks
        'td:nth-child(3)',
        '.cell:nth-child(3)'
    ],
    
    // Discount selectors
    discount: [
        // Primary selectors
        '[data-testid="discount"]',
        '.p2p-discount-icon-txt',
        '.p2p-discount-listicon',
        
        // Secondary selectors
        '.discount',
        '[class*="discount"]',
        '[class*="promotion"]',
        
        // Pattern-based selectors
        'span:contains("%")',
        'div:contains("%")',
        'span:contains("discount")',
        
        // Positional fallbacks
        'td:last-child',
        '.cell:last-child'
    ]
};

/**
 * Advanced element finder with multiple strategies
 * @param {Element} container - The container element to search within
 * @param {Array} selectorArray - Array of selectors to try
 * @param {Object} options - Additional options
 * @returns {Element|null} - Found element or null
 */
function findElementWithFallback(container, selectorArray, options = {}) {
    const { 
        requireText = true, 
        minTextLength = 1,
        excludePatterns = [],
        debug = false 
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
                
                if (debug) {
                    debugLog(`Found element with selector ${i + 1}/${selectorArray.length}: "${selector}" -> "${text.substring(0, 50)}"`);
                }
                
                return element;
            }
        } catch (error) {
            if (debug) {
                debugLog(`Selector failed: "${selector}" - ${error.message}`);
            }
            continue;
        }
    }
    
    return null;
}

/**
 * Handle custom :contains() pseudo-selector
 * @param {Element} container - Container to search in
 * @param {string} selector - Selector with :contains()
 * @returns {NodeList} - Found elements
 */
function findElementsWithText(container, selector) {
    const match = selector.match(/^(.+):contains\(["']?(.+?)["']?\)$/);
    if (!match) {
        return container.querySelectorAll(selector);
    }
    
    const [, baseSelector, searchText] = match;
    const elements = container.querySelectorAll(baseSelector);
    
    return Array.from(elements).filter(el => 
        el.textContent && el.textContent.includes(searchText)
    );
}

/**
 * Extract text with cleanup and validation
 * @param {Element} element - Element to extract text from
 * @param {Object} options - Extraction options
 * @returns {string} - Cleaned text or fallback
 */
function extractText(element, options = {}) {
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
        // Normalize whitespace
        text = text.replace(/\s+/g, ' ');
        // Remove invisible characters
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
    }
    
    if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...';
    }
    
    return text || fallback;
}

/**
 * Validate extracted merchant data
 * @param {Object} merchantData - Raw extracted data
 * @returns {Object} - Validation result
 */
function validateMerchantData(merchantData) {
    const errors = [];
    const warnings = [];
    
    // Check merchant name
    if (!merchantData['Merchant Name'] || merchantData['Merchant Name'] === 'N/A') {
        errors.push('Missing merchant name');
    }
    
    // Check price format
    const pricePattern = /\d+(\.\d{2})?\s+[A-Z]{3}/;
    if (!pricePattern.test(merchantData.Price)) {
        warnings.push(`Price format may be incorrect: "${merchantData.Price}"`);
    }
    
    // Check numeric price
    if (!merchantData.PriceNumeric || isNaN(merchantData.PriceNumeric)) {
        errors.push('Invalid numeric price');
    }
    
    // Check size/limit format
    if (!merchantData['Size/Limit'] || merchantData['Size/Limit'] === 'N/A') {
        warnings.push('Missing size/limit information');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Find all merchant containers on the page
 * @param {Document} document - Page document
 * @returns {Array} - Array of container elements
 */
function findMerchantContainers(document) {
    const containers = [];
    
    for (const selector of SELECTOR_STRATEGIES.merchantContainers) {
        try {
            const elements = document.querySelectorAll(selector);
            
            if (elements.length > 0) {
                debugLog(`Found ${elements.length} containers with selector: "${selector}"`);
                
                // Filter out containers that don't look like merchant rows
                const validContainers = Array.from(elements).filter(container => {
                    const text = container.textContent || '';
                    // Should contain some text and likely price indicators
                    return text.length > 10 && (
                        text.includes('KES') || 
                        text.includes('USD') || 
                        text.includes('~') ||
                        /\d+(\.\d+)?/.test(text)
                    );
                });
                
                if (validContainers.length > 0) {
                    containers.push(...validContainers);
                    break; // Use the first successful strategy
                }
            }
        } catch (error) {
            debugLog(`Container selector failed: "${selector}" - ${error.message}`);
            continue;
        }
    }
    
    return containers;
}

module.exports = {
    SELECTOR_STRATEGIES,
    findElementWithFallback,
    extractText,
    validateMerchantData,
    findMerchantContainers,
    findElementsWithText
};
