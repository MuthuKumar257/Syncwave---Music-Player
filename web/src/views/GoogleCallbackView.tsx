import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const GoogleCallbackView: React.FC = () => {
  const navigate = useNavigate();
  const { completeGoogleTokenSession } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(window.location.search);

    const token = hashParams.get('token');
    const authError = hashParams.get('error') || searchParams.get('error');

    // Immediately strip token from URL history so it never lingers in logs or browser UI.
    window.history.replaceState(null, '', window.location.pathname);

    if (authError) {
      setError(`Google sign-in failed (${authError.replace(/_/g, ' ')}).`);
      return;
    }

    if (!token) {
      setError('No authentication session token returned by Google OAuth.');
      return;
    }

    void completeGoogleTokenSession(token).then((ok) => {
      if (ok) {
        const target = sessionStorage.getItem('syncwave_redirect_target') || '/profile';
        sessionStorage.removeItem('syncwave_redirect_target');
        navigate(target, { replace: true });
      } else {
        setError('Could not validate Google session with SyncWave server.');
      }
    });
  }, [completeGoogleTokenSession, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-surface border border-hairline p-6 sm:p-8 text-center space-y-4">
        {error ? (
          <>
            <div className="mx-auto w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary">Google sign-in incomplete</h1>
            <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-9 px-4 rounded-control bg-accent text-black font-semibold text-xs hover:brightness-110 transition"
              >
                Back to Sign In
              </Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
            <h1 className="text-base font-medium text-text-primary">Completing Google sign-in...</h1>
            <p className="text-xs text-text-muted">Securing your SyncWave session</p>
          </>
        )}
      </div>
    </div>
  );
};
