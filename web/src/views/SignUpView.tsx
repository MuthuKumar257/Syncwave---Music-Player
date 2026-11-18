import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Disc3, Eye, EyeOff, Lock, Mail, ShieldAlert, User } from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { OtpVerificationStep } from '../components/auth/OtpVerificationStep';
import { useAuthStore } from '../store/useAuthStore';

interface ActiveOtpChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresInSec: number;
  resendAfterSec: number;
}

export const SignUpView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const getSuccessRedirect = () => {
    const target =
      searchParams.get('redirect') ||
      sessionStorage.getItem('syncwave_redirect_target') ||
      '/profile';
    sessionStorage.removeItem('syncwave_redirect_target');
    return target;
  };
  const { providers, fetchProviders, registerAccount, verifyOtp, resendOtp } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyWithOtp, setVerifyWithOtp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ActiveOtpChallenge | null>(null);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (providers && !providers.otp.enabled) {
      setVerifyWithOtp(false);
    } else if (providers?.otp?.enabled) {
      setVerifyWithOtp(true);
    }
  }, [providers]);

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasLower: /[a-z]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasNumberOrSymbol: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };
  }, [password]);

  const strengthScore = Object.values(passwordChecks).filter(Boolean).length;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setErrorCode(null);

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    let res = await registerAccount(email.trim(), password, displayName.trim(), verifyWithOtp);

    // If OTP sending failed due to host/cloud SMTP block, seamlessly fallback to direct account creation
    if (!res.ok && (res.code === 'OTP_SEND_FAILED' || res.code === 'OTP_DELIVERY_NOT_CONFIGURED') && verifyWithOtp) {
      setVerifyWithOtp(false);
      res = await registerAccount(email.trim(), password, displayName.trim(), false);
    }
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not create your account.');
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

  return (
    <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-6 sm:py-10 flex items-center justify-center pb-24 md:pb-10">
      <div className="w-full max-w-md space-y-5 sm:space-y-6">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-card bg-surface-elevated border border-hairline">
            <Disc3 className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            Create your SyncWave account
          </h1>
          <p className="text-xs text-text-muted">
            Synchronize smart schedules, playlists &amp; listening stats across devices
          </p>
        </div>

        <div className="rounded-card bg-surface border border-hairline p-4 sm:p-6 md:p-7 space-y-5">
          {challenge ? (
            <OtpVerificationStep
              challengeId={challenge.challengeId}
              email={email.trim()}
              maskedEmail={challenge.maskedEmail}
              expiresInSec={challenge.expiresInSec}
              initialResendAfterSec={challenge.resendAfterSec}
              title="Verify your email address"
              submitLabel="Verify email & finish sign up"
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
                label="Sign up with Google"
                onSuccess={() => navigate(getSuccessRedirect())}
                onError={(msg) => {
                  setError(msg);
                  setErrorCode(null);
                }}
              />

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-hairline" />
                <span className="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-text-muted">
                  or register with email
                </span>
                <div className="flex-grow border-t border-hairline" />
              </div>

              {error && (
                <div className="rounded-control border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p>{error}</p>
                    {(errorCode === 'OTP_DELIVERY_NOT_CONFIGURED' || errorCode === 'OTP_SEND_FAILED') && (
                      <div className="space-y-1.5 pt-1 border-t border-red-500/20">
                        <p className="text-[11px] text-red-300/90 leading-relaxed">
                          {errorCode === 'OTP_SEND_FAILED'
                            ? 'Email verification failed because the SMTP credentials were not accepted by Google (535 Bad Credentials). Click the button below to register directly without OTP verification.'
                            : 'Configure SMTP or Resend in `server/.env`, or click below to create an account directly.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyWithOtp(false);
                            setError(null);
                            setErrorCode(null);
                          }}
                          className="px-2.5 py-1 rounded bg-accent text-black text-xs font-semibold hover:brightness-110 transition"
                        >
                          Sign Up Directly Without OTP
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="signup-name" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Display name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-10 pl-9 pr-3 rounded-control bg-surface-elevated border border-hairline text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-email"
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
                  <label htmlFor="signup-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
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

                  {password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 rounded-full transition-colors ${
                              strengthScore >= level
                                ? strengthScore <= 2
                                  ? 'bg-red-400'
                                  : strengthScore === 3
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                                : 'bg-surface-hover'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
                        <span className={passwordChecks.minLength ? 'text-emerald-400' : ''}>
                          8+ chars
                        </span>
                        <span className={passwordChecks.hasUpper ? 'text-emerald-400' : ''}>
                          Uppercase
                        </span>
                        <span className={passwordChecks.hasLower ? 'text-emerald-400' : ''}>
                          Lowercase
                        </span>
                        <span className={passwordChecks.hasNumberOrSymbol ? 'text-emerald-400' : ''}>
                          Number / symbol
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="signup-confirm" className="block text-xs font-medium text-text-secondary mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full h-10 px-3 rounded-control bg-surface-elevated border text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${
                      confirmPassword.length > 0 && !passwordsMatch
                        ? 'border-red-500/60 focus:border-red-400'
                        : 'border-hairline focus:border-accent'
                    }`}
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={verifyWithOtp}
                    disabled={!providers?.otp?.enabled}
                    onClick={() => setVerifyWithOtp((prev) => !prev)}
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                      verifyWithOtp
                        ? 'bg-accent border-accent text-black'
                        : 'bg-surface-elevated border-hairline text-transparent'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </button>
                  <span className="text-xs text-text-secondary leading-snug">
                    Verify email with a 6-digit OTP code upon registration
                    {providers && !providers.otp.enabled && (
                      <span className="block text-[11px] text-amber-400/90 mt-0.5">
                        Requires SMTP or Resend credentials in server/.env
                      </span>
                    )}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-control bg-accent text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? verifyWithOtp
                      ? 'Creating account & sending OTP...'
                      : 'Creating account...'
                    : 'Create account'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
