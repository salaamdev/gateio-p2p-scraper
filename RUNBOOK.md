# Gate.io P2P Scraper – Runbook

This runbook explains how to set up, run, and troubleshoot the scraper on Linux.

## Prerequisites

- Node.js 18+ and npm
- Internet access
- Optional: Google Chrome/Chromium if you want to use a system browser

## Install

- From the project root:
  - npm install

## Environment variables

- CHROME_EXECUTABLE: Absolute path to Chrome/Chromium. Leave unset to use Puppeteer’s bundled Chromium.
  - Example: export CHROME_EXECUTABLE=/usr/bin/google-chrome-stable

## How to run

- One-off scrape:
  - npm run scrape:once
- Continuous scraping every 60s:
  - npm start

Outputs are written to:

- data/gateio_p2p_merchants.json
- data/gateio_p2p_merchants.csv
- data/filtered_merchants.json
- data/filtered_merchants.csv

Logs:

- logs/activity.log
- logs/errors.log
- logs/warnings.log

## Troubleshooting

- Error: Browser was not found at the configured executablePath
  - Clear CHROME_EXECUTABLE or point it to a valid Chrome path. By default we now use Puppeteer’s Chromium.
- Timeout waiting for selectors
  - The site structure may have changed. Update selectors in scraper/extract.js and scraper/scraper.js (waitForSelector).
- Permission errors writing files
  - Ensure the process has write permissions to data/ and logs/.

## File layout (what goes where)

- index.js: Entrypoint that schedules scraping every 60s.
- scraper/scraper.js: Orchestrates Puppeteer, scrolling, extraction, and saving.
- scraper/config.js: URL and Chrome path configuration (via env).
- scraper/autoScroll.js: Scroll helper to load dynamic content.
- scraper/extract.js: Page selectors and data extraction.
- scraper/dataSaver.js: Writes JSON/CSV to data/.
- scraper/filterMerchant.js: Picks merchant around a target (default: coinftw) and saves filtered files.
- scraper/logger.js: Appends log lines into logs/.
- data/: Output files.
- logs/: activity/errors/warnings.

## Notes

- Respect site terms and robots.txt. Use responsibly.
