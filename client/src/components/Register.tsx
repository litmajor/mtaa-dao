
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, UserPlus, Check, Phone, Send, Sparkles, Shield, Zap, ArrowLeft } from 'lucide-react';
import { HeroLogo } from '@/components/ui/logo';

export default function StunningRegister() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // Phone number without country code
  const [countryCode, setCountryCode] = useState('+254'); // Default to Kenya
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [step, setStep] = useState('method'); // 'method', 'email', 'phone', 'password', 'otp'
  const [method, setMethod] = useState<'email' | 'phone' | ''>('');
  const [countryInfo, setCountryInfo] = useState<{ code: string; flag: string; name: string } | null>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  
  // Extended country code map with popular African countries first
  const countryCodes: Record<string, { flag: string; name: string }> = {
    '+254': { flag: '🇰🇪', name: 'Kenya' },
    '+234': { flag: '🇳🇬', name: 'Nigeria' },
    '+255': { flag: '🇹🇿', name: 'Tanzania' },
    '+256': { flag: '🇺🇬', name: 'Uganda' },
    '+27': { flag: '🇿🇦', name: 'South Africa' },
    '+233': { flag: '🇬🇭', name: 'Ghana' },
    '+251': { flag: '🇪🇹', name: 'Ethiopia' },
    '+250': { flag: '🇷🇼', name: 'Rwanda' },
    '+237': { flag: '🇨🇲', name: 'Cameroon' },
    '+225': { flag: '🇨🇮', name: 'Côte d\'Ivoire' },
    '+1': { flag: '🇺🇸', name: 'United States' },
    '+44': { flag: '🇬🇧', name: 'United Kingdom' },
    '+91': { flag: '🇮🇳', name: 'India' },
    '+49': { flag: '🇩🇪', name: 'Germany' },
    '+81': { flag: '🇯🇵', name: 'Japan' },
    '+61': { flag: '🇦🇺', name: 'Australia' },
    '+33': { flag: '🇫🇷', name: 'France' },
    '+86': { flag: '🇨🇳', name: 'China' },
    '+7': { flag: '🇷🇺', name: 'Russia' },
    '+55': { flag: '🇧🇷', name: 'Brazil' },
    '+52': { flag: '🇲🇽', name: 'Mexico' },
    '+39': { flag: '🇮🇹', name: 'Italy' },
    '+34': { flag: '🇪🇸', name: 'Spain' },
    '+31': { flag: '🇳🇱', name: 'Netherlands' },
    '+46': { flag: '🇸🇪', name: 'Sweden' },
    '+47': { flag: '🇳🇴', name: 'Norway' },
    '+45': { flag: '🇩🇰', name: 'Denmark' },
    '+358': { flag: '🇫🇮', name: 'Finland' },
    '+41': { flag: '🇨🇭', name: 'Switzerland' },
    '+43': { flag: '🇦🇹', name: 'Austria' },
    '+32': { flag: '🇧🇪', name: 'Belgium' },
    '+351': { flag: '🇵🇹', name: 'Portugal' },
    '+30': { flag: '🇬🇷', name: 'Greece' },
    '+48': { flag: '🇵🇱', name: 'Poland' },
    '+420': { flag: '🇨🇿', name: 'Czech Republic' },
    '+36': { flag: '🇭🇺', name: 'Hungary' },
    '+40': { flag: '🇷🇴', name: 'Romania' },
    '+359': { flag: '🇧🇬', name: 'Bulgaria' },
    '+385': { flag: '🇭🇷', name: 'Croatia' },
    '+386': { flag: '🇸🇮', name: 'Slovenia' },
    '+421': { flag: '🇸🇰', name: 'Slovakia' },
    '+370': { flag: '🇱🇹', name: 'Lithuania' },
    '+371': { flag: '🇱🇻', name: 'Latvia' },
    '+372': { flag: '🇪🇪', name: 'Estonia' },
  };
  
  // Phone number validation (for the number part only, without country code)
  const validatePhoneNumber = (number: string) => {
    // Check if it's only digits
    if (!/^\d+$/.test(number)) return false;
    
    // Check length (typically 7-15 digits for most countries)
    return number.length >= 7 && number.length <= 15;
  };
  
  // Update full phone when country code or phone number changes
  useEffect(() => {
    if (method === 'phone') {
      const fullPhone = `${countryCode}${phoneNumber}`;
      setPhone(fullPhone);
      
      if (countryCodes[countryCode]) {
        setCountryInfo({ code: countryCode, ...countryCodes[countryCode] });
      }
    }
  }, [countryCode, phoneNumber, method]);
  
  // Auto-detect country code from user's location (optional feature)
  useEffect(() => {
    if (method === 'phone') {
      // Try to detect user's country from browser/IP
      // This is a simple implementation - you could use a geolocation API
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          const detectedCode = data.country_calling_code;
          if (detectedCode && countryCodes[detectedCode]) {
            setCountryCode(detectedCode);
          }
        })
        .catch(() => {
          // Fallback to Kenya if detection fails
          setCountryCode('+254');
        });
    }
  }, [method]);

  // Track mouse position for interactive effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Cooldown timer for resend OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Reset form when method changes
  const resetForm = () => {
    setEmail('');
    setPhone('');
    setPhoneNumber('');
    setCountryCode('+254');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setOtp('');
    setOtpSent(false);
    setCountryInfo(null);
    setShowCountryDropdown(false);
    setResendFeedback({ type: '', message: '' });
    setResendCooldown(0);
  };

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    return checks;
  };

  const passwordChecks = checkPasswordStrength(password);
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your password.');
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    if (passwordScore < 3) {
      setError('Password is too weak. Please choose a stronger password.');
      setIsLoading(false);
      return;
    }

    // Additional validation based on method
    if (method === 'email' && !email) {
      setError('Please enter your email address.');
      setIsLoading(false);
      return;
    }
    if (method === 'phone') {
      if (!phoneNumber) {
        setError('Please enter your phone number.');
        setIsLoading(false);
        return;
      }
      if (!validatePhoneNumber(phoneNumber)) {
        setError('Please enter a valid phone number (7-15 digits).');
        setIsLoading(false);
        return;
      }
    }

    try {
  // Send registration details to backend
  const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...(method === 'email' ? { email } : { phone }),
          password
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Registration failed.');
      }

      setOtpSent(true);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setOtpLoading(true);
    
    try {
      // Verify OTP with backend
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(method === 'email' ? { email } : { phone }),
          otp
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'OTP verification failed');
      }

      setStep('success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    setResendFeedback({ type: '', message: '' });
    setError('');
    
    try {
      // Resend OTP to backend
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(method === 'email' ? { email } : { phone })
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend OTP');
      }

      setResendFeedback({ 
        type: 'success', 
        message: `OTP sent successfully to your ${method === 'email' ? 'email' : 'phone'}!` 
      });
      setResendCooldown(60); // 60 seconds cooldown
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setResendFeedback({ type: '', message: '' });
      }, 5000);
    } catch (err: any) {
      setResendFeedback({ 
        type: 'error', 
        message: err.message || 'Failed to resend OTP. Please try again.' 
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setResendFeedback({ type: '', message: '' });
      }, 5000);
    } finally {
      setResendLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordScore <= 2) return 'from-red-500 via-red-400 to-pink-500';
    if (passwordScore <= 3) return 'from-yellow-500 via-orange-400 to-red-500';
    return 'from-green-400 via-emerald-500 to-teal-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordScore <= 2) return 'Weak';
    if (passwordScore <= 3) return 'Good';
    return 'Strong';
  };

  // Handler for Google account creation
  const handleGoogleRegister = async () => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to initialize Google sign-up');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google sign-up');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0">
        {/* Floating orbs */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
          style={{
            top: '10%',
            left: '10%',
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
            transition: 'transform 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
          style={{
            top: '60%',
            right: '10%',
            transform: `translate(${mousePosition.x * -0.02}px, ${mousePosition.y * -0.02}px)`,
            transition: 'transform 0.3s ease-out',
            animationDelay: '2s'
          }}
        />
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-teal-500 to-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
          style={{
            bottom: '10%',
            left: '50%',
            transform: `translate(${mousePosition.x * 0.01}px, ${mousePosition.y * 0.01}px)`,
            transition: 'transform 0.3s ease-out',
            animationDelay: '4s'
          }}
        />
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Scrollable container */}
          <div className="max-h-[95vh] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent hover:scrollbar-thumb-purple-400/70 pr-2">
            
            {/* Success animation */}
            {step === 'success' && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center border border-white/20">
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Welcome aboard! 🎉</h3>
                  <p className="text-white/80">Your account has been created successfully</p>
                </div>
              </div>
            )}

            {/* Main card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl p-8 transition-all duration-500 hover:shadow-3xl hover:bg-white/15 mb-4">
              {/* Header with animated logo */}
              <div className="text-center mb-8">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <HeroLogo variant="icon" size="lg" forceTheme="dark" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-bounce">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-3">
                  Join the Future
                </h2>
                <p className="text-white/80 text-lg">Choose how you'd like to sign up</p>
              </div>

              {/* Registration method buttons */}
              {step === 'method' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => { 
                      resetForm();
                      setMethod('email'); 
                      setStep('email'); 
                    }}
                    className="w-full flex items-center justify-center py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm group"
                  >
                    <Mail className="w-6 h-6 mr-3 transition-transform duration-300 group-hover:scale-110" />
                    <span className="font-medium">Continue with Email</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => { 
                      resetForm();
                      setMethod('phone'); 
                      setStep('phone'); 
                    }}
                    className="w-full flex items-center justify-center py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm group"
                  >
                    <Phone className="w-6 h-6 mr-3 transition-transform duration-300 group-hover:scale-110" />
                    <span className="font-medium">Continue with Phone</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleRegister}
                    className="w-full flex items-center justify-center py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm group"
                  >
                    <div className="w-6 h-6 mr-3 transition-transform duration-300 group-hover:scale-110">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="font-medium">Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    className="w-full flex items-center justify-center py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm group"
                  >
                    <Send className="w-6 h-6 mr-3 transition-transform duration-300 group-hover:scale-110" />
                    <span className="font-medium">Continue with Telegram</span>
                  </button>
                </div>
              )}

              {/* Back button and Progress indicator */}
              {step !== 'method' && (
                <div className="mb-8 space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('method');
                      setMethod('');
                      resetForm();
                    }}
                    className="flex items-center text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to methods
                  </button>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70">Progress</span>
                      <span className="text-sm text-white/70">{step === 'email' || step === 'phone' ? '1' : step === 'password' ? '2' : '3'}/3</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: step === 'otp' ? '100%' : step === 'password' ? '66%' : '33%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center text-red-100 animate-pulse backdrop-blur-sm">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Email form */}
              {step === 'email' && (
                <form onSubmit={(e) => { e.preventDefault(); setStep('password'); }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                        type="email"
                        className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm group-hover:bg-white/15"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white py-4 rounded-2xl font-semibold shadow-2xl hover:from-purple-700 hover:via-pink-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                    Continue
                  </button>
                </form>
              )}

              {/* Phone form */}
              {step === 'phone' && (
                <form onSubmit={(e) => { e.preventDefault(); setStep('password'); }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">Phone Number</label>
                    <div className="flex gap-2">
                      {/* Country Code Selector */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="h-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white flex items-center gap-2 hover:bg-white/15 transition-all duration-300 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[120px]"
                        >
                          <span className="text-xl">{countryCodes[countryCode]?.flag || '🌍'}</span>
                          <span className="text-sm font-medium">{countryCode}</span>
                          <svg className={`w-4 h-4 transition-transform duration-200 ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Country Code Dropdown */}
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto bg-gray-900/95 backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl z-50 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-gray-800/50">
                            {Object.entries(countryCodes).map(([code, info]) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() => {
                                  setCountryCode(code);
                                  setShowCountryDropdown(false);
                                }}
                                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-purple-600/30 transition-colors ${
                                  countryCode === code ? 'bg-purple-600/40' : ''
                                }`}
                              >
                                <span className="text-xl">{info.flag}</span>
                                <span className="text-sm text-white flex-1">{info.name}</span>
                                <span className="text-sm text-purple-200 font-mono">{code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Phone Number Input */}
                      <div className="relative group flex-1">
                        <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5 z-10" />
                        <input
                          type="tel"
                          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm group-hover:bg-white/15"
                          placeholder="712345678"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Validation Messages */}
                    {countryInfo && phoneNumber && validatePhoneNumber(phoneNumber) && (
                      <div className="mt-2 text-xs text-green-300 flex items-center bg-green-500/10 px-3 py-2 rounded-xl border border-green-400/30">
                        <Check className="w-4 h-4 mr-2" />
                        <span>Valid number from {countryInfo.name}: <strong>{phone}</strong></span>
                      </div>
                    )}
                    {phoneNumber && !validatePhoneNumber(phoneNumber) && (
                      <div className="mt-2 text-xs text-yellow-300 bg-yellow-500/10 px-3 py-2 rounded-xl border border-yellow-400/30">
                        Phone number should be 7-15 digits
                      </div>
                    )}
                    <div className="mt-2 text-xs text-white/60">
                      Select your country code and enter your phone number
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!phoneNumber || !validatePhoneNumber(phoneNumber)}
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white py-4 rounded-2xl font-semibold shadow-2xl hover:from-purple-700 hover:via-pink-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                    Continue
                  </button>
                </form>
              )}

              {/* Password form */}
              {step === 'password' && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Display selected method info */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      {method === 'email' ? 'Email' : 'Phone Number'}
                    </label>
                    <div className="relative group">
                      {method === 'email' ? (
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      ) : (
                        <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      )}
                      <input
                        type={method === 'email' ? 'email' : 'tel'}
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/70 cursor-not-allowed"
                        value={method === 'email' ? email : phone}
                        disabled
                        readOnly
                        placeholder={method === 'email' ? 'Your email address' : 'Your phone number'}
                        title={method === 'email' ? 'Email address' : 'Phone number'}
                      />
                      {method === 'phone' && countryInfo && (
                        <div className="absolute right-4 top-1/2 flex items-center space-x-2 transform -translate-y-1/2">
                          <span className="text-sm">{countryInfo.flag}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Password
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm group-hover:bg-white/15"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {/* Password strength indicator */}
                    {password && (
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/70">Password strength:</span>
                          <span className={`text-sm font-bold ${passwordScore <= 2 ? 'text-red-300' : passwordScore <= 3 ? 'text-yellow-300' : 'text-green-300'}`}>
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full bg-gradient-to-r ${getPasswordStrengthColor()} transition-all duration-500 shadow-lg`}
                            style={{ width: `${(passwordScore / 5) * 100}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { check: passwordChecks.length, text: '8+ characters' },
                            { check: passwordChecks.uppercase, text: 'Uppercase' },
                            { check: passwordChecks.lowercase, text: 'Lowercase' },
                            { check: passwordChecks.number, text: 'Number' },
                            { check: passwordChecks.special, text: 'Special char' }
                          ].map((item, index) => (
                            <div key={index} className="flex items-center text-xs">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 transition-all duration-300 ${item.check ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                                {item.check && <Check className="w-2 h-2 text-white" />}
                              </div>
                              <span className={`transition-colors duration-300 ${item.check ? 'text-green-300' : 'text-white/50'}`}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Confirm Password
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm group-hover:bg-white/15"
                          placeholder="Confirm your password"
                          title="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {/* Password match indicator */}
                    {confirmPassword && (
                      <div className="flex items-center text-sm mt-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 transition-all duration-300 ${password === confirmPassword ? 'bg-green-500 border-green-500' : 'bg-red-500 border-red-500'}`}>
                          <Check className="w-2 h-2 text-white" />
                        </div>
                        <span className={`transition-colors duration-300 ${password === confirmPassword ? 'text-green-300' : 'text-red-300'}`}>
                          {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Terms and conditions */}
                  <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <input
                      type="checkbox"
                      id="terms"
                      className="mt-1 w-5 h-5 text-purple-600 bg-white/10 border border-white/20 rounded focus:ring-purple-500 focus:ring-2"
                      required
                      title="Agree to Terms and Privacy Policy"
                      placeholder="Agree to Terms and Privacy Policy"
                    />
                    <label htmlFor="terms" className="text-sm text-white/80 leading-relaxed">
                      I agree to the{' '}
                      <a href="#" className="text-purple-300 hover:text-purple-200 transition-colors underline">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="#" className="text-purple-300 hover:text-purple-200 transition-colors underline">
                        Privacy Policy
                      </a>
                    </label>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white py-4 rounded-2xl font-semibold shadow-2xl hover:from-purple-700 hover:via-pink-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                        Creating Magic...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Sparkles className="w-5 h-5 mr-2" />
                        Create Account
                      </div>
                    )}
                  </button>
                </form>
              )}

              {/* OTP form */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Enter OTP
                    </label>
                    <div className="relative group">
                      <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                          type="text"
                          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm group-hover:bg-white/15 text-center text-2xl tracking-widest font-mono"
                          placeholder="000000"
                          title="OTP input"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          required
                        />
                    </div>
                    <p className="text-white/60 text-sm text-center">
                      A verification code has been sent to {method === 'email' ? email : phone}
                    </p>
                  </div>

                  {/* Resend OTP Feedback */}
                  {resendFeedback.message && (
                    <div className={`p-4 rounded-2xl flex items-center animate-pulse backdrop-blur-sm ${
                      resendFeedback.type === 'success' 
                        ? 'bg-green-500/20 border border-green-500/30 text-green-100' 
                        : 'bg-red-500/20 border border-red-500/30 text-red-100'
                    }`}>
                      {resendFeedback.type === 'success' ? (
                        <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                      )}
                      <span className="text-sm">{resendFeedback.message}</span>
                    </div>
                  )}

                  {/* Resend OTP Button */}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendLoading || resendCooldown > 0}
                      className="text-sm text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {resendLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin"></div>
                          <span>Sending...</span>
                        </>
                      ) : resendCooldown > 0 ? (
                        <>
                          <span>Resend OTP in {resendCooldown}s</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Resend OTP</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otp.length !== 6}
                    className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-4 rounded-2xl font-semibold shadow-2xl hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                    {otpLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                        Verifying...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Check className="w-5 h-5 mr-2" />
                        Verify & Create Account
                      </div>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Sign in link */}
            <div className="mt-8 text-center">
              <p className="text-white/80">
                Already have an account?{' '}
                <a href="/login" className="text-purple-300 hover:text-purple-200 font-semibold transition-colors relative group">
                  Sign in
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-300 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
