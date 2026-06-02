# Herdly

Herdly is an offline, single-admin farm management desktop application for livestock and poultry farms. It runs with Electron, React, TypeScript, and embedded SQLite, so no external database or internet connection is required after installation.

## Quick Start

```bash
npm install
npm run dev
```

## Browser-Only Preview

```bash
npm run dev:web
```

When previewed in a browser, Herdly uses localStorage as a safe fallback because Electron's `window.herdly` SQLite bridge is not available.

## Build Windows Installer

```bash
npm run dist
```

The NSIS setup wizard is written to `release/HerdlySetup.exe`. Copy that single file to a USB flash drive and run it on a Windows PC; the target machine does not need Node.js, npm, Visual Studio, or any manual database setup.

## better-sqlite3 Native Module Fix

If Electron reports a native module mismatch for `better-sqlite3`, rebuild it:

```bash
npm run rebuild
```

The project is pinned to an Electron and `better-sqlite3` pairing that has a Windows x64 prebuilt SQLite binary, so Visual Studio Build Tools are not required for the normal installer build.

## Data Storage

In the packaged desktop app, Herdly stores data in Electron's OS `userData` folder as `herdly.sqlite`. No external database server is needed.

## Backup

Open Settings, choose Export Backup, and save the JSON backup to a flash drive or another safe location.

## Restore

Open Settings, choose Import Backup, and select a Herdly JSON backup file. The app clears the current tables and restores the imported records.

## Adding a New Species Later

Add the species plugin entry in `src/data/species.ts`, then add the corresponding adaptive logic in `src/utils/reportHelpers.ts`. Screens, selectors, reports, forms, and charts derive their behavior from those two files.

## Recommended Next Upgrades

- Animal photo uploads with image paths stored in the animals table
- CSV / Excel export of any table
- SMS or WhatsApp low-stock alerts through Africa's Talking API
- Kiswahili language toggle
- Automatic vaccination reminder calendar with due-date alerts
- Weight tracking charts and feed conversion ratios for beef and pigs
- Offline-first mobile companion app for staff data entry
- Client licensing system for selling Herdly to multiple farms
