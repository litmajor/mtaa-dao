import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, UserPlus, Loader, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/utils/authClient';

export default function AdminRegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Password strength checker
  const checkPasswordStrength = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    return checks;
  };

  const passwordChecks = checkPasswordStrength(password);
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const passwordStrength = passwordScore <= 2 ? 'weak' : passwordScore <= 3 ? 'fair' : passwordScore <= 4 ? 'good' : 'strong';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!email || !password || !confirmPassword || !name) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      if (passwordScore < 3) {
        setError('Password is too weak. Please use uppercase, lowercase, numbers, and special characters.');
        setIsLoading(false);
        return;
      }

      if (!agreedToTerms) {
        setError('Please agree to the terms and conditions');
        setIsLoading(false);
        return;
      }

      // Call admin register endpoint
      const data = await authClient.post('/api/admin/auth/superuser-register', {
        email,
        password,
        name,
      });

      if (!response.ok) {
        setError(data.message || 'Registration failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Show success message
      setSuccess('Admin account created successfully! Redirecting to login...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/admin-login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000"></div>
      </div>

      {/* Register Container */}
      <div className="relative w-full max-w-md">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/50 mb-4">
              <UserPlus className="w-6 h-6 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Registration</h1>
            <p className="text-slate-300 text-sm">Create a new admin account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex items-gap-3">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-200">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Admin Name"
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2 mt-3">
                  <div className="flex gap-1">
                    {Array(4)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition ${
                            i < passwordScore
                              ? passwordStrength === 'weak'
                                ? 'bg-red-500'
                                : passwordStrength === 'fair'
                                ? 'bg-yellow-500'
                                : passwordStrength === 'good'
                                ? 'bg-blue-500'
                                : 'bg-green-500'
                              : 'bg-slate-600'
                          }`}
                        />
                      ))}
                  </div>
                  <p className="text-xs text-slate-300">
                    Password strength:{' '}
                    <span
                      className={
                        passwordStrength === 'weak'
                          ? 'text-red-400'
                          : passwordStrength === 'fair'
                          ? 'text-yellow-400'
                          : passwordStrength === 'good'
                          ? 'text-blue-400'
                          : 'text-green-400'
                      }
                    >
                      {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                    </span>
                  </p>

                  {/* Requirements */}
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    {Object.entries(passwordChecks).map(([key, met]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            met ? 'bg-green-500' : 'bg-slate-600'
                          }`}
                        />
                        <span className={met ? 'text-green-400' : 'text-slate-400'}>
                          {key === 'length'
                            ? '8+ chars'
                            : key === 'uppercase'
                            ? 'Uppercase'
                            : key === 'lowercase'
                            ? 'Lowercase'
                            : key === 'number'
                            ? 'Number'
                            : 'Special char'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password === confirmPassword && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Passwords match
                </p>
              )}
            </div>

            {/* Terms & Conditions */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-2 focus:ring-purple-500 mt-0.5"
              />
              <span className="text-slate-300 text-sm">
                I agree to the{' '}
                <a href="#" className="text-purple-400 hover:text-purple-300 transition">
                  Admin Terms & Conditions
                </a>{' '}
                and{' '}
                <a href="#" className="text-purple-400 hover:text-purple-300 transition">
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !agreedToTerms}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Admin Account
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800/40 text-slate-400">Already have an account?</span>
            </div>
          </div>

          {/* Login Link */}
          <button
            onClick={() => navigate('/admin-login')}
            className="w-full py-2.5 px-4 border border-slate-600 hover:border-purple-500 text-slate-300 hover:text-purple-400 font-semibold rounded-lg transition flex items-center justify-center gap-2 bg-slate-700/20 hover:bg-purple-500/10"
          >
            Sign In Instead
          </button>

          {/* Security Note */}
          <p className="text-xs text-slate-400 text-center bg-slate-700/20 rounded-lg p-3">
            🔒 Only authorized administrators can register new admin accounts. Contact your system administrator if you need access.
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <a href="/" className="text-slate-400 hover:text-slate-200 text-sm transition">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
