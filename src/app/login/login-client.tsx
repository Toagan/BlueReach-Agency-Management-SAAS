"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginClient() {
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
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
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
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#050508] overflow-hidden">
      {/* Left Panel - Client-focused Value Prop */}
      <div className="hidden lg:flex lg:w-[58%] relative">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#050508] via-[#0a1628] to-[#050508]" />

        {/* Animated orbs */}
        <div className="absolute top-20 -left-20 w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[130px] animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-indigo-500/15 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Floating elements */}
        <div className="absolute top-32 right-32 w-20 h-20 border border-blue-500/20 rounded-2xl rotate-12 animate-float" />
        <div className="absolute bottom-40 left-40 w-16 h-16 border border-cyan-500/20 rounded-xl -rotate-12 animate-float [animation-delay:1s]" />
        <div className="absolute top-1/2 right-20 w-3 h-3 bg-blue-400/40 rounded-full animate-float [animation-delay:0.5s]" />
        <div className="absolute top-40 left-1/3 w-2 h-2 bg-cyan-400/40 rounded-full animate-float [animation-delay:1.5s]" />

        {/* Right edge glow line */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/30 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-105">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Blue Reach</span>
          </div>

          {/* Main Content */}
          <div className="space-y-12 max-w-xl">
            {/* Headline */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-emerald-300 font-medium">Your client portal is ready</span>
              </div>

              <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.08] tracking-tight">
                See your outreach
                <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                  results in real-time
                </span>
              </h1>

              <p className="text-xl text-zinc-400 leading-relaxed max-w-lg">
                Track your email campaigns, monitor lead responses, and see your pipeline grow. Full transparency into your outbound performance.
              </p>
            </div>

            {/* Value Props */}
            <div className="flex items-center gap-6 xl:gap-10">
              {[
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Live updates" },
                { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Full visibility" },
                { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "Secure access" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Feature Cards - Client focused */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                  title: "Campaign Performance",
                  desc: "Emails sent, opened & replied",
                  color: "blue"
                },
                {
                  icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
                  title: "Lead Responses",
                  desc: "Track interested prospects",
                  color: "cyan"
                },
                {
                  icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                  title: "Meetings Booked",
                  desc: "See your calendar fill up",
                  color: "indigo"
                },
                {
                  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                  title: "Pipeline Value",
                  desc: "Track your deal progress",
                  color: "emerald"
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                    feature.color === 'blue' ? 'from-blue-500/20 to-blue-600/10' :
                    feature.color === 'cyan' ? 'from-cyan-500/20 to-cyan-600/10' :
                    feature.color === 'indigo' ? 'from-indigo-500/20 to-indigo-600/10' :
                    'from-emerald-500/20 to-emerald-600/10'
                  } flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <svg className={`w-5 h-5 ${
                      feature.color === 'blue' ? 'text-blue-400' :
                      feature.color === 'cyan' ? 'text-cyan-400' :
                      feature.color === 'indigo' ? 'text-indigo-400' :
                      'text-emerald-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="text-zinc-600 text-sm">
              Powered by Blue Reach
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-600">
              <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-6 sm:p-8 relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/80 via-[#0a0a10] to-[#050508]" />

        {/* Subtle glow */}
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px]" />

        {/* Left border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-700/50 to-transparent hidden lg:block" />

        <div className="relative z-10 w-full max-w-[380px] space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Blue Reach</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {inviteToken ? "You're invited!" : "Welcome back"}
            </h2>
            <p className="text-zinc-400 text-lg">
              {inviteToken
                ? "Sign in to access your outreach dashboard"
                : "Sign in to view your campaign results"
              }
            </p>
          </div>

          {/* Invite Banner */}
          {inviteToken && (
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent animate-shimmer" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">Your dashboard is ready</p>
                  <p className="text-sm text-zinc-400">Sign in to see your campaign performance</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {message && message.type === "error" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 relative">
              <button
                onClick={() => setMessage(null)}
                className="absolute top-3 right-3 p-1 text-amber-400/60 hover:text-amber-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-300">Sign in interrupted</p>
                  <p className="text-sm text-amber-200/70 mt-1">
                    {message.text === "Could not authenticate"
                      ? "The sign-in was cancelled or timed out. Please try again."
                      : message.text
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Buttons */}
          <div className="space-y-4">
            {/* Google Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loadingProvider !== null}
              className="group w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-zinc-50 rounded-2xl font-semibold text-zinc-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/25 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 active:translate-y-0 active:shadow-lg"
            >
              {loadingProvider === "google" ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              <span className="text-xs text-zinc-600 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            </div>

            {/* Microsoft Button */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loadingProvider !== null}
              className="group w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-2xl font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700/50 hover:border-zinc-600 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              {loadingProvider === "azure" ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 23 23">
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
          <div className="pt-6 space-y-5">
            {/* Security badge */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm text-emerald-400 font-medium">Secure & Encrypted</span>
              </div>
            </div>

            {/* Trust text */}
            <div className="flex items-center justify-center gap-5 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>SSL Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Real-time data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Always up-to-date</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-zinc-600 pt-4">
            <p>
              By signing in, you agree to our{" "}
              <a href="#" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">Privacy Policy</a>
            </p>
          </div>

          {/* Mobile footer */}
          <div className="lg:hidden text-center text-xs text-zinc-600 pt-4">
            Powered by Blue Reach
          </div>
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--rotate, 12deg)); }
          50% { transform: translateY(-20px) rotate(var(--rotate, 12deg)); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
