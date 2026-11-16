-- SyncWave Supabase History-Only Schema
-- Architecture Rule:
--   1. ONLY History (play_history, listening_events, schedule_history) is stored in Supabase.
--   2. All Downloads / Local audio files stay strictly on the local device (IndexedDB / File System / Android MediaStore / RN AsyncStorage).

CREATE TABLE IF NOT EXISTS public.play_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_listened_ms BIGINT NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    client_platform TEXT NOT NULL DEFAULT 'WEB'
);

CREATE INDEX IF NOT EXISTS idx_play_history_user_played
    ON public.play_history (user_id, played_at DESC);

CREATE TABLE IF NOT EXISTS public.listening_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    language TEXT,
    genre TEXT,
    event_type TEXT NOT NULL,
    duration_played_sec INT NOT NULL DEFAULT 0,
    total_duration_sec INT NOT NULL DEFAULT 0,
    client_platform TEXT NOT NULL DEFAULT 'WEB',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listening_events_user_time
    ON public.listening_events (user_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS public.schedule_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    schedule_id TEXT,
    schedule_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    status_message TEXT,
    client_platform TEXT NOT NULL DEFAULT 'WEB'
);

CREATE INDEX IF NOT EXISTS idx_schedule_history_user_time
    ON public.schedule_history (user_id, executed_at DESC);

-- ================================================================
-- 4. USER FAVORITES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL DEFAULT 'SONG',
    song_title TEXT,
    artist_name TEXT,
    artwork_url TEXT,
    duration_ms BIGINT DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, target_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_time
    ON public.favorites (user_id, added_at DESC);

-- Enable Row Level Security with permissive policies if using anon key via backend proxy,
-- or restrict to authenticated / service_role as needed in your Supabase project:
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'play_history' AND policyname = 'syncwave_play_history_all') THEN
        CREATE POLICY syncwave_play_history_all ON public.play_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listening_events' AND policyname = 'syncwave_listening_events_all') THEN
        CREATE POLICY syncwave_listening_events_all ON public.listening_events FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_history' AND policyname = 'syncwave_schedule_history_all') THEN
        CREATE POLICY syncwave_schedule_history_all ON public.schedule_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'syncwave_favorites_all') THEN
        CREATE POLICY syncwave_favorites_all ON public.favorites FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
