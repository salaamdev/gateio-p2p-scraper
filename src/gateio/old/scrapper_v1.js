const puppeteer = require('puppeteer');
const fs = require('fs');

// Target URL
const URL = "https://www.gate.io/p2p/buy/USDT-KES";

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    console.log("Navigating to target URL...");
    await page.goto(URL, {waitUntil: "domcontentloaded", timeout: 60000});

    console.log("Waiting for merchant elements to load...");
    await page.waitForSelector('.mantine-1s8spa1', {timeout: 30000});

    // Scroll to load all merchants
    await autoScroll(page);

    console.log("Extracting merchant data...");
    const merchants = await page.evaluate(() => {
        let merchantData = [];
        let merchants = document.querySelectorAll('.mantine-1s8spa1 .dataMsg, .p2p-newfriend-list');

        merchants.forEach(merchant => {
            let name = merchant.querySelector('.markList-username')?.innerText.trim() || "N/A";
            // let orders = merchant.querySelector('.markList-userinfo-num-order')?.innerText.trim() || "N/A";
            // let rating = merchant.querySelector('.markList-userinfo-num-rate')?.innerText.trim() || "N/A";
            let price = merchant.querySelector('[style*="font-weight: 700"]')?.innerText.trim() || "N/A";
            let currency = merchant.querySelector('[style*="font-weight: 500"]')?.innerText.trim() || "N/A";
            let size_limit = merchant.querySelector('[style*="color: var(--color-text-1)"] div:nth-child(2)')?.innerText.trim() || "N/A";
            // let payment_methods = Array.from(merchant.querySelectorAll('.markList-table-payment-item-name'))
            //     .map(el => el.innerText.trim()).join(", ") || "N/A";
            // let discount = merchant.querySelector('.p2p-discount-icon-txt, .p2p-discount-listicon')?.innerText.trim() || "N/A";

            merchantData.push({
                "Merchant Name": name,
                // "Orders": orders,
                // "Rating": rating,
                "Price": `${ price } ${ currency }`,
                "Size/Limit": size_limit,
                // "Payment Methods": payment_methods,
                // "Discount": discount
            });
        });

        return merchantData;
    });

    await browser.close();

    if (merchants.length > 0) {
        console.log(`Successfully extracted ${ merchants.length } merchants!`);
        saveToJson(merchants);
        saveToCsv(merchants);
    } else {
        console.log("No merchants found. Check if the selectors are correct or if the website structure has changed.");
    }
})();

// Function to save data to JSON file
function saveToJson (data) {
    fs.writeFileSync("gateio_p2p_merchants.json", JSON.stringify(data, null, 4), "utf8");
}

// Function to save data to CSV file
function saveToCsv (data) {
    // const csvHeader = "Merchant Name,Orders,Rating,Price,Size/Limit,Payment Methods,Discount\n";
    // const csvRows = data.map(row =>
    //     `"${ row['Merchant Name'] }","${ row.Orders }","${ row.Rating }","${ row.Price }","${ row['Size/Limit'] }","${ row['Payment Methods'] }","${ row.Discount }"`
    // ).join("\n");

    const csvHeader = "Merchant Name,Price,Size/Limit\n";
    const csvRows = data.map(row =>
        `"${ row['Merchant Name'] }","${ row.Price }","${ row['Size/Limit'] }"`
    ).join("\n");

    fs.writeFileSync("gateio_p2p_merchants.csv", csvHeader + csvRows, "utf8");
}

// Function to scroll the page to load all dynamic content
async function autoScroll (page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
