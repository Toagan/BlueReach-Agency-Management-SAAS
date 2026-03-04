"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    description: "Perfect for small agencies getting started",
    price: 49,
    features: [
      "Up to 3 clients",
      "Instantly integration",
      "Client portal access",
      "Basic analytics",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "growth" as const,
    name: "Growth",
    description: "For growing agencies with more clients",
    price: 99,
    features: [
      "Up to 10 clients",
      "Instantly + Smartlead integration",
      "White-label client portals",
      "Advanced analytics & reports",
      "Custom domain support",
      "Priority email support",
      "Team collaboration (3 seats)",
    ],
    popular: true,
  },
  {
    id: "agency" as const,
    name: "Agency",
    description: "For established agencies at scale",
    price: 249,
    features: [
      "Unlimited clients",
      "All provider integrations",
      "White-label everything",
      "Advanced analytics & API access",
      "Custom domain + SSL",
      "Dedicated support",
      "Unlimited team seats",
      "Custom onboarding",
    ],
    popular: false,
  },
];

export default function ChoosePlanPage() {
  return (
    <Suspense>
      <ChoosePlanContent />
    </Suspense>
  );
}

function ChoosePlanContent() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("checkout") === "canceled";
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelectPlan(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
        setLoading(null);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-3xl">🌊</span>
            <span className="text-2xl font-bold">
              Blue<span className="text-white">Reach</span>
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto">
            Start your 14-day free trial. Cancel anytime.
          </p>
          {canceled && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-300">
              Checkout was canceled. Choose a plan to try again.
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? "bg-gradient-to-b from-blue-500/10 to-transparent border-2 border-blue-500/30"
                  : "bg-white/[0.02] border border-white/5"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full text-xs font-semibold text-white shadow-lg shadow-blue-500/30">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-zinc-400">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-zinc-500">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <svg
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        plan.popular ? "text-blue-400" : "text-emerald-400"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading !== null}
                className={`block w-full py-3 rounded-xl font-semibold text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                    : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                }`}
              >
                {loading === plan.id ? "Redirecting..." : "Start Free Trial"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
