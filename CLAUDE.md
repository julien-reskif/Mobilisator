# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobilisator is a French electoral data visualization application (formerly OEP - On Est Prêt). It allows users to search for French cities and view detailed election results, population demographics, and voting analysis data. The app is a single-page application (SPA) with a static file server, designed for GitHub Pages deployment.

## Commands

```bash
# Install dependencies
bun install

# Fetch and process election data from data.gouv.fr
bun run fetch:elections

# Build the application (compiles app.ts and generates search index)
bun run build

# Run development server on port 3000
bun run dev

# Individual build steps
bun run build:app    # Compile TypeScript to public/app.js
bun run build:index  # Generate search index in public/cities/
```

## Architecture

### Tech Stack
- **Runtime**: Bun (TypeScript runtime and package manager)
- **Frontend**: Vanilla TypeScript SPA with client-side routing
- **Backend**: Bun.serve() static file server with SPA fallback
- **Linting**: Biome (tab indentation, double quotes)

### Data Pipeline
1. **Fetch** - Pull raw election data from 3 data.gouv.fr sources
2. **Process** (`src/process-elections.ts`) - Merge data sources, handle special commune mappings (Marseille, Paris)
3. **Index** (`src/index.ts`) - Build n-gram search index, generate per-city JSON files
4. **Serve** - Static files with 1-hour cache headers

### Key Files
- `src/app.ts` - SPA frontend logic (search, routing, UI rendering)
- `src/server.ts` - Static file server with SPA fallback
- `src/index.ts` - Search index generator
- `src/process-elections.ts` - Election data transformation pipeline
- `src/dtos/city.ts` - TypeScript interfaces for all data models
- `public/cities/` - Generated search index and city data files (~20k files)

### Search Implementation
- N-gram prefix matching (2-45 characters)
- Query normalization: removes accents, lowercases, splits on whitespace
- Index files: `public/cities/search/{normalized-query}.json`
- Results limited to 20 cities per n-gram, sorted by name length

### SPA Routing
- `/` - Search view
- `/:slug` - City detail view (e.g., `/76100-rouen`)
- All undefined routes fallback to `index.html`

## Code Conventions

- French used for data field names and UI labels (e.g., `nom_standard`, `code_departement`)
- English for utility functions and comments
- File naming: kebab-case
- Generated city data committed to git for GitHub Pages deployment
