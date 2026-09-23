'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResendVerification, useVerifyEmail } from '@/features/auth/hooks/useAuth';
import { AuthShell, FormErrorAlert } from '@/features/auth/components';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast';
import { ApiError } from '@/types';
import {
  AUTH_ALERT_MARGIN,
  AUTH_HEADER_SECTION,
  AUTH_MOBILE_SCROLL_COLUMN,
  AUTH_PAGE_SUBTITLE,
  AUTH_PAGE_TITLE,
} from '@/features/auth/lib/auth-spacing';

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email')?.trim() ?? '';
  const resend = useResendVerification();
  const verifyEmail = useVerifyEmail({ redirectTo: '/' });
  const toast = useToast();

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const initialToastShown = useRef(false);

  useEffect(() => {
    if (email && !initialToastShown.current) {
      initialToastShown.current = true;
      toast.success({
        title: 'Verification code sent',
        description: `We've sent a 6-digit code to ${email}. Valid for 10 minutes.`,
      });
    }
  }, [email, toast]);

  const handleVerifyOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setOtpError('Please enter the complete 6-digit code');
      return;
    }
    setOtpError(null);
    verifyEmail.mutate(cleanOtp, {
      onSuccess: () => {
        toast.success({
          title: 'Account verified!',
          description: 'Welcome to Connect! Taking you to your workspace...',
        });
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : 'Invalid or expired code. Please try again.';
        setOtpError(msg);
        toast.error({
          title: 'Verification failed',
          description: msg,
        });
      },
    });
  };

  const handleResend = () => {
    if (!email) return;
    setResendSuccess(false);
    setOtpError(null);
    resend.mutate(email, {
      onSuccess: () => {
        setResendSuccess(true);
        setOtp('');
        toast.success({
          title: 'New code sent',
          description: `A fresh 6-digit code was sent to ${email}.`,
        });
      },
      onError: (err) => {
        toast.error({
          title: 'Failed to resend code',
          description: err instanceof ApiError ? err.message : 'Please try again in a few moments.',
        });
      },
    });
  };

  return (
    <AuthShell
      compactVisual
      panelTitle={<>Check<br />your inbox.</>}
      panelDescription="Enter the 6-digit code we sent to activate your workspace."
    >
      <div className="flex min-h-0 flex-1 flex-col lg:block lg:flex-none">
        <div className={AUTH_MOBILE_SCROLL_COLUMN}>
          <header className={AUTH_HEADER_SECTION}>
            <h1 className={AUTH_PAGE_TITLE}>Enter verification code</h1>
            <p className={AUTH_PAGE_SUBTITLE}>
              {email ? (
                <>
                  We sent a 6-digit code to <span className="font-medium text-neutral-800">{email}</span>.
                </>
              ) : (
                <>Enter the 6-digit code sent to your email.</>
              )}
            </p>
          </header>

          {resendSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-200">
              <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>A new verification code has been sent! Check your inbox or spam folder.</span>
            </div>
          )}

          {otpError && (
            <FormErrorAlert className={AUTH_ALERT_MARGIN}>
              <p>{otpError}</p>
            </FormErrorAlert>
          )}

          {/* OTP Input Form */}
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
            <div>
              <label htmlFor="otp-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                6-digit code (valid for 10 min)
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(val);
                  if (otpError) setOtpError(null);
                }}
                placeholder="••••••"
                className="w-full text-center text-3xl font-mono font-bold tracking-[10px] py-3.5 px-4 rounded-xl border border-neutral-200 bg-neutral-50/70 text-neutral-900 focus:bg-white focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all placeholder:tracking-[8px] placeholder:text-neutral-300"
              />
            </div>

            <Button
              type="submit"
              className="min-h-[48px] w-full text-[15px] font-semibold"
              size="lg"
              loading={verifyEmail.isPending}
              disabled={otp.length !== 6 || verifyEmail.isPending}
            >
              Verify code & continue
            </Button>
          </form>

          {/* Action buttons */}
          <div className="mt-5 space-y-2.5">
            <Button
              type="button"
              className="min-h-[44px] w-full text-sm font-medium"
              size="md"
              variant="outline"
              loading={resend.isPending}
              disabled={!email || resend.isPending}
              onClick={handleResend}
            >
              Resend code
            </Button>

            <Button
              type="button"
              className="min-h-[44px] w-full text-sm font-medium text-neutral-600 hover:text-neutral-900"
              size="md"
              variant="ghost"
              onClick={() => router.push('/login')}
            >
              Back to sign in
            </Button>
          </div>

          {!email && (
            <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
              Missing email in the URL — resend is available from the sign-in page.
            </p>
          )}
        </div>
      </div>
    </AuthShell>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-neutral-500">
          Loading…
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
