import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  alt?: string;
  className?: string;
  fallbackLabel?: string;
  iconClassName?: string;
}

/**
 * Renders track or artist artwork with an automatic offline/network fallback.
 */
export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackLabel,
  iconClassName = 'w-5 h-5 text-text-muted opacity-60'
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-elevated text-text-muted">
        {fallbackLabel ? (
          <span className="text-xs font-semibold text-accent">
            {fallbackLabel[0].toUpperCase()}
          </span>
        ) : (
          <Music className={iconClassName} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
