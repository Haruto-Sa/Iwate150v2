# VOJA IWATE (English)

**VOJA IWATE** is a public-facing travel app for Iwate, Japan. It helps visitors discover places through maps, search, spot detail pages, and a playful camera experience.

This repository is prepared for public sharing. When environment variables are missing, the app still runs with mock/sample data.

## Tech Stack

- Next.js 16
- TypeScript
- Supabase
- NextAuth
- Leaflet / OpenStreetMap
- MediaPipe
- Three.js
- bun

## Public Routes

- `/` Home
- `/map` Map
- `/search` Search
- `/guide` Guide
- `/camera` Camera
- `/spots/[slug]` Spot details
- `/stamps` Stamps
- `/favorites` Favorites
- `/login` Login

## Setup

```bash
bun install
bun run dev
```

Optional environment variables are only required when enabling Supabase or authentication providers in a real deployment.

## Policy Notes

- Core browsing features stay available without login.
- Save-oriented features can request login later, only when needed.
- Private workspace access is protected on the server side.
- Private SQL and internal data operations are intentionally not described in this public repository.

## License

The final license is still under review while rights for dependencies, assets, and models are being confirmed.
