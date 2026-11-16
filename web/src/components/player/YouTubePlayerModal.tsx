import React, { useEffect, useRef } from 'react';
import { X, Play } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

interface YouTubePlayerModalProps {
  videoId: string | null;
  title: string;
  artist: string;
  onClose: () => void;
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  videoId,
  title,
  artist,
  onClose
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubeControlSignal = usePlayerStore((s) => s.youtubeControlSignal);

  useEffect(() => {
    if (!youtubeControlSignal || !iframeRef.current?.contentWindow) return;
    const { action, value } = youtubeControlSignal;
    let payload: { event: 'command'; func: string; args: unknown[] } | null = null;
    if (action === 'PAUSE') payload = { event: 'command', func: 'pauseVideo', args: [] };
    else if (action === 'PLAY') payload = { event: 'command', func: 'playVideo', args: [] };
    else if (action === 'SEEK' && typeof value === 'number') {
      payload = { event: 'command', func: 'seekTo', args: [value, true] };
    } else if (action === 'VOLUME' && typeof value === 'number') {
      payload = { event: 'command', func: 'setVolume', args: [Math.round(value * 100)] };
    }
    if (payload) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), '*');
    }
  }, [youtubeControlSignal]);

  if (!videoId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-surface border border-hairline rounded-panel max-w-2xl w-full overflow-hidden shadow-subtle relative">
        {/* Header */}
        <div className="p-3.5 px-5 flex items-center justify-between border-b border-hairline">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="w-7 h-7 rounded-control bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-text-primary truncate">{title}</h3>
              <p className="text-[11px] text-text-muted truncate">{artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
