# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application called "suimming-front" built with TypeScript and Tailwind CSS. It follows the App Router pattern and uses pnpm for package management.

## Development Commands

### Core Commands
- `pnpm dev` - Start development server on localhost:3000
- `pnpm build` - Build production application
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint (configured for Next.js with TypeScript)

### Package Management
- Uses `pnpm` as the package manager (pnpm-lock.yaml present)

## Architecture

### Project Structure
- `src/app/` - Next.js App Router directory containing pages and layouts
- `src/app/layout.tsx` - Root layout with Geist fonts configuration
- `src/app/page.tsx` - Home page component
- `src/app/globals.css` - Global CSS with Tailwind directives
- `public/` - Static assets

### Key Technologies
- **Framework**: Next.js 15.5.3 with App Router
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 with PostCSS
- **Fonts**: Geist Sans and Geist Mono from Google Fonts
- **Linting**: ESLint with Next.js and TypeScript configurations

### TypeScript Configuration
- Path mapping: `@/*` maps to `./src/*`
- Target: ES2017
- Strict mode enabled
- JSX: preserve (handled by Next.js)

## Development Notes

### Code Style
- Uses ESLint with Next.js core web vitals and TypeScript rules
- Follows Next.js App Router conventions
- Components use TypeScript with proper typing

### PWA Features
- **Service Worker**: Automatic caching and offline support via `/public/sw.js`
- **Manifest**: Complete PWA manifest at `/public/manifest.json`
- **Icons**: SVG-based app icons with PNG fallbacks
- **Installation**: Custom install prompt with `PWAInstaller` component
- **Mobile Optimization**: Touch-friendly UI and responsive design
- **Geolocation**: Location services integration for maps
- **Performance**: Mobile-optimized WebGL rendering with frame rate limiting

### Mobile-Specific Features
- **Touch Controls**: Enhanced gesture handling for map interactions
- **Location Services**: Automatic user location detection and centering
- **Device Detection**: Performance optimization based on device capabilities
- **Offline Support**: Basic functionality works without internet connection
- **Installation Prompt**: Native-like app installation experience

### Current State
This is a fully functional PWA (Progressive Web App) featuring:
- Interactive WebGL map overlay with Three.js
- Google Maps integration with mobile optimization
- Complete PWA compliance for smartphone installation
- Responsive design optimized for both desktop and mobile
- Location-aware mapping with geolocation API integration