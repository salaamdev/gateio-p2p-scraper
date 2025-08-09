# Gate.io P2P Scraper

This scraper extracts P2P merchant listings from Gate.io and writes JSON/CSV. It can run once or on a 60s interval.

## Install

```bash
npm install
```

## Run

- One-off scrape:

```bash
npm run scrape:once
```

- Continuous (every 60 seconds):

```bash
npm start
```

Outputs:

- `data/gateio_p2p_merchants.json`
- `data/gateio_p2p_merchants.csv`
- `data/filtered_merchants.json`
- `data/filtered_merchants.csv`

Logs:

- `logs/activity.log`
- `logs/errors.log`
- `logs/warnings.log`

## Configuration

- URL is set in `scraper/config.js`.
- To force a specific Chrome/Chromium binary, set `CHROME_EXECUTABLE`:

```bash
export CHROME_EXECUTABLE=/usr/bin/google-chrome-stable
```

If unset, Puppeteer’s bundled Chromium is used.

See `RUNBOOK.md` for troubleshooting and details.
