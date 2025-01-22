// scraper/dataSaver.js
const fs = require('fs');
const path = require('path');
const {log, errorLog} = require('./logger');

/**
 * Save data to a JSON file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToJson (data) {
    try {
        const filePath = path.join(__dirname, '../data/gateio_p2p_merchants.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        log(`Data successfully saved to JSON: ${ filePath }`);
    } catch (err) {
        errorLog("Error saving data to JSON:", err);
    }
}

/**
 * Save data to a CSV file.
 *
 * @param {Array} data - The merchant data to save.
 */
function saveToCsv (data) {
    try {
        const filePath = path.join(__dirname, '../data/gateio_p2p_merchants.csv');
        const csvHeader = "Merchant Name,Price,Size/Limit,Discount\n";
        const csvRows = data.map(row =>
            `"${ row['Merchant Name'] }","${ row.Price }","${ row['Size/Limit'] }","${ row.Discount }"`
        ).join("\n");

        fs.writeFileSync(filePath, csvHeader + csvRows, 'utf8');
        log(`Data successfully saved to CSV: ${ filePath }`);
    } catch (err) {
        errorLog("Error saving data to CSV:", err);
    }
}

module.exports = {
    saveToJson,
    saveToCsv
};
