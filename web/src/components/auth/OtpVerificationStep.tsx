import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';

interface OtpVerificationStepProps {
  maskedEmail: string;
  email: string;
  challengeId: string;
  expiresInSec?: number;
  initialResendAfterSec?: number;
  title?: string;
  submitLabel?: string;
  onVerify: (otp: string) => Promise<{ ok: boolean; error?: string; attemptsRemaining?: number }>;
  onResend: () => Promise<{
    ok: boolean;
    error?: string;
    resendAfterSec?: number;
    retryAfterSec?: number;
  }>;
  onBack: () => void;
}

const OTP_LENGTH = 6;

const formatCountdown = (totalSeconds: number): string => {
  const clamped = Math.max(0, totalSeconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const OtpVerificationStep: React.FC<OtpVerificationStepProps> = ({
  maskedEmail,
  email,
  challengeId,
  expiresInSec = 180,
  initialResendAfterSec = 30,
  title = 'Two-step email verification',
  submitLabel = 'Verify code & sign in',
  onVerify,
  onResend,
  onBack,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [expiresRemaining, setExpiresRemaining] = useState(expiresInSec);
  const [resendCooldown, setResendCooldown] = useState(initialResendAfterSec);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setExpiresRemaining(expiresInSec);
  }, [expiresInSec, challengeId]);

  useEffect(() => {
    setResendCooldown(initialResendAfterSec);
  }, [initialResendAfterSec, challengeId]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [challengeId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setExpiresRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const code = digits.join('');
  const isExpired = expiresRemaining <= 0;

  const submitCode = async (candidate: string) => {
    if (submitting || candidate.length !== OTP_LENGTH || isExpired) return;
    setSubmitting(true);
    setError(null);
    setStatusNotice(null);
    const res = await onVerify(candidate);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Verification failed. Check the 6-digit code and try again.');
      if (typeof res.attemptsRemaining === 'number') {
        setAttemptsRemaining(res.attemptsRemaining);
      }
      setDigits(Array(OTP_LENGTH).fill(''));
      window.setTimeout(() => inputRefs.current[0]?.focus(), 20);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < OTP_LENGTH - index && i < cleaned.length; i += 1) {
        next[index + i] = cleaned[i];
      }
      setDigits(next);
      setError(null);
      const nextFocus = Math.min(OTP_LENGTH - 1, index + cleaned.length);
      inputRefs.current[nextFocus]?.focus();
      const joined = next.join('');
      if (joined.length === OTP_LENGTH) {
        void submitCode(joined);
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError(null);
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else {
      const joined = next.join('');
      if (joined.length === OTP_LENGTH) {
        void submitCode(joined);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && code.length === OTP_LENGTH) {
      e.preventDefault();
      void submitCode(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(null);
    const focusIndex = Math.min(OTP_LENGTH - 1, pasted.length - 1);
    inputRefs.current[focusIndex]?.focus();
    if (pasted.length === OTP_LENGTH) {
      void submitCode(pasted);
    }
  };

  const handleResend = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    setError(null);
    setStatusNotice(null);
    const res = await onResend();
    setResending(false);
    if (res.ok) {
      setResendCooldown(res.resendAfterSec ?? 30);
      setExpiresRemaining(expiresInSec);
      setAttemptsRemaining(null);
      setDigits(Array(OTP_LENGTH).fill(''));
      setStatusNotice(`A fresh 6-digit verification code has been sent to ${maskedEmail}.`);
      inputRefs.current[0]?.focus();
    } else {
      if (typeof res.retryAfterSec === 'number') {
        setResendCooldown(res.retryAfterSec);
      }
      setError(res.error || 'Could not resend verification code.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">
            We sent a 6-digit security code to{' '}
            <span className="text-text-primary font-medium">{maskedEmail || email}</span>.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>6-digit verification code</span>
          <span className={`font-mono tabular-nums ${isExpired ? 'text-red-400' : 'text-text-secondary'}`}>
            {isExpired ? 'Code expired' : `Expires in ${formatCountdown(expiresRemaining)}`}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="6-digit OTP code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={OTP_LENGTH}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={submitting || isExpired}
              aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
              className="h-12 sm:h-13 w-full rounded-lg bg-[#0F0F10] border border-hairline text-center text-lg font-mono font-semibold text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:opacity-50 transition-colors"
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p>{error}</p>
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <p className="text-red-300/80">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before lock.
              </p>
            )}
          </div>
        </div>
      )}

      {statusNotice && !error && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
          {statusNotice}
        </div>
      )}

      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={() => void submitCode(code)}
          disabled={submitting || code.length !== OTP_LENGTH || isExpired}
          className="w-full h-11 rounded-lg bg-accent text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Verifying code...' : submitLabel}
        </button>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || resendCooldown > 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-amber-300 disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>
              {resending
                ? 'Sending...'
                : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : 'Resend code'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
