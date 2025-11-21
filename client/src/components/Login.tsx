import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Phone, Send, Sparkles, Shield, ArrowRight, Star, Zap, Globe, Heart } from 'lucide-react';
import { HeroLogo } from '@/components/ui/logo';

export default function MtaaDAOLogin() {
  // OAuth handlers
  const handleGoogleAuth = () => {
    window.location.href = "/api/auth/oauth/google?mode=login";
  };
  const handleTelegramAuth = () => {
    window.location.href = "/api/auth/telegram/init?mode=login";
  };
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [loginType, setLoginType] = useState<'email' | 'phone' | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    // Load remembered email if exists
    const rememberedEmail = localStorage.getItem('mtaa_remembered_email');
    if (rememberedEmail) {
      setEmailOrPhone(rememberedEmail);
      setRememberMe(true);
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRemainingAttempts(null);
    setLockedUntil(null);
    setIsLoading(true);
    
    if (!emailOrPhone || !password) {
      setError('Email/Phone and password are required.');
      setIsLoading(false);
      return;
    }
    
    // Determine login type
    let type: 'email' | 'phone' | null = null;
    if (emailOrPhone.includes('@')) {
      type = 'email';
    } else if (/^\+[1-9]\d{1,14}$/.test(emailOrPhone)) {
      type = 'phone';
    }
    setLoginType(type);
    
    try {
      // Call backend login API
      const payload: any = { password };
      if (type === 'email') {
        payload.email = emailOrPhone;
      } else if (type === 'phone') {
        payload.phone = emailOrPhone;
      } else {
        // Try as email by default
        payload.email = emailOrPhone;
      }
      
      console.log('[LOGIN] Sending login request...');
      
      // Add timeout to prevent indefinite waiting
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('[LOGIN] Received response:', response.status);
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          // Account locked
          setLockedUntil(data.lockedUntil);
          setError(data.error || 'Too many failed attempts. Please try again later.');
        } else if (data.remainingAttempts !== undefined) {
          // Show remaining attempts
          setRemainingAttempts(data.remainingAttempts);
          setError(data.error || 'Invalid credentials.');
        } else {
          setError(data.error || 'Invalid credentials. Please try again.');
        }
        setIsLoading(false);
        return;
      }
      
      // Successful login - data will be stored by useAuth hook if used
      if (data.success && data.data?.user) {
        console.log('[LOGIN] Login successful, storing data and redirecting...');
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(data.data.user));
        localStorage.setItem('accessToken', data.data.accessToken);
        
        // Handle remember me
        if (rememberMe) {
          localStorage.setItem('mtaa_remembered_email', emailOrPhone);
        } else {
          localStorage.removeItem('mtaa_remembered_email');
        }
        
        // Redirect to dashboard - use replace to avoid back button issues
        console.log('[LOGIN] Redirecting to dashboard...');
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 100);
      } else {
        throw new Error('Login failed. Invalid response from server.');
      }
    } catch (err: any) {
      console.error('[LOGIN] Error:', err);
      if (err.name === 'AbortError') {
        setError('Login request timed out. Please check your connection and try again.');
      } else {
        setError(err.message || 'An error occurred during login. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const socialProviders = [
    {
      name: 'Google',
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      gradient: 'from-red-500 to-yellow-500'
    },
    {
      name: 'Telegram',
      icon: Send,
      gradient: 'from-blue-500 to-cyan-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Minimal Cursor Dot */}
      <div 
        className="fixed pointer-events-none z-50 w-2 h-2 bg-orange-500/60 rounded-full transition-all duration-200"
        style={{
          left: mousePosition.x - 4,
          top: mousePosition.y - 4,
          transform: `translate3d(0, 0, 0) scale(${mousePosition.x > 0 ? 1 : 0})`
        }}
      />

      {/* Subtle Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Single accent orb - very subtle */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-orange-600/10 to-transparent rounded-full blur-3xl"></div>
        
        {/* Minimal Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
        
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"></div>
      </div>

      {/* MTAA DAO Logo */}
      <div className={`relative z-10 mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'} flex justify-center`}>
        <img src="/mtaa_dao_logos/icon_dark_lg.png" alt="MTAA DAO" className="h-24 w-24 object-contain" />
      </div>

      {/* Main Content */}
      <div className={`relative z-10 w-full max-w-md transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        {/* Minimalist Login Card */}
        <div className="relative">
          <div className="bg-slate-900/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-800/50 p-8 hover:border-orange-500/30 transition-all duration-500">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome Back
              </h1>
              <p className="text-slate-400 text-sm font-medium">
                Access your community
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`mb-6 p-4 rounded-lg backdrop-blur-sm border ${
                lockedUntil 
                  ? 'bg-orange-500/10 border-orange-600/30' 
                  : 'bg-red-500/10 border-red-600/30'
              }`}>
                <div className="flex items-start">
                  <AlertCircle className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                    lockedUntil ? 'text-orange-400' : 'text-red-400'
                  }`} />
                  <div className="flex-1">
                    <span className={`font-medium text-sm ${
                      lockedUntil ? 'text-orange-200' : 'text-red-200'
                    }`}>{error}</span>
                    
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <div className="mt-2 text-xs text-orange-300">
                        ⚠️ {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                      </div>
                    )}
                    
                    {lockedUntil && (
                      <div className="mt-3 p-2 bg-orange-600/20 rounded">
                        <div className="text-xs text-orange-300">
                          🔒 Account temporarily locked
                        </div>
                        <div className="text-xs text-orange-300/80 mt-1">
                          Try again after 15 minutes or <a href="/forgot-password" className="underline">reset password</a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Email/Phone Field */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Email or Phone
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500 w-4 h-4 z-10" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500/50 transition-all duration-300 hover:bg-slate-800/70 text-sm"
                    placeholder="name@example.com or +1234567890"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-slate-500 w-4 h-4 z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-10 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500/50 transition-all duration-300 hover:bg-slate-800/70 text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-400 transition-colors z-10 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center text-slate-400 font-medium cursor-pointer hover:text-slate-300 transition-colors">
                  <input
                    type="checkbox"
                    className="mr-2 w-3.5 h-3.5 text-orange-500 bg-slate-800 border border-slate-700 rounded focus:ring-orange-500 focus:ring-1 transition-all"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <a href="/forgot-password" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">Forgot Password?</a>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700/50"></div>
              <span className="text-xs text-slate-500 font-medium">Or continue with</span>
              <div className="flex-1 h-px bg-slate-700/50"></div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/30 rounded-lg text-white text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2"
                onClick={handleGoogleAuth}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                className="py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/30 rounded-lg text-white text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2"
                onClick={handleTelegramAuth}
              >
                <Send className="w-4 h-4" />
                <span>Telegram</span>
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center text-sm">
              <p className="text-slate-400">
                New to Mtaa DAO?{' '}
                <a href="/register" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">
                  Join now
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}