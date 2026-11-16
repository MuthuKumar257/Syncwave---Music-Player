# AGENTS.md — SyncWave Cross-Platform Smart Music Player

## 1. Project Overview

**Project Name:** SyncWave  
**Project Type:** Cross-Platform Smart Music Player Ecosystem  
**Platforms:**
1. **Android Native Application (`app/`):** Kotlin, Jetpack Compose, Material 3, AndroidX Media3 (ExoPlayer & MediaSessionService), Room Database, AlarmManager.
2. **React Native Cross-Platform Application (`mobile/`):** React Native, TypeScript, React Navigation, Zustand, TanStack Query, React Native Track Player (`react-native-track-player`), AsyncStorage.
3. **Web Application (`web/`):** React, Vite, TypeScript, Tailwind CSS, Zustand, HTML5 Audio API, Web Audio API, IndexedDB.
4. **Shared Backend (`server/`):** Node.js, Express.js, TypeScript, REST API, JWT Authentication, PostgreSQL / Supabase schema.

SyncWave combines local music playback, online music discovery, authorized streaming platform references, offline downloads, playlist management, and automated time-based music scheduling.

The primary differentiator is the **Smart Music Scheduler**, which automatically triggers and transitions music according to user-defined schedules and daily routines.

## 2. Cross-Platform Guidelines

1. **Independent Playback Engines:**
   - Android Native utilizes AndroidX Media3 `ExoPlayer` and `MediaSessionService` for reliable lock-screen and background playback.
   - React Native Mobile utilizes `react-native-track-player` for native Android & iOS audio service, system lockscreen controls, and remote media session events.
   - Web utilizes the browser `HTML5 Audio API` and `Web Audio API` (with `MediaSession` Web API for system media key integration).
   - Do not attempt to share platform-specific audio code between engines.
2. **Shared Data & API Contracts:**
   - Android Native, React Native Mobile, and Web all communicate with the shared Express.js backend (`server/`).
   - Synchronize user accounts, playlists, favorites, schedule definitions, listening history, and user preferences.
   - Store local audio files locally (MediaStore on Android; AsyncStorage / device paths on React Native; IndexedDB on Web) unless explicitly uploaded.
3. **Onboarding & Taste Profile Requirements:**
   - Step 1: Multi-language selection cards.
   - Step 2: Combined Music Directors & Singers selection on the **SAME SCREEN** (tabs/segmented control, never split into two pages).
4. **Scheduler Implementation Differences:**
   - Android utilizes `AlarmManager` (`setExactAndAllowWhileIdle`) and `BroadcastReceiver` for true background scheduling when the app is closed or device is locked.
   - Web provides an **Active Web Scheduler** that executes scheduled routines while the web application is active and running in the browser.
5. **Security & Licensing:**
   - Store credentials securely (JWT in secure storage, bcrypt for password hashing).
   - Never extract protected audio streams or bypass DRM.
   - Use official APIs and authorized playback mechanisms only.

## 3. Directory Layout

```text
/
├── app/                  # Native Android Client (Kotlin, Jetpack Compose, Media3)
├── mobile/               # Cross-Platform Mobile Client (React Native, TypeScript, RN Track Player)
├── web/                  # Responsive Web Application (React, Vite, TypeScript, Tailwind)
├── server/               # Shared REST API Backend (Node.js, Express, TypeScript)
├── gradle/               # Android Gradle configuration
├── build.gradle.kts      # Android root build file
├── settings.gradle.kts   # Android settings file
└── AGENTS.md             # Development guidelines
```

## 4. Definition of Done

A feature is complete only when:
- Its functionality is implemented on the target platform.
- UI is responsive, dark-first, and connected to real state and persistence.
- Platform limitations are handled gracefully.
- Automated tests pass.
- All modules (Android, Web, Backend) compile and build cleanly.

