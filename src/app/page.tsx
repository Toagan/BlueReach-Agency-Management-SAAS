import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blue Reach — Scale Your Outbound Agency Without Hiring",
  description:
    "The command center for cold email agencies. Manage 50+ clients from one dashboard. Slack alerts, HubSpot sync, white-label portals, and email infrastructure monitoring — all automated. 14-day free trial.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Blue Reach — Scale Your Outbound Agency Without Hiring",
    description:
      "Manage 50+ clients, automate reply routing, sync to HubSpot, monitor deliverability — all from one dashboard. Built for cold email agencies.",
    url: "/",
  },
};

function CommandCenterMockup() {
  return (
    <div className="relative mt-8 sm:mt-16 mx-auto max-w-5xl">
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-2xl blur-xl" />
      <div className="relative rounded-xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1b2a] border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-[10px] text-zinc-500">app.youragency.com/admin</span>
          <div className="flex-1 ml-2 h-6 bg-white/5 rounded-md" />
        </div>
        <Image
          src="/screenshots/command-center.png"
          alt="Blue Reach Command Center — overview dashboard with real-time stats"
          width={1920}
          height={600}
          className="w-full h-auto"
          quality={90}
        />
      </div>
    </div>
  );
}

function AutomationFlowMockup() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1b2a] border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-[10px] text-zinc-500">Lead Workflow</span>
          <div className="flex-1 ml-2 h-6 bg-white/5 rounded-md" />
        </div>
        <Image
          src="/screenshots/lead-workflow.png"
          alt="Lead workflow — manage positive replies with one-click actions"
          width={1200}
          height={600}
          className="w-full h-auto"
          quality={90}
        />
      </div>
    </div>
  );
}

function ClientPortalMockup() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1b2a] border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-[10px] text-zinc-500">portal.youragency.com — Client Dashboard</span>
          <div className="flex-1 ml-2 h-6 bg-white/5 rounded-md" />
        </div>
        <Image
          src="/screenshots/client-dashboard.png"
          alt="Client dashboard — campaign stats, ICP, offer, and target market overview"
          width={1920}
          height={800}
          className="w-full h-auto"
          quality={90}
        />
      </div>
    </div>
  );
}

function InfrastructureMockup() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1b2a] border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-[10px] text-zinc-500">Campaign Performance</span>
          <div className="flex-1 ml-2 h-6 bg-white/5 rounded-md" />
        </div>
        <Image
          src="/screenshots/campaign-performance.png"
          alt="Campaign performance — search, filter, and track all campaigns"
          width={1920}
          height={900}
          className="w-full h-auto"
          quality={90}
        />
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Blue Reach",
        url: "https://app.blue-reach.com",
        description: "The command center for cold email outbound agencies. Automate client reporting, reply routing, CRM syncing, and deliverability monitoring.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Blue Reach",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Scale your outbound agency without hiring. Manage 50+ clients from one dashboard with automated Slack alerts, HubSpot sync, white-label portals, and infrastructure monitoring.",
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "49",
          highPrice: "249",
          priceCurrency: "USD",
          offerCount: 3,
        },
        featureList: "Multi-client management, Slack notifications, HubSpot CRM sync, White-label client portals, Email infrastructure monitoring, DNS health checks, Lead pipeline, Instantly integration, Smartlead integration",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader />
      <main className="pt-16 lg:pt-20">

        {/* ===================== HERO ===================== */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#050508] via-[#0a1628] to-[#050508]" />
          <div className="absolute top-20 -left-40 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[130px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}
          />

          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-16 lg:pt-32 lg:pb-20">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-blue-300 font-medium">Built for cold email agencies</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
                Scale to 50 Clients
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                  Without Hiring Anyone
                </span>
              </h1>

              <p className="text-base sm:text-xl text-zinc-400 leading-relaxed mb-8 sm:mb-10 max-w-2xl mx-auto">
                Automate client reporting, reply routing, CRM syncing, and deliverability monitoring. All from one dashboard.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-center"
                >
                  Start Free Trial
                </Link>
                <a
                  href="mailto:tilman@blue-reach.com?subject=Blue Reach Demo Request"
                  className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all text-center"
                >
                  Book a Demo
                </a>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Works with Instantly &amp; Smartlead</span>
                </div>
              </div>
            </div>

            <CommandCenterMockup />
          </div>
        </section>

        {/* ===================== AUTOMATION CHAIN ===================== */}
        <section className="py-20 lg:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.03] to-transparent" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                  <span className="text-xs text-emerald-300 font-medium">Automation Engine</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                  Positive reply comes in.
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Everything else is automatic.
                  </span>
                </h2>
                <p className="text-lg text-zinc-400 leading-relaxed mb-8">
                  When a lead replies positively, Blue Reach triggers your entire workflow instantly. No manual work. No copy-pasting. No forgetting to update the CRM.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", text: "Slack alert in your client's channel", color: "text-purple-400" },
                    { icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", text: "HubSpot contact + deal created automatically", color: "text-orange-400" },
                    { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", text: "Email notification with one-click reply button", color: "text-blue-400" },
                    { icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7", text: "Client portal updated in real-time", color: "text-cyan-400" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <svg className={`w-5 h-5 ${item.color} mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                      </svg>
                      <span className="text-zinc-300">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <AutomationFlowMockup />
            </div>
          </div>
        </section>

        {/* ===================== CLIENT PORTAL ===================== */}
        <section className="py-20 lg:py-32 bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-6">
                  <span className="text-xs text-cyan-300 font-medium">White-Label Portal</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                  Your brand. Their dashboard.
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                    Zero dev work.
                  </span>
                </h2>
                <p className="text-lg text-zinc-400 leading-relaxed mb-8">
                  Every client gets their own branded portal with live campaign stats, lead pipeline, and email threads. Your logo, your colors. They see your brand, not ours.
                </p>
                <ul className="space-y-3">
                  {[
                    "Custom logo, colors, and agency name",
                    "Role-based access (viewer, manager, owner)",
                    "Real-time campaign analytics and lead pipeline",
                    "One-click invite via email — OAuth login",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:order-1">
                <ClientPortalMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ===================== INFRASTRUCTURE ===================== */}
        <section className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
                  <span className="text-xs text-amber-300 font-medium">Infrastructure Monitor</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                  Protect your deliverability
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                    across every account.
                  </span>
                </h2>
                <p className="text-lg text-zinc-400 leading-relaxed mb-8">
                  Monitor SPF, DKIM, and DMARC across all your domains. Track warmup reputation for every email account. Catch problems before they kill your campaigns.
                </p>
                <ul className="space-y-3">
                  {[
                    "DNS health checks (SPF, DKIM, DMARC) for all domains",
                    "Warmup reputation tracking per email account",
                    "Account status monitoring across Instantly & Smartlead",
                    "Daily health snapshots for trend analysis",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <InfrastructureMockup />
            </div>
          </div>
        </section>

        {/* ===================== FEATURE GRID ===================== */}
        <section className="py-20 lg:py-32 bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Everything else you need to run at scale
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                {
                  title: "Multi-Provider Sync",
                  description: "Connect Instantly and Smartlead. Per-campaign API keys. All data in one place.",
                  gradient: "from-blue-500 to-blue-600",
                  iconPath: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
                },
                {
                  title: "Lead Database",
                  description: "CSV imports, enrichment, deduplication. Centralized across all clients and sources.",
                  gradient: "from-emerald-500 to-emerald-600",
                  iconPath: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
                },
                {
                  title: "Lead Pipeline",
                  description: "Visual workflow: Contacted, Replied, Booked, Won. Track deal values and next actions.",
                  gradient: "from-cyan-500 to-cyan-600",
                  iconPath: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                },
                {
                  title: "CSV Export",
                  description: "Export positive replies, all replies, or full lead lists. Filter by status and campaign.",
                  gradient: "from-purple-500 to-purple-600",
                  iconPath: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                },
                {
                  title: "Slack Stats Reports",
                  description: "Automated daily, weekly, or monthly campaign summaries sent to Slack.",
                  gradient: "from-indigo-500 to-indigo-600",
                  iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                },
                {
                  title: "Email Thread Viewer",
                  description: "Full conversation history per lead. See exactly what was sent and what they replied.",
                  gradient: "from-rose-500 to-rose-600",
                  iconPath: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                },
                {
                  title: "A/B Variant Tracking",
                  description: "See which email variant triggered the reply. Optimize sequences with data.",
                  gradient: "from-amber-500 to-amber-600",
                  iconPath: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                },
                {
                  title: "Subscription Billing",
                  description: "Built-in Stripe billing. Enforce client limits per plan. Trial and payment management.",
                  gradient: "from-teal-500 to-teal-600",
                  iconPath: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                },
              ].map((feature, i) => (
                <div key={i} className="group p-4 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.iconPath} />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== TESTIMONIALS ===================== */}
        <section className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Agencies that stopped drowning in spreadsheets
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  quote: "We went from 8 clients to 23 in four months without adding headcount. Before Blue Reach, scaling meant hiring another ops person just to handle reporting. Now it runs itself.",
                  author: "Marcus Chen",
                  role: "Founder",
                  company: "Pipeline Pros",
                  image: "/testimonial-1.jpg",
                },
                {
                  quote: "The Slack + HubSpot automation alone saved us. Every positive reply used to mean 10 minutes of manual CRM entry. Now it happens before I even open the notification.",
                  author: "Jessica Walters",
                  role: "CEO",
                  company: "Outbound Studio",
                  image: "/testimonial-2.jpg",
                },
                {
                  quote: "Our clients kept asking 'how's the campaign going?' Now they just log in. Churn dropped, upsells went up, and I stopped dreading Friday report day.",
                  author: "Daniel Okafor",
                  role: "Agency Owner",
                  company: "RevenueFlow Agency",
                  image: "/testimonial-3.jpg",
                },
              ].map((testimonial, i) => (
                <article key={i} className="p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-zinc-300 leading-relaxed mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <Image src={testimonial.image} alt={testimonial.author} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{testimonial.author}</p>
                      <p className="text-sm text-zinc-500">{testimonial.role}, {testimonial.company}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== PRICING ===================== */}
        <section className="py-20 lg:py-32 bg-zinc-900/30" id="pricing">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Simple pricing. No surprises.
              </h2>
              <p className="text-lg text-zinc-400 max-w-xl mx-auto">
                Start your 14-day free trial. No credit card required. Cancel anytime.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-6 max-w-5xl mx-auto">
              {[
                {
                  name: "Starter",
                  price: 49,
                  description: "For agencies getting started",
                  features: ["Up to 3 clients", "Instantly integration", "Client portal access", "Basic analytics", "Email support"],
                  popular: false,
                },
                {
                  name: "Growth",
                  price: 99,
                  description: "For agencies ready to scale",
                  features: ["Up to 10 clients", "Instantly + Smartlead", "White-label portals", "Slack + HubSpot integrations", "Advanced analytics", "Priority support"],
                  popular: true,
                },
                {
                  name: "Agency",
                  price: 249,
                  description: "For agencies at scale",
                  features: ["Unlimited clients", "All integrations", "White-label everything", "Infrastructure monitoring", "Custom domain + SSL", "Dedicated support"],
                  popular: false,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
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
                        <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.popular ? "text-blue-400" : "text-emerald-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    Start Free Trial
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== FINAL CTA ===================== */}
        <section className="py-20 lg:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/20" />
          <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Stop managing campaigns in spreadsheets.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mt-2">
                Start scaling your agency.
              </span>
            </h2>
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
              Join agencies that manage 50+ clients from one dashboard with zero manual reporting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-all shadow-xl hover:-translate-y-0.5 text-center"
              >
                Start Free Trial
              </Link>
              <a
                href="mailto:tilman@blue-reach.com?subject=Blue Reach Demo Request"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all text-center"
              >
                Book a Demo
              </a>
            </div>
            <p className="mt-6 text-sm text-zinc-500">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
