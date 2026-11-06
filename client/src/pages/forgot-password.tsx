import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { ArrowLeft, Mail, Phone, CheckCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { authClient } from '@/utils/authClient';

const ForgotPassword = () => {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<"email" | "phone">("email");
  const { toast } = useToast();

  useEffect(() => {
    // Detect if input is email or phone
    const isEmail = emailOrPhone.includes("@");
    setType(isEmail ? "email" : "phone");
  }, [emailOrPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Basic validation
      if (type === "email" && !emailOrPhone.includes("@")) {
        throw new Error("Please enter a valid email address");
      }
      if (type === "phone" && !/^\+?[\d\s-]{10,}$/.test(emailOrPhone)) {
        throw new Error("Please enter a valid phone number");
      }

      // Request a code without revealing whether the account exists.
      await authClient.post("/api/auth/send-otp", {
        [type]: emailOrPhone,
      });

      setSent(true);
      toast(`If an account matches those details, a reset code has been sent.`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      toast(`Error: ${err.message || "Failed to send reset code"}`);
    }
    finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!/^\d{6}$/.test(otp)) {
        throw new Error("Enter the six-digit reset code.");
      }
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }

      await authClient.post("/api/auth/reset-password", {
        [type]: emailOrPhone,
        otp,
        newPassword,
      });
      setResetComplete(true);
      toast("Your password has been reset.");
    } catch (err: any) {
      setError(err.message || "Could not reset your password.");
      toast(`Error: ${err.message || "Could not reset your password"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="relative w-full max-w-md">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 animate-pulse rounded-2xl"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] rounded-2xl"></div>

        <div className="relative w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
          <Link to="/login" className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <h1 className="text-3xl font-black text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
            Reset Password
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Don't worry, we'll help you recover your account.
          </p>

          {resetComplete ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Password Reset</h2>
              <p className="text-gray-400">Your password has been updated. You can now sign in.</p>
              <Link to="/login">
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Enter Reset Code</h2>
              <p className="text-gray-400">
                If an account matches those details, a six-digit code was sent to your {type}.
              </p>
              <form onSubmit={handleReset} className="space-y-4 text-left">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">Six-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">New password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white"
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <Button type="submit" className="w-full text-white" disabled={isLoading}>
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
              <Button variant="ghost" className="w-full text-gray-300" onClick={() => setSent(false)} disabled={isLoading}>
                Send another code
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Email or Phone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {type === "email" ? (
                      <Mail className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Phone className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <input
                    type={type === "email" ? "email" : "tel"}
                    value={emailOrPhone}
                    onChange={e => setEmailOrPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400 transition-all duration-200"
                    placeholder={type === "email" ? "Enter your email" : "Enter your phone number"}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Send Reset Code</span>
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default ForgotPassword;