# AGENTS.md — SyncWave

## 1. Project Overview

**Project Name:** SyncWave  
**Project Type:** Android Smart Music Player  
**Primary Language:** Kotlin  
**UI Framework:** Jetpack Compose  
**Architecture:** Clean Architecture + MVVM

SyncWave is an intelligent, multi-source music player that combines local music playback, online music discovery, authorized streaming integrations, offline downloads, playlist management, and automated time-based music scheduling.

The main differentiating feature is its **Smart Music Scheduler**, which automatically switches songs or playlists according to user-defined schedules.

Build this as a production-oriented Android application with a modern interface, reliable background playback, efficient resource usage, and modular architecture.

## 2. Primary Objectives

1. Play music from local device storage.
2. Discover music through supported online platforms.
3. Integrate authorized music streaming services.
4. Download audio from sources that explicitly permit downloading.
5. Create and manage custom playlists.
6. Schedule songs and playlists for specific times.
7. Automatically switch music when a schedule becomes active.
8. Play music in the background.
9. Control playback through notifications and the lock screen.
10. Manage listening history and favourites.
11. Support offline playback.
12. Synchronize supported application settings across devices.

## 3. Technology Stack

Use the following technologies unless a technical limitation requires a documented alternative.

### Android development
- Kotlin
- Jetpack Compose
- Material 3
- Android SDK
- Navigation Compose
- Kotlin Coroutines
- Kotlin Flow

### Audio playback
- AndroidX Media3
- ExoPlayer
- MediaSession
- MediaSessionService
- Android AudioManager

### Local database
- Room Database
- DataStore Preferences

### Background execution
- AlarmManager
- WorkManager
- BroadcastReceiver
- Foreground Service where appropriate

### Networking
- Retrofit
- OkHttp
- Kotlin Serialization

### Cloud services (optional)
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Messaging

### Testing
- JUnit
- MockK
- Compose UI Testing
- Android Instrumentation Testing

## 4. Architecture Guidelines

Follow Clean Architecture and MVVM.

Separate the application into:

**Presentation Layer**
- Compose screens
- Reusable UI components
- Navigation
- ViewModels
- UI state management

**Domain Layer**
- Business logic
- Use cases
- Repository interfaces
- Scheduling rules
- Playlist operations
- Playback decisions

**Data Layer**
- Room database
- DataStore
- Repository implementations
- Local audio scanning
- External API integrations
- Download management

**Service Layer**
- Audio playback
- Background playback
- Scheduled playback execution
- Media notifications
- Audio focus management

Do not place business logic directly inside Composable functions.

Use dependency injection consistently. Prefer Hilt.

## 5. Application Modules

### 5.1 Home

Implement:
- Recently played music.
- Recently added songs.
- Favourite playlists.
- Recommended music.
- Quick access to scheduler.
- Mini-player.
- Music discovery shortcuts.

### 5.2 Local Music Library

Implement:
- Scan device audio files.
- Read audio metadata.
- Extract album artwork.
- Organize by artists, albums and genres.
- Search songs.
- Sort music.
- Create playlists.
- Detect duplicate files.
- Refresh library when files change.

Support MP3, WAV, FLAC, AAC, OGG and other formats supported by the playback engine.

Use MediaStore and Storage Access Framework appropriately.

Do not request unnecessary storage permissions.

### 5.3 Music Player

Use Android Media3 ExoPlayer.

Implement:
- Play and pause.
- Previous and next.
- Seek bar.
- Shuffle.
- Repeat.
- Playback queue.
- Crossfade.
- Playback speed.
- Volume controls.
- Equalizer integration.
- Sleep timer.
- Audio focus handling.

Playback must continue when the application moves to the background.

Use MediaSessionService for background playback.

Do not create separate ExoPlayer instances for every screen.

Maintain a centralized playback manager.

### 5.4 Online Music Discovery

Provide a unified search interface.

Implement platform integrations through official APIs and permitted playback mechanisms.

Potential integrations:
- YouTube Data API.
- Spotify Web API.
- Apple Music API / MusicKit.

Important restrictions:
- Never extract protected audio streams.
- Never bypass subscriptions or DRM.
- Never download copyrighted music without authorization.
- Respect platform API policies and attribution requirements.
- Do not claim that an online song is playable unless its playback method is supported.
- Store credentials securely.
- Never expose private API secrets in source code.

If a platform does not permit direct playback, provide an option to open the original application or website.

### 5.5 Download Manager

Implement:
- Authorized audio downloads.
- Download progress.
- Pause and resume where supported.
- Cancel downloads.
- Retry failed downloads.
- Download history.
- Storage management.
- Automatic library synchronization.

Only download content that is explicitly authorized for downloading.

Never implement YouTube audio extraction or DRM bypass.

### 5.6 Playlist Management

Implement:
- Create playlist.
- Edit playlist.
- Delete playlist.
- Add and remove songs.
- Reorder songs.
- Favourite playlists.
- Playlist artwork.
- Playlist duration.
- Import and export where permitted.

Support playlists containing local files and supported online references.

### 5.7 Smart Music Scheduler

This is the most important module.

Users must be able to schedule music according to their daily routines.

Each schedule should support:
- Schedule name.
- Start time.
- Optional end time.
- Selected playlist.
- Individual song selection.
- Start date.
- End date.
- Selected weekdays.
- Repeat frequency.
- Priority.
- Enabled or disabled status.
- Transition duration.
- Volume preference.
- Offline fallback playlist.

Example:

| Time | Playlist |
|---|---|
| 06:00 AM | Morning Devotional |
| 08:00 AM | Energetic Music |
| 01:00 PM | Relaxing Music |
| 06:00 PM | Workout Music |
| 10:00 PM | Sleep Music |

#### Scheduler execution workflow

1. User creates a schedule.
2. Save schedule in Room.
3. Register the next alarm.
4. Wait for the scheduled trigger.
5. Receive the alarm through BroadcastReceiver.
6. Validate that the schedule is active.
7. Check schedule priority.
8. Resolve the requested playlist.
9. Check whether the music is available.
10. Communicate with the playback service.
11. Apply the configured transition.
12. Start the scheduled music.
13. Record execution history.
14. Register the next occurrence.

#### Scheduling rules

- Support multiple schedules.
- Handle overlapping schedules.
- Support one-time and recurring schedules.
- Support device reboot recovery.
- Handle time-zone changes.
- Handle manual playback overrides.
- Support missed schedule policies.
- Avoid registering unnecessary duplicate alarms.
- Always validate schedules before execution.

#### Android background restrictions

Use AlarmManager for time-based triggers where appropriate.

Use exact alarms only when the application qualifies and the required permissions are available.

Account for:
- Android Doze mode.
- Battery optimization.
- Exact alarm permissions.
- Device reboot.
- Application force-stop.
- Device shutdown.
- Time-zone changes.

Do not use WorkManager as a substitute for exact-time playback scheduling.

WorkManager should be used for deferrable work such as synchronization and cleanup.

Do not promise exact-time execution when Android or device restrictions prevent it.

### 5.8 Schedule Conflict Resolution

Provide the following policies:

1. Higher priority schedule takes precedence.
2. New schedule replaces existing playback.
3. Current playlist finishes before switching.
4. Ignore overlapping schedules.
5. Allow manual override.

Implement conflict resolution in a dedicated class.

### 5.9 Playback History

Store:
- Song ID.
- Playback start time.
- Playback end time.
- Listening duration.
- Playback source.
- Playlist ID.

Provide recently played and frequently played sections.

### 5.10 Settings

Implement:
- Dark and light themes.
- Audio settings.
- Default music source.
- Download location.
- Scheduler preferences.
- Notification preferences.
- Privacy controls.
- Listening history management.
- Cloud synchronization settings.

## 6. Database Design

Use Room Database.

Create entities for:

- Song
- Artist
- Album
- Playlist
- PlaylistSong
- MusicSchedule
- ScheduleDay
- DownloadTask
- Favorite
- PlayHistory
- ScheduleHistory
- AppPreference

Use proper primary keys, foreign keys and indexes.

Use database migrations when schemas change.

Avoid destructive migrations in production.

Store local file URIs and metadata safely. Handle missing or moved files gracefully.

### MusicSchedule fields

- id
- name
- startTime
- endTime
- startDate
- endDate
- repeatType
- playlistId
- songId
- priority
- enabled
- transitionType
- transitionDuration
- volume
- missedSchedulePolicy

Use appropriate Kotlin and Room types rather than storing all values as unstructured strings.

## 7. UI and Design Guidelines

Create a premium, modern music-player interface.

### Design direction

- Dark-first design.
- Premium music application aesthetic.
- Clean layouts.
- Smooth transitions.
- Large album artwork.
- Rounded cards.
- Subtle gradients.
- Consistent spacing.
- Responsive layouts.
- Material 3 components.

### Suggested color palette

- Background: #101014
- Surface: #1B1B23
- Primary: #8B5CF6
- Secondary: #22C55E
- Primary text: #FFFFFF
- Secondary text: #A1A1AA

Keep colors centralized in the theme system.

Do not hardcode colors in individual screens.

### Bottom navigation

Use five main destinations:

1. Home
2. Discover
3. Library
4. Scheduler
5. Settings

Provide a persistent mini-player when music is available.

The full-screen player should display album artwork, track information, progress, playback controls and queue access.

Prioritize usability over decorative animations.

## 8. Coding Standards

- Use Kotlin idioms.
- Follow SOLID principles.
- Use MVVM.
- Keep functions small and focused.
- Use descriptive class and variable names.
- Use StateFlow for UI state where appropriate.
- Use immutable UI state models.
- Handle errors explicitly.
- Avoid blocking the main thread.
- Use Dispatchers.IO for appropriate I/O operations.
- Avoid unnecessary recompositions.
- Avoid memory leaks.
- Use dependency injection.
- Keep API keys out of source control.
- Avoid duplicate business logic.
- Do not use deprecated APIs without a documented reason.
- Add comments for complex logic, not obvious code.
- Avoid placeholder implementations in completed features.

Do not create a massive single Activity or ViewModel.

## 9. Security and Privacy

- Store sensitive credentials using Android Keystore-backed secure storage.
- Do not expose API secrets in the application repository.
- Request permissions only when required.
- Explain why permissions are needed.
- Protect user-selected file access.
- Avoid uploading local music without user consent.
- Do not collect unnecessary personal information.
- Provide controls to clear listening history.
- Use HTTPS for network communication.

## 10. Error Handling

Handle:
- Audio file unavailable.
- Unsupported audio format.
- Missing album artwork.
- No internet connection.
- Online API failure.
- Expired authentication.
- Download failure.
- Storage permission denied.
- Exact alarm permission denied.
- Scheduled playlist unavailable.
- Device reboot.
- Playback service interruption.
- Duplicate schedule.
- Invalid schedule time.

Display useful error messages.

Never silently ignore important playback or scheduling failures.

## 11. Testing Requirements

### Unit testing

Test:
- Playlist operations.
- Schedule validation.
- Schedule recurrence.
- Priority resolution.
- Conflict management.
- Missed schedule policies.
- Repository operations.

### Integration testing

Test:
- Room database.
- Playback service.
- MediaSession.
- Alarm registration.
- Schedule execution.
- Local music scanning.
- Download management.

### UI testing

Test:
- Navigation.
- Music library.
- Player controls.
- Playlist creation.
- Schedule creation.
- Schedule editing.
- Settings.
- Permission flows.

### Device testing

Verify:
- Background playback.
- Locked-screen playback.
- Notification controls.
- Bluetooth headphones.
- Device restart recovery.
- Battery optimization behavior.
- Offline playback.
- Different Android versions.

## 12. Development Roadmap

Develop the project incrementally.

### Phase 1: Foundation
- Initialize Android project.
- Configure Gradle.
- Configure dependencies.
- Implement application theme.
- Implement navigation.
- Create reusable components.

### Phase 2: Local Music
- Implement permissions.
- Scan local audio files.
- Extract metadata.
- Create Room entities and DAOs.
- Display songs, albums and artists.
- Implement search.

### Phase 3: Playback
- Integrate Media3.
- Implement playback manager.
- Implement queue.
- Implement MediaSessionService.
- Implement notification controls.
- Implement lock-screen controls.

### Phase 4: Playlist Management
- Create playlists.
- Edit playlists.
- Add and remove songs.
- Implement favourites.
- Implement playback history.

### Phase 5: Smart Scheduler
- Create schedule database entities.
- Build scheduler UI.
- Implement AlarmManager.
- Implement BroadcastReceiver.
- Implement schedule executor.
- Implement conflict resolution.
- Implement reboot recovery.
- Implement execution history.

### Phase 6: Downloads
- Implement authorized download sources.
- Implement download manager.
- Track download status.
- Add completed files to the library.

### Phase 7: Online Integrations
- Implement API interfaces.
- Add online search.
- Implement supported playback integrations.
- Handle authentication.
- Handle API restrictions.

### Phase 8: Final Optimization
- Improve performance.
- Test background behavior.
- Fix lifecycle issues.
- Improve accessibility.
- Add error handling.
- Prepare release build.

## 13. Antigravity Agent Working Instructions

### Before starting a task

1. Inspect the existing project.
2. Read this AGENTS.md file.
3. Understand the existing implementation.
4. Identify affected modules.
5. Check existing dependencies.
6. Create an implementation plan for complex changes.
7. Avoid overwriting existing working code unnecessarily.

### During development

1. Implement one module at a time.
2. Follow the established architecture.
3. Reuse existing components.
4. Keep the application buildable.
5. Add appropriate error handling.
6. Write tests for important business logic.
7. Avoid introducing unnecessary dependencies.
8. Do not use fake API responses as production functionality.
9. Do not create nonfunctional buttons.
10. Do not claim a feature is complete until implemented and tested.

### After completing a task

1. Run Gradle compilation.
2. Run relevant unit tests.
3. Resolve compilation errors.
4. Check Android permissions.
5. Check lifecycle handling.
6. Review modified files.
7. Summarize implemented functionality.
8. Mention remaining limitations.

### Important development rules

- Never implement all modules in one large code-generation operation.
- Do not replace Kotlin with Java unless specifically required.
- Do not replace Jetpack Compose with XML layouts without a documented reason.
- Do not implement illegal music downloading.
- Do not bypass third-party platform restrictions.
- Do not store sensitive credentials in plain text.
- Do not use foreground services unnecessarily.
- Do not guarantee exact alarm execution when permissions or system restrictions prevent it.
- Prefer reliable functionality over unnecessary animations and visual effects.

## 14. Definition of Done

A feature is complete only when:

- Its functionality is implemented.
- Its UI is connected to real application logic.
- Its data is persisted when required.
- Loading and error states are handled.
- Permissions are handled correctly.
- Relevant tests pass.
- The application compiles successfully.
- It follows the architecture and coding standards in this document.

## 15. First Task for the Agent

Start by inspecting the existing repository and establishing the Android application foundation.

The first implementation milestone should include:

1. Kotlin Android project configuration.
2. Jetpack Compose and Material 3 setup.
3. MVVM and Clean Architecture foundation.
4. Hilt dependency injection.
5. Room database configuration.
6. Navigation Compose.
7. A premium dark theme.
8. Home, Discover, Library, Scheduler and Settings navigation.
9. A reusable mini-player UI component.
10. A successful Gradle build.

Do not implement online integrations or the full scheduling engine during this initial milestone.

First establish a stable, compiling foundation. Then proceed to local music scanning and playback.

---

**Project principle:** SyncWave must be a reliable music player first, a multi-source music platform second, and an intelligent music automation system throughout. Every feature should work with the real application architecture rather than being a visual-only prototype.