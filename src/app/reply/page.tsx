"use client";

import { useEffect, useState } from "react";
import { Mail, AlertCircle } from "lucide-react";
import Head from "next/head";

interface TokenData {
  leadEmail: string;
  subject: string;
  body: string;
}

/**
 * Smart reply redirect page.
 *
 * URL: /reply?token=UUID
 *
 * Fetches compose data from server-side token, builds Gmail/Outlook URLs client-side.
 * First visit: shows a choice screen (Gmail vs Outlook).
 * Saves the preference in localStorage so future clicks auto-redirect.
 */
export default function ReplyRedirectPage() {
  const [showManual, setShowManual] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function buildGmailUrl(data: TokenData): string {
    return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(data.leadEmail)}&su=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
  }

  function buildOutlookUrl(data: TokenData): string {
    return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(data.leadEmail)}&subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const token = sp.get("token");

    // ?reset clears saved preference
    if (sp.has("reset")) {
      localStorage.removeItem("bluereach_email_provider");
    }

    if (!token) {
      setError("No reply token provided.");
      setLoading(false);
      return;
    }

    fetch(`/api/reply-tokens/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("expired");
          setLoading(false);
          return;
        }
        const data: TokenData = await res.json();
        setTokenData(data);

        // Check saved preference (skip if resetting)
        if (!sp.has("reset")) {
          const saved = localStorage.getItem("bluereach_email_provider");
          if (saved === "gmail") {
            window.location.href = buildGmailUrl(data);
            return;
          }
          if (saved === "outlook") {
            window.location.href = buildOutlookUrl(data);
            return;
          }
        }

        setShowManual(true);
        setLoading(false);
      })
      .catch(() => {
        setError("expired");
        setLoading(false);
      });
  }, []);

  function chooseProvider(provider: "gmail" | "outlook") {
    if (!tokenData) return;
    localStorage.setItem("bluereach_email_provider", provider);
    window.location.href = provider === "gmail"
      ? buildGmailUrl(tokenData)
      : buildOutlookUrl(tokenData);
  }

  // Expired / error state
  if (error) {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <>
        <Head>
          <meta name="referrer" content="no-referrer" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-5">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Reply Link Expired</h1>
            <p className="text-sm text-gray-500 mb-6">
              This reply link has expired. You can still reply from your dashboard.
            </p>
            <a
              href={`${baseUrl}/admin`}
              className="inline-flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (loading || !showManual) {
    return (
      <>
        <Head>
          <meta name="referrer" content="no-referrer" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-5">
            <Mail className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Reply to Lead</h1>
          <p className="text-sm text-gray-500 mb-1">
            {tokenData?.leadEmail}
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Choose your email app. We&apos;ll remember your choice.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => chooseProvider("gmail")}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors text-sm font-semibold text-gray-800"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path d="M22 6L12 13 2 6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="#4285F4" strokeWidth="2"/>
                <path d="M2 6l10 7" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 6l-10 7" stroke="#34A853" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Open in Gmail
            </button>
            <button
              onClick={() => chooseProvider("outlook")}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm font-semibold text-gray-800"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="#0078D4" strokeWidth="2"/>
                <path d="M2 6l10 7 10-7" stroke="#0078D4" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Open in Outlook
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mt-5">
            Your choice is saved in this browser so future replies open automatically.
            <br />
            <button
              onClick={() => {
                localStorage.removeItem("bluereach_email_provider");
                setShowManual(true);
              }}
              className="text-blue-500 hover:underline mt-1 inline-block"
            >
              Reset preference
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
