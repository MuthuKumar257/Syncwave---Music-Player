package com.syncwave.music.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.*

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("verifyWithOtp") val verifyWithOtp: Boolean = true
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("authProvider") val authProvider: String? = null,
    @SerializedName("emailVerified") val emailVerified: Boolean? = null
)

data class AuthResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String?,
    @SerializedName("user") val user: UserDto?,
    @SerializedName("message") val message: String? = null
)

data class GoogleAuthConfigDto(
    @SerializedName("idTokenEnabled") val idTokenEnabled: Boolean = false,
    @SerializedName("redirectFlowEnabled") val redirectFlowEnabled: Boolean = false,
    @SerializedName("clientId") val clientId: String? = null
)

data class OtpConfigDto(
    @SerializedName("enabled") val enabled: Boolean = false,
    @SerializedName("provider") val provider: String = "UNCONFIGURED"
)

data class AuthProvidersDto(
    @SerializedName("google") val google: GoogleAuthConfigDto = GoogleAuthConfigDto(),
    @SerializedName("otp") val otp: OtpConfigDto = OtpConfigDto()
)

data class AuthProvidersResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("google") val google: GoogleAuthConfigDto = GoogleAuthConfigDto(),
    @SerializedName("otp") val otp: OtpConfigDto = OtpConfigDto()
)

data class OtpInitiateResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("otpRequired") val otpRequired: Boolean = false,
    @SerializedName("challengeId") val challengeId: String? = null,
    @SerializedName("maskedEmail") val maskedEmail: String? = null,
    @SerializedName("expiresInSec") val expiresInSec: Int? = null,
    @SerializedName("resendAfterSec") val resendAfterSec: Int? = null,
    @SerializedName("token") val token: String? = null,
    @SerializedName("user") val user: UserDto? = null,
    @SerializedName("code") val code: String? = null,
    @SerializedName("message") val message: String? = null
)

data class OtpVerifyRequest(
    @SerializedName("challengeId") val challengeId: String,
    @SerializedName("email") val email: String,
    @SerializedName("otp") val otp: String
)

data class OtpResendRequest(
    @SerializedName("challengeId") val challengeId: String,
    @SerializedName("email") val email: String
)

data class OtpResendResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("resendAfterSec") val resendAfterSec: Int? = null,
    @SerializedName("retryAfterSec") val retryAfterSec: Int? = null,
    @SerializedName("message") val message: String? = null
)

data class GoogleIdTokenRequest(
    @SerializedName("credential") val credential: String
)

data class GoogleOAuthStartResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("authUrl") val authUrl: String? = null,
    @SerializedName("code") val code: String? = null,
    @SerializedName("message") val message: String? = null
)

data class SessionTrackDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String = "Unknown Artist",
    @SerializedName("album") val album: String? = null,
    @SerializedName("durationMs") val durationMs: Long? = null,
    @SerializedName("artworkUrl") val artworkUrl: String? = null,
    @SerializedName("videoId") val videoId: String? = null,
    @SerializedName("externalUrl") val externalUrl: String? = null,
    @SerializedName("source") val source: String? = null
)

data class SessionDeviceDto(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("platform") val platform: String,
    @SerializedName("lastSeenAt") val lastSeenAt: Long = 0L,
    @SerializedName("isOnline") val isOnline: Boolean = true,
    @SerializedName("isActive") val isActive: Boolean = false
)

data class SessionPlaybackDto(
    @SerializedName("track") val track: SessionTrackDto? = null,
    @SerializedName("isPlaying") val isPlaying: Boolean = false,
    @SerializedName("positionSec") val positionSec: Double = 0.0,
    @SerializedName("durationSec") val durationSec: Double = 0.0,
    @SerializedName("queue") val queue: List<SessionTrackDto> = emptyList(),
    @SerializedName("queueIndex") val queueIndex: Int = -1,
    @SerializedName("volume") val volume: Float = 0.85f,
    @SerializedName("isMuted") val isMuted: Boolean = false,
    @SerializedName("isShuffle") val isShuffle: Boolean = false,
    @SerializedName("repeatMode") val repeatMode: String = "OFF"
)

data class PendingCommandDto(
    @SerializedName("id") val id: String,
    @SerializedName("seq") val seq: Int,
    @SerializedName("type") val type: String,
    @SerializedName("payload") val payload: com.google.gson.JsonObject? = null,
    @SerializedName("targetDeviceId") val targetDeviceId: String,
    @SerializedName("issuedByDeviceId") val issuedByDeviceId: String
)

data class PlaybackSessionSnapshotDto(
    @SerializedName("userId") val userId: String,
    @SerializedName("activeDeviceId") val activeDeviceId: String? = null,
    @SerializedName("revision") val revision: Int = 0,
    @SerializedName("devices") val devices: List<SessionDeviceDto> = emptyList(),
    @SerializedName("playback") val playback: SessionPlaybackDto = SessionPlaybackDto(),
    @SerializedName("commands") val commands: List<PendingCommandDto> = emptyList()
)

data class PlaybackSessionResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("session") val session: PlaybackSessionSnapshotDto? = null,
    @SerializedName("code") val code: String? = null,
    @SerializedName("activeDeviceId") val activeDeviceId: String? = null,
    @SerializedName("message") val message: String? = null
)

data class RegisterDeviceRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("platform") val platform: String = "ANDROID"
)

data class HeartbeatDeviceRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("ackSeq") val ackSeq: Int? = null
)

data class UnregisterDeviceRequest(
    @SerializedName("deviceId") val deviceId: String
)

data class TransferDeviceRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("targetDeviceId") val targetDeviceId: String
)

data class RemoteCommandRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("type") val type: String,
    @SerializedName("payload") val payload: Map<String, @JvmSuppressWildcards Any>? = null
)

data class PublishPlaybackStateRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("track") val track: SessionTrackDto? = null,
    @SerializedName("isPlaying") val isPlaying: Boolean? = null,
    @SerializedName("positionSec") val positionSec: Double? = null,
    @SerializedName("durationSec") val durationSec: Double? = null,
    @SerializedName("queue") val queue: List<SessionTrackDto>? = null,
    @SerializedName("queueIndex") val queueIndex: Int? = null,
    @SerializedName("volume") val volume: Float? = null,
    @SerializedName("isMuted") val isMuted: Boolean? = null,
    @SerializedName("isShuffle") val isShuffle: Boolean? = null,
    @SerializedName("repeatMode") val repeatMode: String? = null
)

data class ResolveAudioResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("audioUrl") val audioUrl: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("artist") val artist: String? = null,
    @SerializedName("artworkUrl") val artworkUrl: String? = null,
    @SerializedName("durationMs") val durationMs: Long? = null,
    @SerializedName("isPreview") val isPreview: Boolean? = null,
    @SerializedName("downloadAllowed") val downloadAllowed: Boolean? = null,
    @SerializedName("downloadReason") val downloadReason: String? = null
)

data class DownloadCheckResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("downloadable") val downloadable: Boolean,
    @SerializedName("availability") val availability: String? = null, // "FULL" | "PREVIEW_ONLY" | "STREAM_ONLY" | "UNAVAILABLE"
    @SerializedName("audioUrl") val audioUrl: String? = null,
    @SerializedName("expectedDurationMs") val expectedDurationMs: Long? = null,
    @SerializedName("fileFormat") val fileFormat: String? = null,
    @SerializedName("mimeType") val mimeType: String? = null,
    @SerializedName("contentLength") val contentLength: Long? = null,
    @SerializedName("supportsRange") val supportsRange: Boolean? = null,
    @SerializedName("reason") val reason: String? = null
)

data class CloudPlaylistDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("artworkUrl") val artworkUrl: String?,
    @SerializedName("songCount") val songCount: Int,
    @SerializedName("songIds") val songIds: List<String>
)

data class CloudScheduleDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("startTime") val startTime: String,
    @SerializedName("daysOfWeek") val daysOfWeek: List<Int>,
    @SerializedName("targetType") val targetType: String,
    @SerializedName("targetId") val targetId: String,
    @SerializedName("targetName") val targetName: String,
    @SerializedName("priority") val priority: String,
    @SerializedName("isEnabled") val isEnabled: Boolean,
    @SerializedName("transitionType") val transitionType: String,
    @SerializedName("transitionSec") val transitionSec: Int,
    @SerializedName("volume") val volume: Float
)

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?
)

data class UserPreferencesResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("preferences") val preferences: UserPreferencesDto? = null,
    @SerializedName("data") val data: UserPreferencesDto? = null
) {
    fun resolvePreferences(): UserPreferencesDto? = preferences ?: data
}

data class OnlineTrackDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String,
    @SerializedName("album") val album: String,
    @SerializedName("durationMs") val durationMs: Long,
    @SerializedName("artworkUrl") val artworkUrl: String?,
    @SerializedName("source") val source: String,
    @SerializedName("externalUrl") val externalUrl: String?,
    @SerializedName("embedUrl") val embedUrl: String?,
    @SerializedName("previewUrl") val previewUrl: String?,
    @SerializedName("uri") val uri: String?,
    @SerializedName("videoId") val videoId: String?
)

data class SearchResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("query") val query: String,
    @SerializedName("onlineMatches") val onlineMatches: List<OnlineTrackDto>
)

data class UnifiedTrackDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String,
    @SerializedName("movieName") val movieName: String?,
    @SerializedName("album") val album: String?,
    @SerializedName("composer") val composer: String?,
    @SerializedName("singers") val singers: List<String>?,
    @SerializedName("durationMs") val durationMs: Long,
    @SerializedName("artworkUrl") val artworkUrl: String?,
    @SerializedName("sourcePlatform") val sourcePlatform: String,
    @SerializedName("sourceUrl") val sourceUrl: String,
    @SerializedName("embedUrl") val embedUrl: String?,
    @SerializedName("videoId") val videoId: String? = null,
    @SerializedName("previewUrl") val previewUrl: String?,
    @SerializedName("fullAudioUrl") val fullAudioUrl: String? = null,
    @SerializedName("downloadAvailability") val downloadAvailability: String? = null,
    @SerializedName("downloadReason") val downloadReason: String? = null,
    @SerializedName("fileFormat") val fileFormat: String? = null,
    @SerializedName("versionType") val versionType: String,
    @SerializedName("isPlayableDirectly") val isPlayableDirectly: Boolean,
    @SerializedName("releaseYear") val releaseYear: Int?,
    @SerializedName("language") val language: String?
)

data class MovieSoundtrackDto(
    @SerializedName("id") val id: String,
    @SerializedName("movieName") val movieName: String,
    @SerializedName("releaseYear") val releaseYear: Int?,
    @SerializedName("composer") val composer: String,
    @SerializedName("language") val language: String,
    @SerializedName("artworkUrl") val artworkUrl: String?,
    @SerializedName("totalTracks") val totalTracks: Int,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class SearchSuggestionDto(
    @SerializedName("text") val text: String,
    @SerializedName("type") val type: String,
    @SerializedName("subtitle") val subtitle: String
)

data class SuggestionsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("suggestions") val suggestions: List<SearchSuggestionDto>
)

data class UniversalSearchResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("query") val query: String,
    @SerializedName("intent") val intent: String,
    @SerializedName("language") val language: String,
    @SerializedName("movies") val movies: List<MovieSoundtrackDto>,
    @SerializedName("songs") val songs: List<UnifiedTrackDto>,
    @SerializedName("totalResults") val totalResults: Int
)

data class ExecutionLogRequest(
    @SerializedName("success") val success: Boolean,
    @SerializedName("statusMessage") val statusMessage: String,
    @SerializedName("clientPlatform") val clientPlatform: String = "ANDROID",
    @SerializedName("scheduleName") val scheduleName: String? = null,
    @SerializedName("targetName") val targetName: String? = null
)

data class ScheduleHistoryDto(
    @SerializedName("id") val id: Long,
    @SerializedName("scheduleId") val scheduleId: String?,
    @SerializedName("scheduleName") val scheduleName: String,
    @SerializedName("targetName") val targetName: String,
    @SerializedName("executedAt") val executedAt: String,
    @SerializedName("success") val success: Boolean,
    @SerializedName("statusMessage") val statusMessage: String
)

// --- AI Recommendation & Personalization DTOs ---
data class ArtistItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String, // "DIRECTOR" | "SINGER"
    @SerializedName("languages") val languages: List<String> = emptyList(),
    @SerializedName("imageUrl") val imageUrl: String = "",
    @SerializedName("knownFor") val knownFor: List<String> = emptyList(),
    @SerializedName("popularTracks") val popularTracks: List<String> = emptyList()
)

data class ArtistsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("count") val count: Int,
    @SerializedName("artists") val artists: List<ArtistItemDto>
)

data class AutoQueueRequest(
    @SerializedName("songId") val songId: String,
    @SerializedName("songTitle") val songTitle: String? = null,
    @SerializedName("artist") val artist: String? = null,
    @SerializedName("director") val director: String? = null,
    @SerializedName("language") val language: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("mood") val mood: String? = null,
    @SerializedName("excludeIds") val excludeIds: List<String> = emptyList(),
    @SerializedName("limit") val limit: Int = 12
)

data class AutoQueueResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("count") val count: Int? = 0,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto> = emptyList()
)

data class SongListeningStatRequest(
    @SerializedName("songId") val songId: String,
    @SerializedName("songName") val songName: String,
    @SerializedName("movieOrAlbum") val movieOrAlbum: String? = null,
    @SerializedName("musicDirector") val musicDirector: String? = null,
    @SerializedName("singers") val singers: List<String>? = null,
    @SerializedName("language") val language: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("playCount") val playCount: Int = 1,
    @SerializedName("replayCount") val replayCount: Int = 0,
    @SerializedName("skipCount") val skipCount: Int = 0
)

data class DirectorGroupDto(
    @SerializedName("director") val director: String,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class SingerGroupDto(
    @SerializedName("singer") val singer: String,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class UserPreferencesDto(
    @SerializedName("userId") val userId: String = "",
    @SerializedName("preferredLanguages") val preferredLanguages: List<String> = emptyList(),
    @SerializedName("favouriteArtists") val favouriteArtists: List<String> = emptyList(),
    @SerializedName("favouriteGenres") val favouriteGenres: List<String> = emptyList(),
    @SerializedName("favouriteComposers") val favouriteComposers: List<String> = emptyList(),
    @SerializedName("favouriteSingers") val favouriteSingers: List<String> = emptyList(),
    @SerializedName("favouriteMovies") val favouriteMovies: List<String> = emptyList(),
    @SerializedName("personalizationEnabled") val personalizationEnabled: Boolean = true,
    @SerializedName("historyEnabled") val historyEnabled: Boolean = true
)

data class DailyMixDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("subtitle") val subtitle: String,
    @SerializedName("language") val language: String,
    @SerializedName("coverUrl") val coverUrl: String,
    @SerializedName("trackCount") val trackCount: Int,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class LanguageSectionDto(
    @SerializedName("language") val language: String,
    @SerializedName("recommended") val recommended: List<UnifiedTrackDto>,
    @SerializedName("trending") val trending: List<UnifiedTrackDto>,
    @SerializedName("soundtracks") val soundtracks: List<MovieSoundtrackDto>
)

data class BecauseYouListenedDto(
    @SerializedName("basedOn") val basedOn: String,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class TimeBasedPicksDto(
    @SerializedName("contextName") val contextName: String,
    @SerializedName("description") val description: String,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class ArtistAlbumGroupDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("releaseYear") val releaseYear: Int? = null,
    @SerializedName("language") val language: String? = null,
    @SerializedName("artworkUrl") val artworkUrl: String? = null,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto> = emptyList()
)

data class ArtistRecommendationCardDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("role") val role: String = "SINGER",
    @SerializedName("roleTitle") val roleTitle: String? = null,
    @SerializedName("languages") val languages: List<String> = emptyList(),
    @SerializedName("imageUrl") val imageUrl: String? = null,
    @SerializedName("isFavourite") val isFavourite: Boolean = false,
    @SerializedName("isDiscovery") val isDiscovery: Boolean = false,
    @SerializedName("reason") val reason: String? = null,
    @SerializedName("knownFor") val knownFor: List<String> = emptyList(),
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("albums") val albums: List<ArtistAlbumGroupDto> = emptyList()
)

data class MoodPlaylistCardDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("mood") val mood: String = "",
    @SerializedName("title") val title: String = "",
    @SerializedName("description") val description: String = "",
    @SerializedName("artworkUrl") val artworkUrl: String = "",
    @SerializedName("accentColor") val accentColor: String = "#F59E0B",
    @SerializedName("trackCount") val trackCount: Int = 0,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto> = emptyList()
)

data class PersonalizedFeedDto(
    @SerializedName("greeting") val greeting: String = "Hello",
    @SerializedName("timeOfDay") val timeOfDay: String = "MORNING",
    @SerializedName("contextTitle") val contextTitle: String = "",
    @SerializedName("contextDescription") val contextDescription: String = "",
    @SerializedName("preferredLanguages") val preferredLanguages: List<String> = emptyList(),
    @SerializedName("generatedAt") val generatedAt: String? = null,
    @SerializedName("recentlyPlayed") val recentlyPlayed: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("continueListening") val continueListening: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("recommendedForYou") val recommendedForYou: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("basedOnListeningHistory") val basedOnListeningHistory: BecauseYouListenedDto? = null,
    @SerializedName("favouriteArtists") val favouriteArtists: List<ArtistRecommendationCardDto> = emptyList(),
    @SerializedName("recommendedSingers") val recommendedSingers: List<ArtistRecommendationCardDto> = emptyList(),
    @SerializedName("recommendedMusicDirectors") val recommendedMusicDirectors: List<ArtistRecommendationCardDto> = emptyList(),
    @SerializedName("moodPlaylists") val moodPlaylists: List<MoodPlaylistCardDto> = emptyList(),
    @SerializedName("similarSongs") val similarSongs: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("popularSongs") val popularSongs: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("favouriteMusicDirectors") val favouriteMusicDirectors: List<DirectorGroupDto> = emptyList(),
    @SerializedName("favouriteSingers") val favouriteSingers: List<SingerGroupDto> = emptyList(),
    @SerializedName("trendingInLanguages") val trendingInLanguages: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("newReleases") val newReleases: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("discoverNewMusic") val discoverNewMusic: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("movieSoundtracks") val movieSoundtracks: List<MovieSoundtrackDto> = emptyList(),
    @SerializedName("madeForYou") val madeForYou: List<UnifiedTrackDto> = emptyList(),
    @SerializedName("languageSections") val languageSections: List<LanguageSectionDto> = emptyList(),
    @SerializedName("becauseYouListenedTo") val becauseYouListenedTo: BecauseYouListenedDto? = null,
    @SerializedName("dailyMixes") val dailyMixes: List<DailyMixDto> = emptyList(),
    @SerializedName("timeBasedPicks") val timeBasedPicks: TimeBasedPicksDto? = null,
    @SerializedName("discoverNew") val discoverNew: List<UnifiedTrackDto> = emptyList()
)

data class SmartPlaylistRequest(
    @SerializedName("language") val language: String? = null,
    @SerializedName("genreOrMood") val genreOrMood: String? = null,
    @SerializedName("targetDurationMinutes") val targetDurationMinutes: Int? = 45
)

data class SmartPlaylistResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("playlist") val playlist: SmartPlaylistDto?
)

data class SmartPlaylistDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String,
    @SerializedName("artworkUrl") val artworkUrl: String,
    @SerializedName("language") val language: String?,
    @SerializedName("genreOrMood") val genreOrMood: String?,
    @SerializedName("totalTracks") val totalTracks: Int,
    @SerializedName("totalDurationMs") val totalDurationMs: Long,
    @SerializedName("tracks") val tracks: List<UnifiedTrackDto>
)

data class FeedbackRequest(
    @SerializedName("targetId") val targetId: String,
    @SerializedName("targetType") val targetType: String = "SONG",
    @SerializedName("feedbackType") val feedbackType: String
)

data class PlayHistoryRequest(
    @SerializedName("songId") val songId: String,
    @SerializedName("songTitle") val songTitle: String,
    @SerializedName("artistName") val artistName: String,
    @SerializedName("durationListenedMs") val durationListenedMs: Long = 0L,
    @SerializedName("completed") val completed: Boolean = false,
    @SerializedName("clientPlatform") val clientPlatform: String = "ANDROID"
)

data class PlayHistoryDto(
    @SerializedName("id") val id: Long,
    @SerializedName("songId") val songId: String,
    @SerializedName("songTitle") val songTitle: String,
    @SerializedName("artistName") val artistName: String,
    @SerializedName("playedAt") val playedAt: String,
    @SerializedName("durationListenedMs") val durationListenedMs: Long,
    @SerializedName("completed") val completed: Boolean
)

data class FavouriteArtistBadgeDto(
    @SerializedName("name") val name: String,
    @SerializedName("roleTitle") val roleTitle: String,
    @SerializedName("imageUrl") val imageUrl: String?
)

data class ProfileArtistStatDto(
    @SerializedName("name") val name: String,
    @SerializedName("roleTitle") val roleTitle: String?,
    @SerializedName("imageUrl") val imageUrl: String?,
    @SerializedName("playCount") val playCount: Int,
    @SerializedName("replayCount") val replayCount: Int,
    @SerializedName("totalDurationMs") val totalDurationMs: Long,
    @SerializedName("uniqueSongsCount") val uniqueSongsCount: Int
)

data class ProfileSongRewatchStatDto(
    @SerializedName("songId") val songId: String,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String,
    @SerializedName("artworkUrl") val artworkUrl: String,
    @SerializedName("videoId") val videoId: String?,
    @SerializedName("playCount") val playCount: Int,
    @SerializedName("rewatchCount") val rewatchCount: Int,
    @SerializedName("lastPlayedAt") val lastPlayedAt: String
)

data class ProfileStatsSummaryDto(
    @SerializedName("totalPlays") val totalPlays: Int,
    @SerializedName("totalRewatches") val totalRewatches: Int,
    @SerializedName("totalListeningMinutes") val totalListeningMinutes: Int,
    @SerializedName("uniqueSongsPlayed") val uniqueSongsPlayed: Int,
    @SerializedName("uniqueArtistsListened") val uniqueArtistsListened: Int,
    @SerializedName("historySource") val historySource: String
)

data class ProfileStatsDto(
    @SerializedName("favouriteArtist") val favouriteArtist: FavouriteArtistBadgeDto?,
    @SerializedName("favouriteArtists") val favouriteArtists: List<FavouriteArtistBadgeDto>,
    @SerializedName("mostListenedArtist") val mostListenedArtist: ProfileArtistStatDto?,
    @SerializedName("topListenedArtists") val topListenedArtists: List<ProfileArtistStatDto>,
    @SerializedName("mostRewatchedSongs") val mostRewatchedSongs: List<ProfileSongRewatchStatDto>,
    @SerializedName("summary") val summary: ProfileStatsSummaryDto
)

data class ProfileStatsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("stats") val stats: ProfileStatsDto?
)

interface SyncWaveApiService {

    @POST("api/auth/login")
    suspend fun login(@Body req: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body req: RegisterRequest): Response<AuthResponse>

    @GET("api/auth/providers")
    suspend fun getAuthProviders(): Response<AuthProvidersResponse>

    @POST("api/auth/login/initiate")
    suspend fun initiateOtpLogin(@Body req: LoginRequest): Response<OtpInitiateResponse>

    @POST("api/auth/otp/verify")
    suspend fun verifyOtp(@Body req: OtpVerifyRequest): Response<AuthResponse>

    @POST("api/auth/otp/resend")
    suspend fun resendOtp(@Body req: OtpResendRequest): Response<OtpResendResponse>

    @POST("api/auth/register")
    suspend fun registerAccount(@Body req: RegisterRequest): Response<OtpInitiateResponse>

    @POST("api/auth/google")
    suspend fun loginWithGoogle(@Body req: GoogleIdTokenRequest): Response<AuthResponse>

    @GET("api/auth/google/start")
    suspend fun startGoogleOAuth(): Response<GoogleOAuthStartResponse>

    @POST("api/auth/refresh")
    suspend fun refreshSession(): Response<AuthResponse>

    @POST("api/playback-session/devices/register")
    suspend fun registerPlaybackDevice(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: RegisterDeviceRequest
    ): Response<PlaybackSessionResponse>

    @POST("api/playback-session/devices/heartbeat")
    suspend fun playbackDeviceHeartbeat(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: HeartbeatDeviceRequest
    ): Response<PlaybackSessionResponse>

    @POST("api/playback-session/devices/unregister")
    suspend fun unregisterPlaybackDevice(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: UnregisterDeviceRequest
    ): Response<PlaybackSessionResponse>

    @GET("api/playback-session/poll")
    suspend fun pollPlaybackSession(
        @retrofit2.http.Header("Authorization") bearer: String,
        @retrofit2.http.Query("deviceId") deviceId: String,
        @retrofit2.http.Query("sinceRevision") sinceRevision: Int,
        @retrofit2.http.Query("timeoutMs") timeoutMs: Int = 15000,
        @retrofit2.http.Query("ackSeq") ackSeq: Int = 0
    ): Response<PlaybackSessionResponse>

    @POST("api/playback-session/transfer")
    suspend fun transferPlaybackDevice(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: TransferDeviceRequest
    ): Response<PlaybackSessionResponse>

    @POST("api/playback-session/state")
    suspend fun publishPlaybackState(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: PublishPlaybackStateRequest
    ): Response<PlaybackSessionResponse>

    @POST("api/playback-session/command")
    suspend fun sendRemotePlaybackCommand(
        @retrofit2.http.Header("Authorization") bearer: String,
        @Body req: RemoteCommandRequest
    ): Response<PlaybackSessionResponse>

    @GET("api/search/resolve-audio")
    suspend fun resolveAudioStream(
        @retrofit2.http.Query("title") title: String,
        @retrofit2.http.Query("artist") artist: String
    ): Response<ResolveAudioResponse>

    @GET("api/search/download-check")
    suspend fun checkFullDownload(
        @retrofit2.http.Query("url") url: String? = null,
        @retrofit2.http.Query("title") title: String? = null,
        @retrofit2.http.Query("artist") artist: String? = null,
        @retrofit2.http.Query("sourcePlatform") sourcePlatform: String? = null,
        @retrofit2.http.Query("expectedDurationMs") expectedDurationMs: Long? = null
    ): Response<DownloadCheckResponse>

    @GET("api/playlists")
    suspend fun getPlaylists(@Header("Authorization") token: String): Response<ApiResponse<List<CloudPlaylistDto>>>

    @POST("api/playlists")
    suspend fun createPlaylist(
        @Header("Authorization") token: String,
        @Body playlist: CloudPlaylistDto
    ): Response<ApiResponse<CloudPlaylistDto>>

    @GET("api/schedules")
    suspend fun getSchedules(@Header("Authorization") token: String): Response<ApiResponse<List<CloudScheduleDto>>>

    @POST("api/schedules")
    suspend fun createSchedule(
        @Header("Authorization") token: String,
        @Body schedule: CloudScheduleDto
    ): Response<ApiResponse<CloudScheduleDto>>

    @POST("api/schedules/{id}/execution")
    suspend fun logExecution(
        @Header("Authorization") token: String,
        @Path("id") scheduleId: String,
        @Body log: ExecutionLogRequest
    ): Response<ApiResponse<Any>>

    @POST("api/schedules/{id}/execution")
    suspend fun logExecutionPublic(
        @Path("id") scheduleId: String,
        @Body log: ExecutionLogRequest
    ): Response<ApiResponse<Any>>

    @GET("api/schedules/history/all")
    suspend fun getScheduleHistory(): Response<ApiResponse<List<ScheduleHistoryDto>>>

    @GET("api/music/search")
    suspend fun searchOnlineMusic(
        @Query("q") query: String,
        @Query("platform") platform: String = "ALL"
    ): Response<SearchResponse>

    @GET("api/search")
    suspend fun searchUniversal(
        @Query("q") query: String,
        @Query("type") type: String? = null,
        @Query("platform") platform: String? = null,
        @Query("language") language: String? = null,
        @Query("limit") limit: Int = 15
    ): Response<UniversalSearchResponse>

    @GET("api/search/suggestions")
    suspend fun getSearchSuggestions(
        @Query("q") query: String
    ): Response<SuggestionsResponse>

    @GET("api/recommendations")
    suspend fun getRecommendations(
        @Query("language") language: String? = null,
        @Query("timeOfDay") timeOfDay: String? = null,
        @Query("seed") seed: String? = null
    ): Response<ApiResponse<PersonalizedFeedDto>>

    @GET("api/recommendations/artists")
    suspend fun getArtists(
        @Query("role") role: String? = null,
        @Query("languages") languages: String? = null,
        @Query("q") query: String? = null
    ): Response<ArtistsResponse>

    @POST("api/recommendations/listening-stat")
    suspend fun recordListeningStat(@Body req: SongListeningStatRequest): Response<ApiResponse<Any>>

    @GET("api/users/me/preferences")
    suspend fun getUserPreferences(): Response<UserPreferencesResponse>

    @PUT("api/users/me/preferences")
    suspend fun updateUserPreferences(@Body req: UserPreferencesDto): Response<UserPreferencesResponse>

    @POST("api/recommendations/auto-queue")
    suspend fun getAutoQueue(@Body req: AutoQueueRequest): Response<AutoQueueResponse>

    @POST("api/recommendations/feedback")
    suspend fun sendFeedback(@Body req: FeedbackRequest): Response<ApiResponse<Any>>

    @POST("api/recommendations/generate-smart-playlist")
    suspend fun generateSmartPlaylist(@Body req: SmartPlaylistRequest): Response<SmartPlaylistResponse>

    @GET("api/history")
    suspend fun getPlayHistory(@Query("limit") limit: Int = 20): Response<ApiResponse<List<PlayHistoryDto>>>

    @POST("api/history")
    suspend fun recordPlayHistory(@Body req: PlayHistoryRequest): Response<ApiResponse<Any>>

    @DELETE("api/history")
    suspend fun clearHistory(): Response<ApiResponse<Any>>

    @GET("api/recommendations/profile-stats")
    suspend fun getProfileStats(): Response<ProfileStatsResponse>
}

