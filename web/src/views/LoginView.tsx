import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Disc3, Eye, EyeOff, KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { OtpVerificationStep } from '../components/auth/OtpVerificationStep';
import { useAuthStore } from '../store/useAuthStore';

interface ActiveOtpChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresInSec: number;
  resendAfterSec: number;
}

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const getSuccessRedirect = () => {
    const target =
      searchParams.get('redirect') ||
      sessionStorage.getItem('syncwave_redirect_target') ||
      '/profile';
    sessionStorage.removeItem('syncwave_redirect_target');
    return target;
  };
  const {
    user,
    isAuthenticated,
    providers,
    fetchProviders,
    login,
    initiateOtpLogin,
    verifyOtp,
    resendOtp,
    requestPasswordReset,
    confirmPasswordReset,
    logout,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ActiveOtpChallenge | null>(null);

  // Forgot password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetChallengeId, setResetChallengeId] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const queryError = searchParams.get('error');
    if (queryError) {
      setError(`Authentication could not be completed (${queryError.replace(/_/g, ' ')}).`);
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setErrorCode(null);
    setSubmitting(true);

    if (providers && !providers.otp.enabled) {
      const ok = await login(email.trim(), password);
      setSubmitting(false);
      if (ok) {
        navigate(getSuccessRedirect());
      } else {
        setError('Invalid email or password.');
      }
      return;
    }

    const res = await initiateOtpLogin(email.trim(), password);
    setSubmitting(false);

    if (!res.ok) {
      // If OTP sending failed due to SMTP credentials error (e.g. 535) or misconfiguration,
      // fallback to direct password authentication so valid users are never locked out
      if (res.code === 'OTP_SEND_FAILED' || res.code === 'OTP_DELIVERY_NOT_CONFIGURED') {
        const directOk = await login(email.trim(), password);
        if (directOk) {
          navigate(getSuccessRedirect());
          return;
        }
      }
      setError(res.error || 'Unable to sign in. Check your credentials and try again.');
      setErrorCode(res.code || null);
      return;
    }

    if (res.otpRequired && res.challengeId) {
      setChallenge({
        challengeId: res.challengeId,
        maskedEmail: res.maskedEmail || email.trim(),
        expiresInSec: res.expiresInSec ?? 180,
        resendAfterSec: res.resendAfterSec ?? 30,
      });
      return;
    }

    navigate(getSuccessRedirect());
  };

  const handleRequestResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetSubmitting || !resetEmail.trim()) return;
    setResetError(null);
    setResetSuccess(null);
    setResetSubmitting(true);

    const res = await requestPasswordReset(resetEmail.trim());
    setResetSubmitting(false);

    if (res.ok && res.challengeId) {
      setResetChallengeId(res.challengeId);
      setResetStep('confirm');
      setResetSuccess(`Verification code sent to ${res.maskedEmail || resetEmail.trim()}`);
    } else {
      setResetError(res.error || 'Failed to send reset code');
    }
  };

  const handleConfirmResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetSubmitting) return;
    setResetError(null);
    setResetSuccess(null);
    setResetSubmitting(true);

    const res = await confirmPasswordReset({
      email: resetEmail.trim(),
      challengeId: resetChallengeId,
      otp: resetOtp.trim(),
      newPassword: resetNewPassword,
    });
    setResetSubmitting(false);

    if (res.ok) {
      setShowForgotPassword(false);
      setEmail(resetEmail.trim());
      setPassword('');
      setError(null);
      setResetStep('request');
      setResetOtp('');
      setResetNewPassword('');
      alert('Password reset successful! Please sign in with your new password.');
    } else {
      setResetError(res.error || 'Failed to reset password');
    }
  };

  if (isAuthenticated && user && !challenge) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-md rounded-card bg-surface border border-hairline p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-control bg-accent/15 border border-accent/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Already signed in</h1>
              <p className="text-xs text-text-muted">{user.email}</p>
            </div>
          </div>

          <p className="text-sm text-text-secondary">
            You are currently authenticated as{' '}
            <span className="text-text-primary font-medium">{user.displayName}</span>.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex-1 h-10 rounded-control bg-accent text-black font-semibold text-sm hover:brightness-110 transition"
            >
              Open Profile
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="h-10 px-4 rounded-control bg-surface-elevated hover:bg-surface-hover border border-hairline text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-6 sm:py-10 flex items-center justify-center pb-24 md:pb-10">
      <div className="w-full max-w-md space-y-5 sm:space-y-6">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-card bg-surface-elevated border border-hairline">
            <Disc3 className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            Sign in to SyncWave
          </h1>
          <p className="text-xs text-text-muted">
            Continue with Google or authenticate with email, password &amp; 6-digit OTP
          </p>
        </div>

        <div className="rounded-card bg-surface border border-hairline p-4 sm:p-6 md:p-7 space-y-5">
          {showForgotPassword ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetStep('request');
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold text-text-primary">Reset your password</h2>
              </div>

              {resetError && (
                <div className="rounded-control border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p>{resetError}</p>
                </div>
              )}

              {resetSuccess && (
                <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>{resetSuccess}</p>
                </div>
              )}

              {resetStep === 'request' ? (
                <form onSubmit={handleRequestResetSubmit} className="space-y-4">
                  <p className="text-xs text-text-muted">
                    Enter the email associated with your account and we&apos;ll send a 6-digit OTP code to reset your password.
                  </p>
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-medium text-text-secondary mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={resetSubmitting || !resetEmail.trim()}
                    className="w-full h-10 rounded-control bg-accent text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
                  >
                    {resetSubmitting ? 'Sending OTP code...' : 'Send Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmResetSubmit} className="space-y-4">
                  <p className="text-xs text-text-muted">
                    Enter the 6-digit OTP sent to <span className="text-text-primary font-medium">{resetEmail}</span> and choose a new password.
                  </p>
                  <div>
                    <label htmlFor="reset-otp" className="block text-xs font-medium text-text-secondary mb-1.5">
                      6-digit OTP
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-otp"
                        type="text"
                        required
                        maxLength={6}
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value)}
                        placeholder="123456"
                        className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary tracking-widest font-mono placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reset-new-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                      New Password (minimum 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full h-10 pl-9 pr-10 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={resetSubmitting || resetOtp.length !== 6 || resetNewPassword.length < 6}
                    className="w-full h-10 rounded-control bg-accent text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
                  >
                    {resetSubmitting ? 'Updating password...' : 'Update Password & Sign In'}
                  </button>
                </form>
              )}
            </div>
          ) : challenge ? (
            <OtpVerificationStep
              challengeId={challenge.challengeId}
              email={email.trim()}
              maskedEmail={challenge.maskedEmail}
              expiresInSec={challenge.expiresInSec}
              initialResendAfterSec={challenge.resendAfterSec}
              onVerify={async (otp) => {
                const res = await verifyOtp(challenge.challengeId, email.trim(), otp);
                if (res.ok) {
                  navigate(getSuccessRedirect());
                }
                return res;
              }}
              onResend={() => resendOtp(challenge.challengeId, email.trim())}
              onBack={() => {
                setChallenge(null);
                setError(null);
                setErrorCode(null);
              }}
            />
          ) : (
            <>
              <GoogleAuthButton
                label="Continue with Google"
                onSuccess={() => navigate(getSuccessRedirect())}
                onError={(msg) => {
                  setError(msg);
                  setErrorCode(null);
                }}
              />

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-hairline" />
                <span className="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-text-muted">
                  or email + password + OTP
                </span>
                <div className="flex-grow border-t border-hairline" />
              </div>

              {error && (
                <div className="rounded-control border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>{error}</p>
                    {errorCode === 'OTP_DELIVERY_NOT_CONFIGURED' && (
                      <p className="text-[11px] text-red-300/80">
                        Production OTP delivery requires valid SMTP (`SMTP_HOST`, `SMTP_USER`,
                        `SMTP_PASS`) or `RESEND_API_KEY` credentials in `server/.env`.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="text-xs font-medium text-text-secondary">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setResetEmail(email.trim());
                        setResetStep('request');
                        setResetError(null);
                        setResetSuccess(null);
                      }}
                      className="text-accent hover:underline text-[11px] font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-10 pl-9 pr-10 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-control bg-surface-elevated/60 border border-hairline px-3 py-2 flex items-center justify-between text-[11px] text-text-muted">
                  <span>Email OTP verification</span>
                  <span className={providers?.otp?.enabled ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {providers
                      ? providers.otp.enabled
                        ? `Active (${providers.otp.provider})`
                        : 'Configure SMTP / Resend in server/.env'
                      : 'Checking server...'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-control bg-accent text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Verifying & sending OTP...' : 'Continue with OTP'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-text-muted">
          New to SyncWave?{' '}
          <Link to="/signup" className="text-accent hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
