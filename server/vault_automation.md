# Vault Automation & Event Indexing

## Overview
- Scripts for NAV updates, performance fee distribution, and event indexing

## Files
- `vaultAutomation.ts`: Automate NAV/fee actions
- `vaultEventsIndexer.ts`: Listen to MaonoVault events (e.g., NAVUpdated)

## Usage
- Import and call automation functions in jobs or scripts
- Example: `automateNAVUpdate(newNav)`

## Scheduling
- Use cron, PM2, or similar to run scripts on schedule

---
See `blockchain.md` for contract integration details.
