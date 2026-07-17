# Sentinel Backend

This directory is reserved for future Sentinel backend services.

## Purpose

The desktop application runs entirely on-device with no backend requirement. Backend services will be introduced only when they unlock capabilities the local model cannot provide:

- **Cloud History Sync** — persist and sync analysis history across devices
- **Performance Tracker** — evaluate past trade setups after the fact (requires long-lived storage)
- **Collaborative Watchlists** — share symbol lists and analysis across users
- **Webhook Alerts** — push notifications when a symbol crosses a confidence threshold

## Planned Stack

Undecided. Candidates include a lightweight Hono/Express service deployed on a managed platform (Railway, Fly.io) or a serverless approach (Cloudflare Workers + D1).

## Roadmap

| Milestone | Status |
|-----------|--------|
| Cloud History Sync API | Planned (v1.x) |
| Performance Tracker storage | Planned (v1.x) |
| Authentication layer | Planned |
| Webhook / notification delivery | Planned |

## Current Status

**Not started.** The desktop application is self-contained and fully functional without this service.
