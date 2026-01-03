import Link from "next/link";

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small agencies getting started",
      price: 49,
      period: "/month",
      features: [
        "Up to 3 clients",
        "Instantly integration",
        "Client portal access",
        "Basic analytics",
        "Email support",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Growth",
      description: "For growing agencies with more clients",
      price: 99,
      period: "/month",
      features: [
        "Up to 10 clients",
        "Instantly + Smartlead integration",
        "White-label client portals",
        "Advanced analytics & reports",
        "Custom domain support",
        "Priority email support",
        "Team collaboration (3 seats)",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Agency",
      description: "For established agencies at scale",
      price: 249,
      period: "/month",
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
      cta: "Start Free Trial",
      popular: false,
    },
  ];

  const faqs = [
    {
      question: "What happens after my 14-day trial?",
      answer: "After your trial ends, you can choose a plan that fits your needs. If you don't upgrade, your account will be paused but your data will be saved for 30 days.",
    },
    {
      question: "Can I change plans later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle, and we'll prorate any differences.",
    },
    {
      question: "What integrations are supported?",
      answer: "We currently support Instantly, Smartlead, and Apollo. More integrations are coming soon. All plans include at least one integration.",
    },
    {
      question: "Is there a setup fee?",
      answer: "No setup fees. Just sign up, connect your email tools, and you're ready to go. Our Agency plan includes complimentary onboarding support.",
    },
    {
      question: "Do you offer annual billing?",
      answer: "Yes! Pay annually and get 2 months free. That's a 17% discount on all plans. Contact us after signing up to switch to annual billing.",
    },
    {
      question: "What if I need more than what's listed?",
      answer: "We offer custom Enterprise plans for large agencies with specific requirements. Contact us to discuss your needs.",
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050508] via-[#0a1628] to-[#050508]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 rounded-full blur-[150px]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
            <span className="text-sm text-blue-300 font-medium">Simple, transparent pricing</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Plans that scale with your agency
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Start free for 14 days. No credit card required. Upgrade when you&apos;re ready.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
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
                    <span className="text-zinc-500">{plan.period}</span>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${
                    plan.popular
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise callout */}
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-zinc-900/50 to-zinc-800/30 border border-white/5">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold mb-2">Need something custom?</h3>
                <p className="text-zinc-400">
                  Enterprise plans with custom integrations, SLA guarantees, and dedicated support.
                </p>
              </div>
              <a
                href="mailto:hello@blue-reach.com"
                className="flex-shrink-0 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold text-white transition-all"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 lg:py-28 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">Compare plans</h2>
            <p className="text-zinc-400">See what&apos;s included in each plan</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-sm font-medium text-zinc-400">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-zinc-400">Starter</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-blue-400">Growth</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-zinc-400">Agency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { feature: "Clients", starter: "3", growth: "10", agency: "Unlimited" },
                  { feature: "Team seats", starter: "1", growth: "3", agency: "Unlimited" },
                  { feature: "Instantly integration", starter: true, growth: true, agency: true },
                  { feature: "Smartlead integration", starter: false, growth: true, agency: true },
                  { feature: "Apollo integration", starter: false, growth: false, agency: true },
                  { feature: "Client portals", starter: true, growth: true, agency: true },
                  { feature: "White-label branding", starter: false, growth: true, agency: true },
                  { feature: "Custom domain", starter: false, growth: true, agency: true },
                  { feature: "Advanced analytics", starter: false, growth: true, agency: true },
                  { feature: "API access", starter: false, growth: false, agency: true },
                  { feature: "Priority support", starter: false, growth: true, agency: true },
                  { feature: "Custom onboarding", starter: false, growth: false, agency: true },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="py-4 px-4 text-sm text-zinc-300">{row.feature}</td>
                    {[row.starter, row.growth, row.agency].map((value, j) => (
                      <td key={j} className="py-4 px-4 text-center">
                        {typeof value === "boolean" ? (
                          value ? (
                            <svg className="w-5 h-5 text-emerald-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )
                        ) : (
                          <span className="text-sm text-zinc-300">{value}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">Frequently asked questions</h2>
            <p className="text-zinc-400">Everything you need to know about pricing</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/5"
              >
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 relative overflow-hidden bg-zinc-900/30">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-600/10" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Start your free trial today
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            14 days free. No credit card required. Cancel anytime.
          </p>
          <Link
            href="/login"
            className="inline-flex px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
