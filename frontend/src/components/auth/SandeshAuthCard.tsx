import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { IvrCallBanner } from './IvrCallBanner';

interface SandeshAuthCardProps {
  initialMode?: 'signin' | 'register';
  onSuccess?: () => void;
  isModal?: boolean;
  showIvrBanner?: boolean;
}

export const SandeshAuthCard: React.FC<SandeshAuthCardProps> = ({
  initialMode = 'signin',
  onSuccess,
  isModal = false,
  showIvrBanner = !isModal,
}) => {
  const navigate = useNavigate();
  const { login, registerWithPassword, setUser } = useAuth();

  // Mode: 'signin' | 'register' | 'forgot'
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>(initialMode);
  
  // Step for register/forgot:
  // 1: Phone & Channel selection
  // 2: OTP Verification
  // 3: Password Setup / Reset
  const [authStep, setAuthStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Telnyx OTP Channel: 'sms' | 'call'
  const [channel, setChannel] = useState<'sms' | 'call'>('sms');

  // Tokens
  const [setupToken, setSetupToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [assignedEmail, setAssignedEmail] = useState('');

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setAuthStep(1);
    setError(null);
    setInfoMessage(null);
  }, [initialMode]);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Format phone to E.164 (+91...) if raw 10-digit entered
  const getNormalizedPhone = () => {
    let p = phone.trim();
    if (!p) return '';
    if (!p.startsWith('+')) {
      if (p.length === 10) {
        p = `+91${p}`;
      } else {
        p = `+${p}`;
      }
    }
    return p;
  };

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = getNormalizedPhone();
    if (!val) {
      setError('Please enter your mobile phone number');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(val, password);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid phone or password');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 1: SEND OTP (FOR REGISTER OR FORGOT PASSWORD) ────────────────────
  const handleSendOtp = async (overrideChannel?: 'sms' | 'call') => {
    setError(null);
    setInfoMessage(null);

    const val = getNormalizedPhone();
    if (!val || val.length < 10) {
      setError('Please enter a valid mobile number with country code');
      return;
    }

    const targetChannel = overrideChannel || channel;
    const purpose = mode === 'forgot' ? 'forgot_password' : 'signup';

    setLoading(true);
    try {
      const res = await api.startOtp(val, purpose, targetChannel);
      setInfoMessage(
        res.message ||
        (targetChannel === 'call'
          ? 'Calling your phone with the verification code...'
          : 'Verification code sent via SMS.')
      );
      setAuthStep(2);
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification code');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: VERIFY OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = getNormalizedPhone();
    const code = otpCode.trim();

    if (!code || code.length < 4) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    const purpose = mode === 'forgot' ? 'forgot_password' : 'signup';

    setLoading(true);
    try {
      const res = await api.verifyOtp(val, code, purpose);
      if (mode === 'forgot') {
        if (!res.resetToken) throw new Error('Reset token missing from verification response');
        setResetToken(res.resetToken);
      } else {
        if (!res.setupToken) throw new Error('Setup token missing from verification response');
        setSetupToken(res.setupToken);
        setAssignedEmail(`${val.replace('+', '')}@sandesh.in`);
      }
      setAuthStep(3);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3A: FINALIZE SIGNUP ─────────────────────────────────────────────
  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await registerWithPassword(setupToken, password);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3B: FINALIZE PASSWORD RESET ─────────────────────────────────────
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword(resetToken, password);
      localStorage.setItem('phonemail_token', res.token);
      setUser(res.user);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.45)] p-4 sm:p-6 transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center justify-center mb-3 sm:mb-4">
        <img
          src="/sandesh-wordmark.png"
          alt="संदेश"
          className="h-9 sm:h-10 w-auto object-contain select-none dark:brightness-110"
        />
      </div>

      {/* Mode Navigation Tabs */}
      <div className="w-full mb-3.5 sm:mb-4">
        <div className="flex rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setAuthStep(1);
              setError(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setAuthStep(1);
              setError(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Sign Up
          </button>
          {mode === 'forgot' && (
            <button
              type="button"
              className="flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center space-x-2">
          <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1 leading-tight">{error}</span>
        </div>
      )}

      {/* Info Notice */}
      {infoMessage && (
        <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs sm:text-sm text-blue-700 dark:text-blue-300 flex items-center space-x-2">
          <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1 leading-tight">{infoMessage}</span>
        </div>
      )}

      {/* ── SIGN IN FORM ──────────────────────────────────────────────────── */}
      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-3" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone Number
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2 sm:py-2.5 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="2" width="14" height="20" rx="2.5" strokeWidth="1.75" />
                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <input
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2 sm:py-2.5 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="11" width="16" height="11" rx="2" strokeWidth="1.75" />
                <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="1.75" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none pr-8"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setAuthStep(1);
                setError(null);
                setInfoMessage(null);
              }}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Forgot Password ?
            </button>
          </div>

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 sm:h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-[0_8px_20px_-3px_rgba(37,99,235,0.42)] hover:shadow-[0_10px_24px_-3px_rgba(37,99,235,0.52)] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── REGISTER / FORGOT FLOW ────────────────────────────────────────── */}
      {(mode === 'register' || mode === 'forgot') && (
        <div>
          {/* STEP 1: ENTER PHONE & CHOOSE CHANNEL */}
          {authStep === 1 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {mode === 'forgot' ? 'Account Phone Number' : 'Mobile Phone Number'}
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2.5 sm:py-3 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mr-2 border-r border-slate-200 dark:border-slate-700 pr-2">
                    E.164
                  </span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Delivery Channel Selector: SMS vs Voice Call */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Deliver code via:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      channel === 'sms'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span>SMS Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('call')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      channel === 'call'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Voice IVR Call</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  className="w-full h-11 sm:h-12 px-4 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm sm:text-base shadow-[0_8px_20px_-3px_rgba(37,99,235,0.42)] hover:shadow-[0_10px_24px_-3px_rgba(37,99,235,0.52)] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    'Sending Code...'
                  ) : (
                    <span>{channel === 'call' ? 'Call Me With Code' : 'Send Verification SMS'}</span>
                  )}
                </button>
              </div>

              {mode === 'forgot' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ENTER OTP */}
          {authStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div className="text-center mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Code sent to <span className="font-semibold text-slate-700 dark:text-slate-200">{getNormalizedPhone()}</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  (If message is delayed, choose Voice Call or check console)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-12 text-center text-xl font-bold tracking-[0.4em] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Didn&apos;t get the code?</span>
                <div className="space-x-2">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={() => handleSendOtp(channel === 'sms' ? 'call' : 'sms')}
                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : channel === 'sms'
                      ? 'Call me instead'
                      : 'Send SMS instead'}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAuthStep(1)}
                  className="h-11 sm:h-12 px-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 sm:h-12 px-4 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm sm:text-base shadow-[0_8px_20px_-3px_rgba(37,99,235,0.42)] hover:shadow-[0_10px_24px_-3px_rgba(37,99,235,0.52)] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: CREATE / RESET PASSWORD */}
          {authStep === 3 && (
            <form
              onSubmit={mode === 'forgot' ? handleCompleteReset : handleCompleteRegister}
              className="space-y-3.5"
              autoComplete="off"
            >
              {mode === 'register' && (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 rounded-xl mb-1">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                    Your Assigned Sandesh Email:
                  </span>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300 font-mono">
                    {assignedEmail || `${phone.replace('+', '')}@sandesh.in`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {mode === 'forgot' ? 'Set New Password' : 'Create Password'}
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2.5 sm:py-3 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2.5 sm:py-3 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 sm:h-12 px-4 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm sm:text-base shadow-[0_8px_20px_-3px_rgba(37,99,235,0.42)] hover:shadow-[0_10px_24px_-3px_rgba(37,99,235,0.52)] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading
                    ? mode === 'forgot'
                      ? 'Updating Password...'
                      : 'Creating Account...'
                    : mode === 'forgot'
                    ? 'Save & Login'
                    : 'Complete & Open Inbox'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Bottom Legal / Terms Note */}
      <div className="mt-3.5 sm:mt-4 text-center">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-[310px] mx-auto">
          By continuing, you agree to Sandesh&apos;s{' '}
          <Link
            to="/terms"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
          >
            terms of service
          </Link>{' '}
          and{' '}
          <Link
            to="/privacy"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
          >
            privacy policy
          </Link>
          .
        </p>
      </div>

      {/* IVR Call to Sign Up Banner placed at the bottom of the card */}
      {showIvrBanner && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
          <IvrCallBanner />
        </div>
      )}
    </div>
  );
};
