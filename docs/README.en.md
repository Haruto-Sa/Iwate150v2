# Iwate150 (English)

**Iwate150** is a tourism information web app for Iwate Prefecture, Japan. This repository is a rebuild using **Next.js**, **Supabase**, **Leaflet**, and **OpenStreetMap**. The previous Flask/MySQL implementation is kept in `legacy/`.

- **Japanese README**: [../README.md](../README.md)
- **This file**: English digest

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase** (auth, database, storage)
- **Leaflet** + **OpenStreetMap** for maps
- **Three.js** for 3D character models
- **Vercel** for deployment
- **Package manager**: bun

## Directory overview

```
.
├── src/
│   ├── app/           # App Router pages (/, /character, /camera, /spot, /search, etc.)
│   ├── components/    # UI, layout, map, character viewer
│   └── lib/           # Supabase client, types, config, storage helpers
├── public/
│   ├── images/        # Spot images, city icons
│   └── models/        # 3D models (.obj, .mtl)
├── supabase/
│   ├── schema.sql     # DB schema
│   └── data/          # CSV data for import
└── legacy/            # Old Flask/MySQL app (reference only)
```

## Setup

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Environment variables**  
   Create `.env.local` (or set in Vercel) with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   The app falls back to mock data if these are missing.

3. **Run dev server**
   ```bash
   bun run dev
   ```

## Main routes

| Path         | Description                    |
| ------------ | ------------------------------ |
| `/`          | Home, calendar, links          |
| `/character` | 3D character viewer (yurukyara) |
| `/camera`    | Photo with character (3D)      |
| `/spot`      | Map (Leaflet + OSM)            |
| `/search`    | Spot / event search            |
| `/stamp`     | Location stamp rally           |
| `/ar`        | AR experience                  |
| `/login`     | Auth (Supabase)                 |

## Database

Apply `supabase/schema.sql` then `supabase/seed.sql` (via Supabase Dashboard SQL Editor or CLI). See the Japanese README for CSV import and Supabase setup details.

## Credits

- Map tiles: OpenStreetMap
- Framework: Next.js, Leaflet, Supabase
