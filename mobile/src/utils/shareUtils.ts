import { Share, Platform, Linking } from 'react-native';

export const APP_NAME = 'SyncWave';
export const APP_DOMAIN = 'https://syncwave.app';
export const APP_SCHEME = 'syncwave';

/**
 * Generate a canonical permanent share URL for a given song ID
 */
export function getSongShareUrl(songId: string): string {
  if (!songId) return APP_DOMAIN;
  const cleanId = encodeURIComponent(songId.trim());
  return `${APP_DOMAIN}/song/${cleanId}`;
}

/**
 * Generate the standard SyncWave share message according to requirements:
 * "Listen to [Song Name] by [Artist Name] on SyncWave.
 *
 * Listen here: https://syncwave.app/song/SONG_ID"
 */
export function getSongShareMessage(songTitle: string, artistName: string, songId: string): string {
  const url = getSongShareUrl(songId);
  return `Listen to ${songTitle} by ${artistName} on ${APP_NAME}.\n\nListen here: ${url}`;
}

export interface ShareTrackPayload {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
}

/**
 * Trigger the native Android/iOS share sheet with title, message, and URL
 */
export async function shareSong(track: ShareTrackPayload): Promise<{ action: string; activityType?: string | null }> {
  const url = getSongShareUrl(track.id);
  const message = getSongShareMessage(track.title, track.artist, track.id);

  try {
    const result = await Share.share(
      Platform.select({
        ios: {
          title: track.title,
          message,
          url
        },
        default: {
          title: track.title,
          message
        }
      }),
      {
        dialogTitle: `Share "${track.title}" on SyncWave`
      }
    );
    return result as { action: string; activityType?: string | null };
  } catch (error) {
    console.warn('[shareUtils] shareSong failed:', error);
    throw error;
  }
}

/**
 * Directly open WhatsApp with the pre-filled share message where installed
 */
export async function shareSongViaWhatsApp(track: ShareTrackPayload): Promise<boolean> {
  const message = getSongShareMessage(track.title, track.artist, track.id);
  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `whatsapp://send?text=${encodedText}`;

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    }
  } catch (err) {
    console.warn('[shareUtils] WhatsApp direct share error:', err);
  }

  // Fallback to system share sheet
  await shareSong(track);
  return false;
}
