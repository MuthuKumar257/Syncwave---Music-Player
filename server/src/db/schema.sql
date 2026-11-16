-- SyncWave PostgreSQL / Supabase Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    auth_provider VARCHAR(50) DEFAULT 'EMAIL',
    google_sub VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    welcome_email_sent BOOLEAN DEFAULT FALSE,
    welcome_email_sent_at TIMESTAMPTZ,
    welcome_email_status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs (Metadata)
CREATE TABLE IF NOT EXISTS songs (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) DEFAULT 'Unknown Artist',
    album VARCHAR(255) DEFAULT 'Unknown Album',
    duration_ms BIGINT DEFAULT 0,
    artwork_url TEXT,
    source VARCHAR(50) DEFAULT 'LOCAL',
    external_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    artwork_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist Songs Cross Reference
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id VARCHAR(100) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (playlist_id, song_id)
);

-- Music Schedules
CREATE TABLE IF NOT EXISTS music_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5),
    start_date DATE,
    end_date DATE,
    repeat_type VARCHAR(30) DEFAULT 'DAILY',
    days_of_week INT[] DEFAULT ARRAY[1,2,3,4,5],
    target_type VARCHAR(20) DEFAULT 'PLAYLIST',
    target_id VARCHAR(100) NOT NULL,
    target_name VARCHAR(255) NOT NULL,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    is_enabled BOOLEAN DEFAULT TRUE,
    transition_type VARCHAR(20) DEFAULT 'CROSSFADE',
    transition_sec INT DEFAULT 3,
    volume FLOAT DEFAULT 0.8,
    missed_policy VARCHAR(30) DEFAULT 'SKIP',
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule History
CREATE TABLE IF NOT EXISTS schedule_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES music_schedules(id) ON DELETE SET NULL,
    schedule_name VARCHAR(150) NOT NULL,
    target_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    status_message TEXT,
    client_platform VARCHAR(20) NOT NULL
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_id, target_type)
);

-- Play History
CREATE TABLE IF NOT EXISTS play_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id VARCHAR(100) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    song_title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    duration_listened_ms BIGINT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    client_platform VARCHAR(20) NOT NULL
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_dark_mode BOOLEAN DEFAULT TRUE,
    crossfade_enabled BOOLEAN DEFAULT TRUE,
    crossfade_duration_sec INT DEFAULT 3,
    playback_speed FLOAT DEFAULT 1.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Music Personalization & Preferences
CREATE TABLE IF NOT EXISTS user_music_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_languages TEXT[] DEFAULT ARRAY['Tamil', 'Telugu', 'Hindi'],
    favourite_artists TEXT[] DEFAULT ARRAY[]::TEXT[],
    favourite_genres TEXT[] DEFAULT ARRAY[]::TEXT[],
    favourite_composers TEXT[] DEFAULT ARRAY[]::TEXT[],
    favourite_movies TEXT[] DEFAULT ARRAY[]::TEXT[],
    personalization_enabled BOOLEAN DEFAULT TRUE,
    history_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listening Events for Multi-Signal Recommendation Learning
CREATE TABLE IF NOT EXISTS listening_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id VARCHAR(100) NOT NULL,
    song_title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    language VARCHAR(50),
    genre VARCHAR(50),
    event_type VARCHAR(30) NOT NULL, -- 'PLAY', 'COMPLETE', 'SKIP', 'REPLAY', 'LIKE', 'ADD_TO_PLAYLIST'
    duration_played_sec INT DEFAULT 0,
    total_duration_sec INT DEFAULT 0,
    client_platform VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendation Feedback (Explicit Likes & Hides)
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(30) NOT NULL, -- 'SONG', 'SOUNDTRACK', 'ARTIST'
    feedback_type VARCHAR(20) NOT NULL, -- 'LIKE', 'DISLIKE', 'HIDE'
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_id)
);

-- Generated Daily Mixes
CREATE TABLE IF NOT EXISTS daily_mixes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(255) NOT NULL,
    cover_url TEXT,
    language VARCHAR(50),
    track_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_play_history_user_played ON play_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_events_user_ts ON listening_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id, order_index);

-- Welcome Email Status Columns for Existing Tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'EMAIL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_status VARCHAR(20) DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);



