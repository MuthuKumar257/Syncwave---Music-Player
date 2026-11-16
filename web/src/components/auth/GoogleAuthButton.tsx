import React, { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface GoogleAuthButtonProps {
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  label = 'Continue with Google',
  onSuccess,
  onError
}) => {
  const { providers, fetchProviders, startGoogleRedirectLogin, loginWithGoogleCredential } =
    useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const gsiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!providers) {
      fetchProviders();
    }
  }, [providers, fetchProviders]);

  // Load Google Identity Services when clientId is present without redirect client_secret
  useEffect(() => {
    const clientId = providers?.google?.clientId;
    if (!clientId || providers?.google?.redirectFlowEnabled) return;

    const existingScript = document.getElementById('google-gsi-script');
    const initGsi = () => {
      if (!window.google?.accounts?.id || !gsiContainerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setIsLoading(true);
          const result = await loginWithGoogleCredential(response.credential);
          setIsLoading(false);
          if (result.ok) {
            onSuccess?.();
          } else {
            onError?.(result.error || 'Google authentication failed.');
          }
        }
      });

      window.google.accounts.id.renderButton(gsiContainerRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: gsiContainerRef.current.offsetWidth || 340,
        text: 'continue_with'
      });
    };

    if (existingScript) {
      initGsi();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [providers, loginWithGoogleCredential, onSuccess, onError]);

  const handleClick = async () => {
    setIsLoading(true);
    const res = await startGoogleRedirectLogin();
    if (!res.ok) {
      setIsLoading(false);
      onError?.(res.error || 'Unable to start Google sign-in.');
    }
  };

  if (providers?.google?.idTokenEnabled && !providers?.google?.redirectFlowEnabled) {
    return (
      <div className="w-full space-y-2">
        <div ref={gsiContainerRef} className="w-full flex justify-center min-h-[42px]" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-sm font-medium text-text-primary transition-colors disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-accent" />
      ) : (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 5.04c1.94 0 3.51.68 4.6 1.72l3.44-3.44C17.95 1.38 15.23 0 12 0 7.31 0 3.25 2.69 1.27 6.6l3.99 3.1C6.21 6.84 8.87 5.04 12 5.04z"
          />
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.72-4.94 3.72-8.69z"
          />
          <path
            fill="#FBBC05"
            d="M5.26 14.3c-.24-.71-.38-1.48-.38-2.3s.14-1.59.38-2.3L1.27 6.6C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.4l3.99-3.1z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.13 0-5.79-1.8-6.74-4.46L1.27 18.02C3.25 21.31 7.31 24 12 24z"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
};
