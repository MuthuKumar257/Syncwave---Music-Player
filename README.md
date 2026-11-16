# SyncWave — Smart All-In-One Cross-Platform Music Player

<div align="center">

**An intelligent, multi-source music player ecosystem with automated time-based music scheduling**

*Available on Native Android (`app/`), Cross-Platform React Native (`mobile/`), & Modern Web (`web/`) with a Shared Backend (`server/`)*

</div>

---

## 1. Project Overview

**SyncWave** combines local music playback, multi-source discovery, authorized platform streaming links, offline music management, and intelligent daily scheduling.

The defining innovation is the **Smart Music Scheduler**, which automatically triggers, transitions, and resolves music routines based on user-defined schedules (e.g., focus sessions at 09:00, workout mixes at 18:00, calming ambient textures at 23:00).

---

## 2. Platform Architecture

```
├── app/                  # Native Android Client (Kotlin, Jetpack Compose, Media3, Room, AlarmManager)
├── mobile/               # Cross-Platform Mobile Client (React Native, TypeScript, RN Track Player, Zustand)
├── web/                  # Responsive Web Client (React 18, Vite, TypeScript, Tailwind, Web Audio API, IndexedDB)
├── server/               # Shared Backend API (Node.js, Express, TypeScript, JWT Auth, In-Memory/PostgreSQL)
├── gradle/               # Gradle wrapper and version catalog
├── build.gradle.kts      # Android root build configuration
├── settings.gradle.kts   # Android settings
├── AGENTS.md             # Development instructions & architecture rules
└── README.md             # Project documentation
```

### 2.1 Native Android Application (`app/`)
* **Audio Engine:** AndroidX Media3 `ExoPlayer` wrapped in a centralized `PlaybackManager`.
* **Background Service:** Native `MediaSessionService` (`SyncWaveMediaSessionService`) ensuring continuous audio during lock-screen, screen-off, and app switching.
* **Smart Scheduler:** Hardware-level exact background alarms via `AlarmManager.setExactAndAllowWhileIdle`, `BroadcastReceiver` handlers, and `RECEIVE_BOOT_COMPLETED` reboot recovery.
* **Local Storage:** `MediaStore` scanner + Room SQLite database (`SyncWaveDatabase`) with 8 entities.
* **Theme:** Dark-first Material 3 palette (`#101014`, `#1B1B23`, `#8B5CF6`, `#22C55E`, `#FFFFFF`, `#A1A1AA`).

### 2.2 Cross-Platform Mobile Application (`mobile/`)
* **Framework:** React Native 0.76.5 + TypeScript with React Navigation 7 (NativeStack + BottomTabs).
* **Audio Engine:** `react-native-track-player` for reliable native Android and iOS background audio services, lock screen controls, and remote media key events.
* **State Management & Caching:** Zustand 5.0 for modular, responsive client stores (`usePlayerStore`, `useRecommendationStore`, `useSearchStore`, `useDownloadStore`, `useLocalMusicStore`) and TanStack Query 5 for server state.
* **Onboarding & Personalization:** Two-step onboarding flow featuring Language Selection followed by combined Music Directors and Singers on the **SAME SCREEN** (segmented tabs with preserved selection sets).
* **Universal Search:** Multi-faceted search across cinema movie soundtracks, individual song versions (originals, videos, remixes, covers), directors, and singers.
* **Theme:** Graphite Unslop design tokens (`#0F0F10`, `#141415`, `#19191B`, `#F59E0B`, 14dp card radius, 8dp control radius).

### 2.3 Responsive Web Client (`web/`)
* **Audio Engine:** `WebAudioPlayer` using HTML5 Audio + Web Audio API (`AudioContext`, `GainNode` crossfading, Media Session API for system media keys).
* **Autoplay Resilience:** Gracefully detects and handles browser autoplay restrictions with one-click user gesture activation.
* **Privacy-Preserving Storage:** Browser `IndexedDB` stores user-uploaded audio files directly on the client without uploading to external servers without consent.
* **Active Web Scheduler:** In-browser scheduling engine checking routines every 10s, resolving conflicts by priority, and executing crossfades.
* **Progressive Web App:** Web App Manifest (`manifest.json`) and responsive mobile/desktop design.

### 2.3 Shared Cloud Backend (`server/`)
* **REST API:** Express.js + TypeScript with JWT authentication and bcrypt password hashing.
* **Universal Search Engine:**
  * Multi-Platform Integrations: YouTube Data API, Spotify Web API, Apple Music / iTunes API, MusicBrainz API.
  * Indian Cinema Support: Transliteration, regional languages (Tamil, Telugu, Hindi, Malayalam, Kannada, Punjabi, Bengali), composer aliases (A.R. Rahman, Harris Jayaraj, Anirudh, Ilaiyaraaja, etc.).
  * Dedicated Movie Soundtrack Grouping & Version Categorization (Original, Music Video, Live, Cover, Remix, Instrumental).
* **Endpoints:**
  * Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
  * Playlists: `/api/playlists`
  * Schedules: `/api/schedules`, `/api/schedules/:id/execution`, `/api/schedules/history/all`
  * Favorites & History: `/api/favorites`, `/api/history`
  * Universal Search: `/api/search`, `/api/movies/:id/soundtracks`, `/api/songs/:id/versions`, `/api/artists/:id/songs`, `/api/search/suggestions`, `/api/search/platforms`
  * Discovery: `/api/music/search`, `/api/music/discover`, `/api/music/integrations`
* **Data Layer:** Schema migration script (`schema.sql`) for PostgreSQL / Supabase with in-memory persistence (`store.ts`).

---

## 3. Quick Start Guide

### Prerequisites
* **Node.js:** v18+ (Node v20+ recommended)
* **Java:** JDK 17 (Microsoft OpenJDK 17 recommended for Android Gradle)
* **Android SDK:** API 34+ (compileSdk: 35, minSdk: 26)

---

### Step 1: Start the Shared Backend (`server/`)

```powershell
cd server
npm install
npm run dev
```

* Backend runs at: `http://localhost:3001`
* Health Check: `http://localhost:3001/api/health`
* Run Automated Tests: `npm test`

---

### Step 2: Start the Web Client (`web/`)

```powershell
cd web
npm install
npm run dev
```

* Web Application runs at: `http://localhost:3000`
* Run Web Tests: `npm test`
* Build Production Bundle: `npm run build`

---

### Step 3: Build the Android Application (`app/`)

```powershell
# From root directory:
.\gradlew.bat testDebugUnitTest   # Runs local unit test suite
.\gradlew.bat assembleDebug       # Produces app/build/outputs/apk/debug/app-debug.apk
```

The generated APK can be installed on any Android 8.0+ (API 26+) physical device or emulator via:
```powershell
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## 4. Universal Movie & Song Search Engine

SyncWave features an intelligent search engine tailored for music discovery across cinema soundtracks and streaming platforms:

### 4.1 Search Dimensions
* **Movie-Based Search:** Querying a movie (e.g., *"Vaaranam Aayiram"*, *"Leo"*, *"Ala Vaikunthapurramuloo"*) retrieves full soundtrack groupings, release years, composers, language tags, tracklists with lead singers, duration, and one-click "Play All".
* **Song-Based Search:** Querying an individual song (e.g., *"Nenjukkul Peidhidum"*, *"Naa Ready"*, *"Chaleya"*) categorizes results into versions:
  * **Original Recordings:** Studio album/soundtrack release.
  * **Official Music Videos:** Official video release.
  * **Live Performances:** Concert and unplugged performances.
  * **Covers & Renditions:** Verified creator and artist covers.
  * **Remixes:** Club, EDM, and acoustic remixes.
  * **Instrumentals & BGMs:** Karaokes and movie background scores.
* **Multi-Platform Search:** Queries YouTube, Spotify, Apple Music, and MusicBrainz in parallel with non-blocking error handling and automatic deduplication.
* **Indian Cinema Engine:** Deep support for Tamil, Telugu, Hindi, Malayalam, Kannada, Punjabi, and Bengali music with Latin transliteration, Unicode native script parsing, and composer alias resolution.
* **Playback & Compliance:** Adheres strictly to platform policies—official 30-sec previews for direct audio playback, embedded official YouTube video player modal for web, and deep links for complete official catalog access.

---

## 5. AI-Powered Music Recommendation & Language-Based Discovery

SyncWave provides a personalized music recommendation and discovery system:

### 5.1 Multi-Signal Scoring Engine
The recommendation engine combines 8 normalized signal dimensions:
```
Recommendation Score =
    Language Match Score (35%)
  + Artist & Composer Preference (30%)
  + Genre & Mood Similarity (20%)
  + Movie Soundtrack Affinity (20%)
  + Explicit Feedback (Like +20, Hide -1000)
  + Listening Behaviour (Completes +6, Replays +8, Skips -8)
  + Time of Day Context (15%)
  + Discovery Diversity Score (10%)
```

### 5.2 Recommendation Categories
* **Made for You:** Personalized mix combining preferred languages, composers, and listening history.
* **Language-Specific Sections:** Dedicated carousels for each selected language:
  * *Recommended in [Language]* (e.g., Tamil, Telugu, Hindi, Malayalam, Kannada, Punjabi, English)
  * *Trending [Language] Songs*
  * *Popular Movie Soundtracks* with tracklists and "Play All"
* **Because You Listened To:** Contextual recommendations expanding on recent artists/composers (e.g. A. R. Rahman, Harris Jayaraj).
* **Your Daily Mixes:** Five dynamic auto-generated mixes (Language Daily Mix, Evergreen Melody Mix, Master Composers Mix, High Tempo Workout Mix, and Calm Relaxing Mix).
* **Time-Based Contextual Music:** Dynamic music matching user context:
  * *Morning (05:00 - 12:00):* Devotional, morning energy & melody
  * *Afternoon (12:00 - 17:00):* Focus acoustics & peaceful textures
  * *Evening (17:00 - 22:00):* Prime melodies & upbeat cinema hits
  * *Night (22:00 - 05:00):* Calm ambient, sleep & instrumental
* **Smart Playlist Generator:** Interactive tool allowing users to pick a language, mood/genre, and target duration (30, 45, 60, 90 mins) to synthesize, preview, play, or save custom playlists to their library.
* **Privacy & User Control:** Granular controls to toggle personalization, disable history tracking, and one-click reset preference weights.

---

## 6. Verification & Testing Matrix

| Tier | Component | Command | Result |
| :--- | :--- | :--- | :--- |
| **Android** | Unit Tests | `.\gradlew.bat testDebugUnitTest` | **PASSED** (9 executed, 21 up-to-date) |
| **Android** | Debug APK Package | `.\gradlew.bat assembleDebug` | **PASSED** (`app-debug.apk` 23.4 MB) |
| **Backend** | API Test Suite | `cd server && npm test` | **PASSED** (32/32 vitest tests) |
| **Backend** | TypeScript Compile | `cd server && npm run build` | **PASSED** (0 errors) |
| **Web** | Engine Unit Tests | `cd web && npm test` | **PASSED** (2/2 vitest tests) |
| **Web** | Production Bundle | `cd web && npm run build` | **PASSED** (0 errors, 314 kB JS, 36 kB CSS) |

---

## 7. License

Developed for the SyncWave Smart Music Ecosystem. All rights reserved.

