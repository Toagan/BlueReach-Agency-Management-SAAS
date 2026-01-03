"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const redirectPath = searchParams.get("redirect");
  const errorParam = searchParams.get("error");

  const [loadingProvider, setLoadingProvider] = useState<"google" | "azure" | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getRedirectUrl = () => {
    let redirectUrl = `${window.location.origin}/auth/callback`;
    if (inviteToken) {
      redirectUrl = `${window.location.origin}/auth/accept-invite?token=${inviteToken}`;
    } else if (redirectPath) {
      redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
    }
    return redirectUrl;
  };

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        if (redirectPath) {
          router.push(redirectPath);
        } else {
          router.push("/dashboard");
        }
      } else {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [redirectPath, router]);

  useEffect(() => {
    if (errorParam) {
      setMessage({ type: "error", text: errorParam });
    }
  }, [errorParam]);

  const handleGoogleLogin = async () => {
    setLoadingProvider("google");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoadingProvider(null);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoadingProvider("azure");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: getRedirectUrl(),
        scopes: "email openid profile",
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoadingProvider(null);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0f]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d1829] to-[#0a0a0f]" />

        {/* Glow effects */}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px]" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Gradient line accent */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-semibold text-white tracking-tight">Blue Reach</span>
          </div>

          {/* Main Content */}
          <div className="space-y-10 max-w-lg">
            <div className="space-y-5">
              <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                Your Campaign
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">
                  Performance Hub
                </span>
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Track leads, monitor campaigns, and gain insights into your outreach performance in real-time.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {[
                { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", text: "Real-time Analytics", desc: "Live performance metrics" },
                { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", text: "Lead Management", desc: "Track every opportunity" },
                { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", text: "Campaign Tracking", desc: "Monitor outreach success" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 -ml-3 rounded-xl hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center group-hover:border-blue-500/40 transition-colors">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                    </svg>
                  </div>
                  <div>
                    <span className="text-white font-medium">{feature.text}</span>
                    <p className="text-sm text-zinc-500">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-zinc-600 text-sm">
            Powered by Blue Reach Agency
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-[#0a0a0f]" />

        {/* Border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent hidden lg:block" />

        <div className="relative z-10 w-full max-w-sm space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-semibold text-white tracking-tight">Blue Reach</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {inviteToken ? "Welcome" : "Welcome back"}
            </h2>
            <p className="text-zinc-500">
              {inviteToken
                ? "You've been invited. Sign in to get started."
                : "Sign in to access your dashboard"
              }
            </p>
          </div>

          {/* Invite Banner */}
          {inviteToken && (
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Invitation received</p>
                  <p className="text-sm text-zinc-400">Sign in to continue</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {message && message.type === "error" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-300">{message.text}</p>
              </div>
            </div>
          )}

          {/* Sign In Buttons */}
          <div className="space-y-3">
            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-zinc-100 rounded-2xl font-medium text-zinc-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loadingProvider === "google" ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Microsoft Sign In Button */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2f2f2f] hover:bg-[#3a3a3a] rounded-2xl font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 border border-zinc-700"
            >
              {loadingProvider === "azure" ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Continue with Microsoft</span>
                </>
              )}
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-4 space-y-6">
            <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-600">
              <div className="w-1 h-1 rounded-full bg-emerald-500" />
              <span>Secure sign-in</span>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>SSL Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Privacy Protected</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-zinc-600 pt-8">
            <p>
              By signing in, you agree to our{" "}
              <a href="#" className="text-zinc-400 hover:text-white transition-colors">Terms</a>
              {" "}and{" "}
              <a href="#" className="text-zinc-400 hover:text-white transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
