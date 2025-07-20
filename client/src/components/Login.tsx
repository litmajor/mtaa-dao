import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Phone, Send, Sparkles, Shield, ArrowRight, Star, Zap, Globe, Heart } from 'lucide-react';

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
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      if (loginType === 'email') payload.email = emailOrPhone;
      else if (loginType === 'phone') payload.phone = emailOrPhone;
      else payload.emailOrPhone = emailOrPhone;
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Invalid credentials. Please try again.');
      }
      const data = await response.json();
      if (!data || !data.userId) {
        throw new Error('Login failed. No user found.');
      }
      // Set userId cookie and redirect
      document.cookie = `userId=${data.userId}; path=/;`;
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Cursor Trail */}
      <div 
        className="fixed pointer-events-none z-50 w-4 h-4 bg-gradient-to-r from-orange-400 to-pink-600 rounded-full blur-sm opacity-60 transition-all duration-300"
        style={{
          left: mousePosition.x - 8,
          top: mousePosition.y - 8,
          transform: `translate3d(0, 0, 0) scale(${mousePosition.x > 0 ? 1 : 0})`
        }}
      />

      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        
        {/* Floating Particles */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Main Content */}
      <div className={`relative z-10 w-full max-w-md transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        {/* Glassmorphism Login Card */}
        <div className="relative group">
          {/* Card Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 hover:border-white/30 transition-all duration-500">
            {/* Header */}
            <div className="text-center mb-8">
              {/* Logo */}
              <div className="relative group/logo mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-600 rounded-3xl blur-xl opacity-60 group-hover/logo:opacity-80 transition-all duration-300 animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl transform group-hover/logo:scale-110 transition-all duration-300">
                  <span className="text-white font-black text-2xl">M</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              
              <h1 className="text-4xl font-black text-white mb-2">
                <span className="bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent">
                  Welcome Back
                </span>
              </h1>
              <p className="text-purple-200 text-lg font-medium">
                Continue your community journey
              </p>
              
              {/* Stats Pills */}
              <div className="flex justify-center gap-2 mt-4">
                <div className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80 font-medium backdrop-blur-sm">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Secure
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80 font-medium backdrop-blur-sm">
                  <Zap className="w-3 h-3 inline mr-1" />
                  Fast
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80 font-medium backdrop-blur-sm">
                  <Globe className="w-3 h-3 inline mr-1" />
                  Global
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center text-red-100 backdrop-blur-sm animate-pulse">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Email/Phone Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">
                  Email or Phone Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 text-white/50 w-5 h-5 z-10" />
                    <Phone className="absolute left-10 text-white/50 w-4 h-4 z-10" />
                    <input
                      type="text"
                      className="w-full pl-16 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/20"
                      placeholder="Enter your email or phone number"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 text-white/50 w-5 h-5 z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/20"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 text-white/50 hover:text-white transition-all duration-200 hover:scale-110 z-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center text-white/80 font-medium cursor-pointer group">
                  <input
                    type="checkbox"
                    className="mr-3 w-4 h-4 text-orange-500 bg-white/10 border border-white/20 rounded focus:ring-orange-500 focus:ring-2 transition-all duration-200"
                  />
                  <span className="group-hover:text-white transition-colors">Remember me</span>
                </label>
                <a href="#" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors hover:underline">
                  <a href="/forgot-password" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors hover:underline">Forgot password?</a>
                </a>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="relative w-full group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 rounded-2xl blur opacity-50 group-hover:opacity-70 transition-all duration-300"></div>
                <div className="relative w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-600 hover:via-pink-600 hover:to-purple-700 text-white py-4 rounded-2xl font-bold text-lg shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                  {/* Button Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 group-hover:animate-pulse opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      <span>Signing you in...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Heart className="w-5 h-5 mr-2" />
                      Sign Into Your Community
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="my-8 flex items-center">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <span className="px-4 text-white/60 font-medium">Or continue with</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="relative group overflow-hidden"
                onClick={handleGoogleAuth}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-yellow-500 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-all duration-300"></div>
                <div className="relative flex items-center justify-center py-4 px-4 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="font-semibold">Google</span>
                </div>
              </button>
              <button
                type="button"
                className="relative group overflow-hidden"
                onClick={handleTelegramAuth}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-all duration-300"></div>
                <div className="relative flex items-center justify-center py-4 px-4 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
                  <Send className="w-5 h-5 mr-2" />
                  <span className="font-semibold">Telegram</span>
                </div>
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-8 text-center">
              <p className="text-white/80 text-lg">
                New to Mtaa DAO?{' '}
                <a href="/register" className="text-orange-400 hover:text-orange-300 font-bold transition-colors hover:underline">
                  Join the Community
                </a>
              </p>
            </div>

            {/* Trust Indicators */}
            <div className="mt-6 flex justify-center gap-6 text-white/60">
              <div className="flex items-center text-xs">
                <Shield className="w-3 h-3 mr-1" />
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center text-xs">
                <Star className="w-3 h-3 mr-1" />
                <span>Trusted by 25K+</span>
              </div>
              <div className="flex items-center text-xs">
                <Zap className="w-3 h-3 mr-1" />
                <span>Lightning Fast</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}