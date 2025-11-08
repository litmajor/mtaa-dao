import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, UserPlus, Check, Phone, Send } from 'lucide-react';
import { signIn } from '../lib/auth';

export default function ArchitectSetup() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

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
    if (!emailOrPhone || !password || !confirmPassword) {
      setError('All fields are required.');
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    if (passwordScore < 3) {
      setError('Password is too weak. Please include at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.');
      setIsLoading(false);
      return;
    }

    // Check if email or phone is valid
    const isEmail = /\S+@\S+\.\S+/.test(emailOrPhone);
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
    if (!isEmail && !isPhone) {
      setError('Invalid email or phone number.');
      setIsLoading(false);
      return;
    }

    // Sign in or register based on input
    try {
      let resp;
      if (isEmail) {
        // Email registration
        resp = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOrPhone, password }),
        });
      } else {
        // Phone registration
        resp = await fetch('/api/auth/register-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: emailOrPhone, password }),
        });
      }
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Registration failed');
      setOtpSent(true);
    } catch (err) {
      setError(
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message?: string }).message || 'Registration failed'
          : 'Registration failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setOtpLoading(true);
    try {
      // Determine payload type
      const isEmail = /\S+@\S+\.\S+/.test(emailOrPhone);
      const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
      const payload = isEmail
        ? { email: emailOrPhone, otp }
        : isPhone
        ? { phone: emailOrPhone, otp }
        : { emailOrPhone, otp };
      const resp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'OTP verification failed');
  // Auto sign in after registration
  localStorage.setItem('accessToken', data.token);
  localStorage.setItem('superuser', 'true');
  window.location.href = '/superuser';
    } catch (err) {
      setError(
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message?: string }).message || 'OTP verification failed'
          : 'OTP verification failed'
      );
    } finally {
      setOtpLoading(false);
    }
  };
  // Resend OTP logic
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setResendFeedback({ type: '', message: '' });
    setError('');
    try {
      const isEmail = /\S+@\S+\.\S+/.test(emailOrPhone);
      const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
      const payload = isEmail
        ? { email: emailOrPhone }
        : isPhone
        ? { phone: emailOrPhone }
        : { emailOrPhone };
      const resp = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to resend OTP');
      setResendFeedback({ type: 'success', message: `OTP sent successfully to your ${isEmail ? 'email' : 'phone'}!` });
      setResendCooldown(60);
      setTimeout(() => setResendFeedback({ type: '', message: '' }), 5000);
    } catch (err: any) {
      setResendFeedback({ type: 'error', message: err.message || 'Failed to resend OTP. Please try again.' });
      setTimeout(() => setResendFeedback({ type: '', message: '' }), 5000);
    } finally {
      setResendLoading(false);
    }
  };

  // Cooldown timer for resend OTP
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // For admin login
  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setAdminLoading(true);
    try {
      const resp = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      let data;
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await resp.json();
      } else {
        // Not JSON, likely an error page or misconfigured backend
        setError('Unexpected server response. Please try again or contact support.');
        setAdminLoading(false);
        return;
      }
      if (!resp.ok) throw new Error(data.message || 'Admin login failed');
  localStorage.setItem('accessToken', data.accessToken || data.token);
  localStorage.setItem('superuser', 'true');
  window.location.href = '/superuser';
    } catch (err) {
      setError(
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message?: string }).message || 'Admin login failed'
          : 'Admin login failed'
      );
    } finally {
      setAdminLoading(false);
    }
  };

  function getPasswordStrengthText(): React.ReactNode {
    if (!password) return '';
    switch (passwordScore) {
      case 5:
        return 'Very strong';
      case 4:
        return 'Strong';
      case 3:
        return 'Medium';
      case 2:
        return 'Weak';
      default:
        return 'Very weak';
    }
  }

  function getPasswordStrengthColor(): string {
    switch (passwordScore) {
      case 5:
        return 'from-green-400 to-green-600';
      case 4:
        return 'from-green-300 to-green-500';
      case 3:
        return 'from-yellow-300 to-yellow-500';
      case 2:
        return 'from-orange-300 to-orange-500';
      default:
        return 'from-red-400 to-red-600';
    }
  }

  return (
    <div className="bg-gradient-to-br from-mtaa-orange via-mtaa-emerald to-mtaa-terra min-h-screen w-full p-4">
      <div className="overflow-hidden">
        <div className="fixed -top-40 -right-40 w-80 h-80 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-emerald-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="fixed top-40 left-40 w-80 h-80 bg-terra-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="bg-white/20 dark:bg-black/30 border border-white/20 backdrop-blur rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-mtaa-orange to-mtaa-emerald rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Superuser/Admin {adminMode ? 'Login' : 'Creation'}</h2>
            <p className="text-white/80 mb-6">{adminMode ? 'Sign in as app owner/admin' : 'Create a new superuser account'}</p>
            <button
              type="button"
              className="text-xs text-mtaa-orange hover:text-mtaa-emerald underline font-semibold transition-colors"
              onClick={() => {
                setAdminMode(!adminMode);
                setError('');
              }}
            >
              {adminMode ? 'Back to Registration' : 'Admin Login'}
            </button>
          </div>
          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center text-red-100 animate-pulse">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {/* Superuser login form */}
          {adminMode ? (
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">Admin Email</label>
                <input
                  type="email"
                  className="w-full pl-4 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-mtaa-orange focus:border-transparent transition-all duration-200"
                  placeholder="Enter admin email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">Admin Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-gradient-to-r from-mtaa-orange to-mtaa-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:from-mtaa-orange/90 hover:to-mtaa-emerald/90 focus:outline-none focus:ring-2 focus:ring-mtaa-orange focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {adminLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Logging in...
                  </div>
                ) : (
                  'Login as Superuser/Admin'
                )}
              </button>
            </form>
          ) : (
            // Registration form
            <>
              {/* OTP Step */}
              {otpSent ? (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Enter the OTP sent to your {emailOrPhone.includes('@') ? 'email' : 'phone'}
                    </label>
                    <input
                      type="text"
                      className="w-full pl-4 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-mtaa-orange focus:border-transparent transition-all duration-200"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      required
                    />
                  </div>
                  {/* Resend OTP Feedback */}
                  {resendFeedback.message && (
                    <div className={`mb-2 p-3 rounded-lg flex items-center animate-pulse backdrop-blur-sm ${
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
                  <div className="flex items-center justify-center mb-2">
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
                    disabled={otpLoading}
                    className="w-full bg-gradient-to-r from-mtaa-orange to-mtaa-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:from-mtaa-orange/90 hover:to-mtaa-emerald/90 focus:outline-none focus:ring-2 focus:ring-mtaa-orange focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {otpLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Verifying OTP...
                      </div>
                    ) : (
                      'Verify OTP & Create Account'
                    )}
                  </button>
                </form>
              ) : (
// ...existing code...
                <>
                  {/* Email/Phone field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Email or Phone Number
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <Phone className="absolute left-9 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                        type="text"
                        className="w-full pl-16 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-mtaa-orange focus:border-transparent transition-all duration-200"
                        placeholder="Enter your email or phone number"
                        value={emailOrPhone}
                        onChange={(e) => setEmailOrPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/90">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {/* Password strength indicator */}
                    {password && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/70">Password strength:</span>
                          <span className={`text-xs font-medium ${passwordScore <= 2 ? 'text-red-300' : passwordScore <= 3 ? 'text-yellow-300' : 'text-green-300'}`}>
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full bg-gradient-to-r ${getPasswordStrengthColor()} transition-all duration-300`}
                            style={{ width: `${(passwordScore / 5) * 100}%` }}
                          ></div>
                        </div>
                        <div className="space-y-1">
                          {[
                            { check: passwordChecks.length, text: 'At least 8 characters' },
                            { check: passwordChecks.uppercase, text: 'One uppercase letter' },
                            { check: passwordChecks.lowercase, text: 'One lowercase letter' },
                            { check: passwordChecks.number, text: 'One number' },
                            { check: passwordChecks.special, text: 'One special character' }
                          ].map((item, index) => (
                            <div key={index} className="flex items-center text-xs">
                              <Check className={`w-3 h-3 mr-2 ${item.check ? 'text-green-400' : 'text-white/30'}`} />
                              <span className={item.check ? 'text-green-300' : 'text-white/50'}>
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
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {/* Password match indicator */}
                    {confirmPassword && (
                      <div className="flex items-center text-xs">
                        <Check className={`w-3 h-3 mr-2 ${password === confirmPassword ? 'text-green-400' : 'text-red-400'}`} />
                        <span className={password === confirmPassword ? 'text-green-300' : 'text-red-300'}>
                          {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Terms and conditions */}
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-emerald-600 bg-white/10 border border-white/20 rounded focus:ring-emerald-500 focus:ring-2"
                      required
                      title="Agree to Terms and Privacy Policy"
                      placeholder="Agree to Terms and Privacy Policy"
                    />
                    <label className="text-sm text-white/80 leading-5">
                      I agree to the{' '}
                      <a href="#" className="text-emerald-300 hover:text-emerald-200 transition-colors">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="#" className="text-emerald-300 hover:text-emerald-200 transition-colors">
                        Privacy Policy
                      </a>
                    </label>
                  </div>

                  {/* Submit button */}
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white py-3 rounded-xl font-semibold shadow-lg border-0 focus:ring-4 focus:ring-orange-400 dark:focus:ring-orange-600 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Sending OTP...
                        </div>
                      ) : (
                        'Create Account'
                      )}
                    </button>
                  </form>
                </>
              )}
              {/* End of OTP Step */}
              {/* Sign in link */}
              <div className="mt-8 text-center">
                <p className="text-white/80">
                  Already have an account?{' '}
                  <a href="/login" className="text-mtaa-orange hover:text-mtaa-emerald font-semibold transition-colors">
                    Sign in
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}