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

-- Recommendation Feedback (Explicit Likes, Dislikes, Hides & Not Interested)
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(30) NOT NULL, -- 'SONG', 'SOUNDTRACK', 'ARTIST', 'COMPOSER'
    feedback_type VARCHAR(20) NOT NULL, -- 'LIKE', 'DISLIKE', 'HIDE', 'NOT_INTERESTED'
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

-- Playlist Schema Extensions & RLS
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS description TEXT;

-- RLS for Playlists and Playlist Songs
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'playlists' AND policyname = 'Users can manage their own playlists'
    ) THEN
        CREATE POLICY "Users can manage their own playlists" ON playlists
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'playlist_songs' AND policyname = 'Users can manage songs in their own playlists'
    ) THEN
        CREATE POLICY "Users can manage songs in their own playlists" ON playlist_songs
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM playlists
                    WHERE playlists.id = playlist_songs.playlist_id
                    AND (playlists.user_id = auth.uid() OR playlists.user_id::text = current_setting('request.jwt.claim.sub', true))
                )
            );
    END IF;
END $$;

-- Favorites Schema Extensions & RLS
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS song_id VARCHAR(100);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS song_title VARCHAR(255);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS artwork_url TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS duration_ms BIGINT DEFAULT 0;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS composer VARCHAR(255);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS movie_name VARCHAR(255);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS language VARCHAR(50);

-- Enable RLS for favorites
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can manage their own favorites'
    ) THEN
        CREATE POLICY "Users can manage their own favorites" ON favorites
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- Welcome Email Status Columns for Existing Tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'EMAIL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_status VARCHAR(20) DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

-- =========================================================================
-- NORMALIZED ARTIST CATALOGUE & MULTILINGUAL SCHEMA (Section 4)
-- =========================================================================

-- Languages
CREATE TABLE IF NOT EXISTS languages (
    id VARCHAR(50) PRIMARY KEY,
    language_name VARCHAR(100) NOT NULL UNIQUE,
    language_code VARCHAR(20) NOT NULL UNIQUE,
    native_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical Artists
CREATE TABLE IF NOT EXISTS artists (
    id VARCHAR(100) PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'SINGER', -- 'DIRECTOR' | 'SINGER' | 'ALL'
    role_title VARCHAR(100),
    image_url TEXT,
    description TEXT,
    known_for TEXT[] DEFAULT ARRAY[]::TEXT[],
    popular_tracks TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artist Languages (Many-to-Many normalized mapping: an artist can belong to multiple languages)
CREATE TABLE IF NOT EXISTS artist_languages (
    artist_id VARCHAR(100) NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    language_id VARCHAR(50) NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (artist_id, language_id)
);

-- Artist Aliases & Multilingual Alternate Names
CREATE TABLE IF NOT EXISTS artist_aliases (
    id BIGSERIAL PRIMARY KEY,
    artist_id VARCHAR(100) NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    alias_name VARCHAR(255) NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    script_language VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (artist_id, normalized_alias)
);

-- Indexes for multilingual lookup and language filtering
CREATE INDEX IF NOT EXISTS idx_artist_languages_lang ON artist_languages(language_id);
CREATE INDEX IF NOT EXISTS idx_artist_languages_artist ON artist_languages(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_aliases_norm ON artist_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_artists_canonical_name ON artists(canonical_name);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR ALL SENSITIVE TABLES
-- =========================================================================

-- 1. Users Table RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON users
            FOR SELECT USING (auth.uid() = id OR id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON users
            FOR UPDATE USING (auth.uid() = id OR id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 2. Music Schedules RLS
ALTER TABLE music_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'music_schedules' AND policyname = 'Users can manage own schedules') THEN
        CREATE POLICY "Users can manage own schedules" ON music_schedules
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 3. Schedule History RLS
ALTER TABLE schedule_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_history' AND policyname = 'Users can manage own schedule history') THEN
        CREATE POLICY "Users can manage own schedule history" ON schedule_history
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 4. Play History RLS
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'play_history' AND policyname = 'Users can manage own play history') THEN
        CREATE POLICY "Users can manage own play history" ON play_history
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 5. User Settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can manage own settings') THEN
        CREATE POLICY "Users can manage own settings" ON user_settings
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 6. User Music Preferences RLS
ALTER TABLE user_music_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_music_preferences' AND policyname = 'Users can manage own preferences') THEN
        CREATE POLICY "Users can manage own preferences" ON user_music_preferences
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 7. Listening Events RLS
ALTER TABLE listening_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listening_events' AND policyname = 'Users can manage own listening events') THEN
        CREATE POLICY "Users can manage own listening events" ON listening_events
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 8. Recommendation Feedback RLS
ALTER TABLE recommendation_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recommendation_feedback' AND policyname = 'Users can manage own recommendation feedback') THEN
        CREATE POLICY "Users can manage own recommendation feedback" ON recommendation_feedback
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 9. Daily Mixes RLS
ALTER TABLE daily_mixes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_mixes' AND policyname = 'Users can manage own daily mixes') THEN
        CREATE POLICY "Users can manage own daily mixes" ON daily_mixes
            FOR ALL USING (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true));
    END IF;
END $$;

-- 10. Public Catalog Tables RLS (Public SELECT, Admin/Service Role Mutation)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Public read for songs') THEN
        CREATE POLICY "Public read for songs" ON songs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'artists' AND policyname = 'Public read for artists') THEN
        CREATE POLICY "Public read for artists" ON artists FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'artist_languages' AND policyname = 'Public read for artist languages') THEN
        CREATE POLICY "Public read for artist languages" ON artist_languages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'artist_aliases' AND policyname = 'Public read for artist aliases') THEN
        CREATE POLICY "Public read for artist aliases" ON artist_aliases FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'languages' AND policyname = 'Public read for languages') THEN
        CREATE POLICY "Public read for languages" ON languages FOR SELECT USING (true);
    END IF;
END $$;




