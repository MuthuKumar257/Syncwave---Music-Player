-- ==============================================================================
-- SyncWave Complete User Data Deletion & Fresh Start SQL Script
-- ==============================================================================
-- PURPOSE:
--   Deletes all user accounts, personal playlists, favorites, listening history,
--   schedules, analytics, and preferences while STRICTLY PRESERVING:
--     1. Shared songs catalogue (public.songs)
--     2. Table definitions, schemas, indices, and constraints
--     3. Row Level Security (RLS) policies and permissions
--
-- SAFETY:
--   Wrapped in an explicit transaction (BEGIN ... COMMIT).
--   Deletions occur in reverse foreign-key dependency order to prevent FK violations.
-- ==============================================================================

BEGIN;

-- 1. Delete dependent playlist song relationships
DELETE FROM public.playlist_songs;

-- 2. Delete all user-created playlists
DELETE FROM public.playlists;

-- 3. Delete scheduler execution history records
DELETE FROM public.schedule_history;

-- 4. Delete all music schedule definitions
DELETE FROM public.music_schedules;

-- 5. Delete all user-marked favorite songs & artists
DELETE FROM public.favorites;

-- 6. Delete all song play history records
DELETE FROM public.play_history;

-- 7. Delete all recommendation learning events (plays, skips, replays)
DELETE FROM public.listening_events;

-- 8. Delete all explicit recommendation feedback (likes, hides)
DELETE FROM public.recommendation_feedback;

-- 9. Delete generated daily mixes
DELETE FROM public.daily_mixes;

-- 10. Delete user taste profile & preferences (languages, composers, singers)
DELETE FROM public.user_music_preferences;

-- 11. Delete user-specific playback settings
DELETE FROM public.user_settings;

-- 12. Delete registered user profiles in application schema
DELETE FROM public.users;

-- 13. Optional: If using Supabase Auth (auth.users), remove auth accounts safely
-- (Foreign key cascades to identities, sessions, mfa, etc.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        DELETE FROM auth.users WHERE email NOT LIKE '%system%internal%';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped auth.users cleanup: %', SQLERRM;
END $$;

-- ==============================================================================
-- VERIFICATION QUERIES (Preservation Check)
-- ==============================================================================
-- Verify shared song catalogue remains intact:
DO $$
DECLARE
    song_count INT;
BEGIN
    SELECT COUNT(*) INTO song_count FROM public.songs;
    RAISE NOTICE 'Preserved shared songs count in public.songs: %', song_count;
END $$;

COMMIT;

-- Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
