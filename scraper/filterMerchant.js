// scraper/filterMerchant.js
const fs = require('fs');
const path = require('path');
const {log, errorLog} = require('./logger');

function getAdjacentMerchants(merchants, targetMerchant = "coinftw") {
    const result = [];
    const targetIndex = merchants.findIndex(m => m["Merchant Name"] === targetMerchant);
    
    if (targetIndex === -1) return result;
    
    // Add merchant above (if exists)
    if (targetIndex > 0) {
        result.push(merchants[targetIndex - 1]);
    }
    
    // Add target merchant
    result.push(merchants[targetIndex]);
    
    // Add merchant below (if exists)
    if (targetIndex < merchants.length - 1) {
        result.push(merchants[targetIndex + 1]);
    }
    
    return result;
}

function saveFilteredToJson(data) {
    try {
        const filePath = path.join(__dirname, '../data/filtered_merchants.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        log(`Filtered data successfully saved to JSON: ${filePath}`);
    } catch (err) {
        errorLog("Error saving filtered data to JSON:", err);
    }
}

function saveFilteredToCsv(data) {
    try {
        const filePath = path.join(__dirname, '../data/filtered_merchants.csv');
        const csvHeader = "Merchant Name,Price,Size/Limit,Discount\n";
        const csvRows = data.map(row =>
            `"${row['Merchant Name']}","${row.Price}","${row['Size/Limit']}","${row.Discount}"`
        ).join("\n");

        fs.writeFileSync(filePath, csvHeader + csvRows, 'utf8');
        log(`Filtered data successfully saved to CSV: ${filePath}`);
    } catch (err) {
        errorLog("Error saving filtered data to CSV:", err);
    }
}

module.exports = {
    getAdjacentMerchants,
    saveFilteredToJson,
    saveFilteredToCsv
};