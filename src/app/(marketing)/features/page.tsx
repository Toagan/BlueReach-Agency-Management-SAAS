import Link from "next/link";

export default function FeaturesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#050508] via-[#0a1628] to-[#050508]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[150px]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
              <span className="text-sm text-blue-300 font-medium">Features</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
              Everything your agency needs to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                scale
              </span>
            </h1>
            <p className="text-xl text-zinc-400 leading-relaxed">
              From client portals to analytics, Blue Reach gives you the tools to manage more clients with less effort.
            </p>
          </div>
        </div>
      </section>

      {/* Client Portals Feature */}
      <section className="py-20 lg:py-28 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
                <div className="w-2 h-2 bg-blue-400 rounded-full" />
                <span className="text-xs text-blue-300 font-medium uppercase tracking-wider">Client Portals</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Give each client their own dashboard
              </h2>
              <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                Stop sending weekly reports. Give your clients 24/7 access to their campaign data with branded dashboards that make you look professional.
              </p>
              <ul className="space-y-4">
                {[
                  "White-label with your logo and colors",
                  "Custom domain support (reports.youragency.com)",
                  "Role-based access for client teams",
                  "Manage unlimited clients from one account",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-white/5 p-6 overflow-hidden">
                {/* Mock dashboard UI */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl" />
                    <div>
                      <div className="h-3 w-24 bg-white/10 rounded" />
                      <div className="h-2 w-16 bg-white/5 rounded mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Sent", value: "12,847" },
                      { label: "Opened", value: "4,291" },
                      { label: "Replied", value: "342" },
                    ].map((stat, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/5">
                        <div className="text-xs text-zinc-500 mb-1">{stat.label}</div>
                        <div className="text-lg font-semibold text-white">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-24 rounded-xl bg-white/5 flex items-end gap-1 p-3">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t opacity-60"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Feature */}
      <section className="py-20 lg:py-28 border-b border-white/5 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-white/5 p-6 overflow-hidden">
                {/* Mock analytics UI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-32 bg-white/10 rounded" />
                    <div className="flex gap-2">
                      {["7D", "30D", "90D"].map((period, i) => (
                        <div
                          key={period}
                          className={`px-2 py-1 text-xs rounded ${i === 1 ? "bg-blue-500/20 text-blue-300" : "text-zinc-500"}`}
                        >
                          {period}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Open Rate", value: "33.4%", trend: "+2.1%" },
                      { label: "Reply Rate", value: "2.66%", trend: "+0.3%" },
                      { label: "Meetings", value: "47", trend: "+12" },
                      { label: "Pipeline", value: "$124k", trend: "+$18k" },
                    ].map((metric, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/5">
                        <div className="text-xs text-zinc-500 mb-1">{metric.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-semibold text-white">{metric.value}</span>
                          <span className="text-xs text-emerald-400">{metric.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {["Instantly", "Smartlead"].map((provider, i) => (
                      <div key={i} className="flex-1 p-2 rounded-lg bg-white/5 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-blue-400" : "bg-emerald-400"}`} />
                        <span className="text-xs text-zinc-400">{provider}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 bg-cyan-500/10 rounded-3xl blur-2xl -z-10" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-4">
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <span className="text-xs text-cyan-300 font-medium uppercase tracking-wider">Analytics</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Real-time campaign insights
              </h2>
              <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                See exactly how campaigns are performing with real-time analytics. Track opens, replies, meetings booked, and revenue generated.
              </p>
              <ul className="space-y-4">
                {[
                  "Live data synced from Instantly & Smartlead",
                  "Open rates, reply rates, and conversion tracking",
                  "Meeting and pipeline attribution",
                  "Historical trends and comparison reports",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Management Feature */}
      <section className="py-20 lg:py-28 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-xs text-emerald-300 font-medium uppercase tracking-wider">Lead Management</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Move leads through your pipeline
              </h2>
              <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                Track every lead from first contact to closed deal. Our visual pipeline makes it easy to see where every opportunity stands.
              </p>
              <ul className="space-y-4">
                {[
                  "Visual Kanban-style lead workflow",
                  "Custom status stages that match your process",
                  "Meeting scheduling and outcome tracking",
                  "Notes, activities, and full email history",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-white/5 p-6 overflow-hidden">
                {/* Mock pipeline UI */}
                <div className="flex gap-3 h-full">
                  {[
                    { status: "Replied", color: "blue", count: 24 },
                    { status: "Meeting", color: "amber", count: 8 },
                    { status: "Won", color: "emerald", count: 12 },
                  ].map((column, i) => (
                    <div key={i} className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full bg-${column.color}-400`} />
                          <span className="text-xs text-zinc-400">{column.status}</span>
                        </div>
                        <span className="text-xs text-zinc-500">{column.count}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className="p-2 rounded-lg bg-white/5">
                            <div className="h-2 w-16 bg-white/10 rounded mb-1.5" />
                            <div className="h-1.5 w-12 bg-white/5 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-20 lg:py-28 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              And so much more
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Blue Reach is packed with features to help you run a more efficient agency.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                title: "Email Provider Sync",
                description: "Connect Instantly, Smartlead, Apollo, and more. All your data in one unified dashboard.",
              },
              {
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                title: "Secure & Private",
                description: "Your data stays yours. Row-level security ensures clients only see their own campaigns.",
              },
              {
                icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
                title: "Smart Notifications",
                description: "Get instant alerts when leads reply or book meetings. Never miss an opportunity.",
              },
              {
                icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
                title: "Custom Workflows",
                description: "Define your own lead stages that match your exact process. Flexibility built in.",
              },
              {
                icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                title: "Export & Reports",
                description: "Download data as CSV for custom analysis. Generate reports for client reviews.",
              },
              {
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
                title: "Team Collaboration",
                description: "Invite your team members with role-based permissions. Scale without chaos.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/20" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Ready to see Blue Reach in action?
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            Start your free 14-day trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-center"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all text-center"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
