"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

/**
 * Smart reply redirect page.
 *
 * URL: /reply?gmail=ENCODED_GMAIL_URL&outlook=ENCODED_OUTLOOK_URL&to=EMAIL
 *
 * First visit: shows a choice screen (Gmail vs Outlook).
 * Saves the preference in localStorage so future clicks auto-redirect.
 */
export default function ReplyRedirectPage() {
  const [showManual, setShowManual] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [urls, setUrls] = useState<{ gmail: string; outlook: string } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const gmail = sp.get("gmail") || "";
    const outlook = sp.get("outlook") || "";
    const to = sp.get("to") || "";

    // ?reset clears saved preference
    if (sp.has("reset")) {
      localStorage.removeItem("bluereach_email_provider");
    }

    setLeadEmail(to);
    setUrls({ gmail, outlook });

    // Check saved preference (skip if resetting)
    if (!sp.has("reset")) {
      const saved = localStorage.getItem("bluereach_email_provider");
      if (saved === "gmail" && gmail) {
        window.location.href = gmail;
        return;
      }
      if (saved === "outlook" && outlook) {
        window.location.href = outlook;
        return;
      }
    }

    setShowManual(true);
  }, []);

  function chooseProvider(provider: "gmail" | "outlook") {
    if (!urls) return;
    localStorage.setItem("bluereach_email_provider", provider);
    window.location.href = provider === "gmail" ? urls.gmail : urls.outlook;
  }

  if (!showManual) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-5">
          <Mail className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Reply to Lead</h1>
        <p className="text-sm text-gray-500 mb-1">
          {leadEmail}
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Choose your email app. We'll remember your choice.
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
  );
}
