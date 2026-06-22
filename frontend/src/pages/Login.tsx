import React, { useState } from 'react';
import { auth, isMock } from '../firebase';
import { LogIn, Shield, UserPlus, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mockRole, setMockRole] = useState<'annotator' | 'lead' | 'admin'>('admin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        if (isMock) {
          await auth.signInWithEmailAndPassword(email || 'dev@example.com', mockRole);
        } else {
          await auth.signInWithEmailAndPassword(email, password);
        }
      } else if (mode === 'signup') {
        if (!isMock && password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (isMock) {
          await auth.signUpWithEmailAndPassword(email || 'dev@example.com', password, mockRole);
        } else {
          await auth.signUpWithEmailAndPassword(email, password);
        }
        setSuccess('Account created successfully! Logging you in...');
      } else if (mode === 'forgot') {
        if (isMock) {
          setSuccess('Mock password reset email sent!');
        } else {
          await auth.sendPasswordResetEmail(email);
          setSuccess('Password reset link sent! Check your email inbox.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isMock) {
        await auth.signInWithGoogle(mockRole);
      } else {
        await auth.signInWithGoogle();
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed. Ensure it is enabled in your Firebase console.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 geometric-bg">
      <div className="w-full max-w-md bg-[#1b1920] border border-cardBorder rounded-xl p-8 shadow-2xl glow-amber space-y-6">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-accentA mx-auto flex items-center justify-center font-bold text-black font-serif text-2xl">
            Ω
          </div>
          <h2 className="text-2xl font-bold font-serif text-textWarm">
            {mode === 'signin' && 'RLHF Platform Sign In'}
            {mode === 'signup' && 'Create RLHF Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs text-textMuted uppercase tracking-wider">
            {isMock ? 'Developer Sandbox Mode Active' : 'Internal Annotator Portal'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-brandRed/10 border border-brandRed/20 text-brandRed rounded-lg text-xs font-mono text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-[#4FD1C5]/10 border border-[#4FD1C5]/20 text-[#4FD1C5] rounded-lg text-xs font-mono text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-textMuted uppercase">Email Address</label>
            <input
              type="email"
              required
              placeholder={isMock ? 'dev@example.com (Optional)' : 'annotator@company.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#222026] border border-cardBorder focus:border-accentA/60 rounded px-3 py-2 text-sm text-textWarm focus:outline-none transition-all"
            />
          </div>

          {/* Password Input (Hidden in Mock mode & Forgot mode) */}
          {!isMock && mode !== 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-textMuted uppercase">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#222026] border border-cardBorder focus:border-accentA/60 rounded px-3 py-2 text-sm text-textWarm focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Confirm Password Input (SignUp only) */}
          {!isMock && mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-textMuted uppercase">Confirm Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#222026] border border-cardBorder focus:border-accentA/60 rounded px-3 py-2 text-sm text-textWarm focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Mock Role Selector (Visible only in Mock mode) */}
          {isMock && (
            <div className="space-y-2 bg-[#222026] border border-cardBorder/60 p-4 rounded-lg">
              <label className="text-xs font-mono text-accentB font-bold uppercase flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Select Mock Authorization Role:
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['annotator', 'lead', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMockRole(r)}
                    className={`px-2 py-1.5 text-xs font-mono rounded border transition-all ${
                      mockRole === r
                        ? 'bg-accentB/10 border-accentB text-accentB font-bold'
                        : 'bg-background border-cardBorder text-textMuted hover:text-textWarm'
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accentA hover:bg-accentA/90 text-black font-semibold rounded py-2 text-sm font-sans flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(255,122,51,0.15)] disabled:opacity-50"
          >
            {mode === 'signin' && <LogIn className="w-4 h-4" />}
            {mode === 'signup' && <UserPlus className="w-4 h-4" />}
            {mode === 'forgot' && <Mail className="w-4 h-4" />}
            <span>
              {loading ? 'Processing...' : 
                mode === 'signin' ? (isMock ? 'Launch Developer Mode' : 'Sign In with Email') : 
                mode === 'signup' ? 'Create Account' : 
                'Send Password Reset Link'}
            </span>
          </button>
        </form>

        {mode === 'signin' && (
          <>
            <div className="relative flex py-2 items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cardBorder"></div>
              </div>
              <span className="relative px-3 bg-[#1b1920] text-[10px] font-mono text-textMuted uppercase">or</span>
            </div>

            {/* Google sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-transparent hover:bg-[#222026] text-textWarm font-semibold border border-cardBorder rounded py-2 text-sm font-sans flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In with Google</span>
            </button>
          </>
        )}

        {/* Footer Navigation */}
        <div className="flex flex-col items-center space-y-2 pt-2 border-t border-cardBorder/40">
          {mode === 'signin' && (
            <>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs font-mono text-accentB hover:underline"
              >
                Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-xs font-mono text-textMuted hover:text-textWarm transition-colors"
              >
                Don't have an account? <span className="text-accentA font-semibold hover:underline">Sign Up</span>
              </button>
            </>
          )}

          {mode === 'signup' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-xs font-mono text-textMuted hover:text-textWarm transition-colors"
            >
              Already have an account? <span className="text-accentA font-semibold hover:underline">Sign In</span>
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-xs font-mono text-textMuted hover:text-textWarm transition-colors"
            >
              Back to <span className="text-accentA font-semibold hover:underline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
