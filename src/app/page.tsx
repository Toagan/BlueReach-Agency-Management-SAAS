import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blue Reach — Client Reporting Dashboard for Outbound Agencies",
  description:
    "Stop sending spreadsheet reports. Give your outbound agency clients a branded, real-time portal to track campaigns, leads, and results — synced live from Instantly & Smartlead. 14-day free trial.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Blue Reach — Client Reporting Dashboard for Outbound Agencies",
    description:
      "Give your agency clients a branded, real-time dashboard to track campaigns, leads, and results. Synced from Instantly & Smartlead. White-label ready. 14-day free trial.",
    url: "/",
  },
};

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1b2a] border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-red-500/60" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
        <div className="w-3 h-3 rounded-full bg-green-500/60" />
        <div className="flex-1 ml-4 h-6 bg-white/5 rounded-md" />
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function HeroDashboardMockup() {
  return (
    <div className="relative mt-16 mx-auto max-w-4xl">
      {/* Gradient glow behind */}
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-2xl blur-xl" />
      <div className="relative">
        <BrowserChrome>
          {/* Stat cards row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg bg-white/[0.04] border border-white/5 p-4">
              <p className="text-xs text-zinc-500 mb-1">Positive Replies</p>
              <p className="text-2xl font-bold text-emerald-400">12</p>
              <p className="text-xs text-emerald-400/70 mt-1">+3 this week</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/5 p-4">
              <p className="text-xs text-zinc-500 mb-1">Open Rate</p>
              <p className="text-2xl font-bold text-blue-400">47.2%</p>
              <p className="text-xs text-blue-400/70 mt-1">Above average</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/5 p-4">
              <p className="text-xs text-zinc-500 mb-1">Meetings Booked</p>
              <p className="text-2xl font-bold text-amber-400">8</p>
              <p className="text-xs text-amber-400/70 mt-1">+2 this week</p>
            </div>
          </div>
          {/* Mini lead table */}
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-white/[0.02] text-xs text-zinc-500 font-medium">
              <span>Lead</span>
              <span>Company</span>
              <span>Status</span>
              <span>Replied</span>
            </div>
            {[
              { name: "Sarah Chen", company: "Acme Corp", status: "Replied", statusColor: "text-emerald-400 bg-emerald-400/10", date: "2 hrs ago" },
              { name: "James Wilson", company: "TechFlow", status: "Booked", statusColor: "text-blue-400 bg-blue-400/10", date: "5 hrs ago" },
              { name: "Maria Lopez", company: "ScaleUp Inc", status: "Opened", statusColor: "text-amber-400 bg-amber-400/10", date: "1 day ago" },
              { name: "David Kim", company: "GrowthCo", status: "Contacted", statusColor: "text-zinc-400 bg-zinc-400/10", date: "2 days ago" },
            ].map((lead, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-white/5 text-sm">
                <span className="text-zinc-300">{lead.name}</span>
                <span className="text-zinc-500">{lead.company}</span>
                <span><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${lead.statusColor}`}>{lead.status}</span></span>
                <span className="text-zinc-500">{lead.date}</span>
              </div>
            ))}
          </div>
        </BrowserChrome>
      </div>
    </div>
  );
}

function ClientDashboardMockup() {
  return (
    <BrowserChrome>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Emails Sent", value: "2,847", color: "text-blue-400" },
          { label: "Open Rate", value: "52.1%", color: "text-cyan-400" },
          { label: "Replies", value: "34", color: "text-emerald-400" },
          { label: "Meetings", value: "11", color: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-white/[0.04] border border-white/5 p-3">
            <p className="text-[10px] text-zinc-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {/* Mini chart area */}
      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4 mb-4">
        <p className="text-xs text-zinc-500 mb-3">Campaign Performance</p>
        <div className="flex items-end gap-1 h-16">
          {[40, 55, 35, 65, 50, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-blue-500/40 to-cyan-500/40 rounded-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      {/* Mini lead table */}
      <div className="rounded-lg border border-white/5 overflow-hidden">
        <div className="grid grid-cols-3 gap-3 px-3 py-2 bg-white/[0.02] text-[10px] text-zinc-500 font-medium">
          <span>Lead</span><span>Status</span><span>Company</span>
        </div>
        {[
          { name: "Alex Rivera", status: "Replied", color: "text-emerald-400 bg-emerald-400/10", company: "Nexus AI" },
          { name: "Pat Morgan", status: "Booked", color: "text-blue-400 bg-blue-400/10", company: "Velo Labs" },
        ].map((l, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 px-3 py-2 border-t border-white/5 text-xs">
            <span className="text-zinc-300">{l.name}</span>
            <span><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${l.color}`}>{l.status}</span></span>
            <span className="text-zinc-500">{l.company}</span>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

function LeadPipelineMockup() {
  return (
    <BrowserChrome>
      <p className="text-xs text-zinc-500 mb-4">Lead Pipeline</p>
      <div className="grid grid-cols-4 gap-3">
        {[
          { stage: "Contacted", count: 142, color: "border-zinc-500/30", items: ["Lisa Park", "Tom Green"] },
          { stage: "Replied", count: 34, color: "border-emerald-500/30", items: ["Sarah Chen", "James W."] },
          { stage: "Booked", count: 11, color: "border-blue-500/30", items: ["Maria Lopez"] },
          { stage: "Won", count: 6, color: "border-amber-500/30", items: ["David Kim"] },
        ].map((col, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">{col.stage}</span>
              <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">{col.count}</span>
            </div>
            <div className={`space-y-2`}>
              {col.items.map((name, j) => (
                <div key={j} className={`rounded-lg bg-white/[0.03] border ${col.color} p-2.5`}>
                  <p className="text-xs text-zinc-300">{name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Acme Corp</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

function SlackMockup() {
  return (
    <BrowserChrome>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-[#4A154B] flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" /></svg>
          </div>
          <span className="text-xs font-medium text-zinc-300">#client-acme-corp</span>
        </div>
        {[
          { bot: "BlueReach", time: "10:32 AM", msg: "New positive reply from John at Acme Corp: \"Yes, we'd love to set up a call this week.\"" },
          { bot: "BlueReach", time: "2:15 PM", msg: "Meeting booked: Sarah Chen (TechFlow) scheduled for Thursday at 3pm EST." },
          { bot: "BlueReach", time: "5:00 PM", msg: "Daily summary: 247 emails sent, 52.1% open rate, 3 new replies, 1 meeting booked." },
        ].map((m, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">BR</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">{m.bot}</span>
                <span className="text-[10px] text-zinc-500">{m.time}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{m.msg}</p>
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Blue Reach",
        url: "https://blue-reach.com",
        logo: "https://blue-reach.com/logo.png",
        description:
          "Client reporting dashboard for outbound lead generation agencies. Syncs with Instantly & Smartlead.",
        sameAs: [],
      },
      {
        "@type": "SoftwareApplication",
        name: "Blue Reach",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Real-time client reporting dashboard for cold email outbound agencies. White-label portals, campaign analytics, lead pipeline, and Slack integration. Syncs with Instantly & Smartlead.",
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "49",
          highPrice: "249",
          priceCurrency: "USD",
          offerCount: 3,
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          ratingCount: "47",
          bestRating: "5",
        },
        featureList:
          "White-label client portals, Real-time campaign analytics, Lead pipeline management, Slack notifications, Instantly integration, Smartlead integration, Custom workflows, Team collaboration",
      },
      {
        "@type": "WebSite",
        name: "Blue Reach",
        url: "https://blue-reach.com",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader />
      <main className="pt-16 lg:pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#050508] via-[#0a1628] to-[#050508]" />
          <div className="absolute top-20 -left-40 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[130px]" />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}
          />

          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-16 lg:pt-32 lg:pb-20">
            <div className="max-w-3xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-blue-300 font-medium">Built for email outbound agencies</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
                The Automated Campaign Dashboard
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                  for Outbound Agencies
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl text-zinc-400 leading-relaxed mb-10 max-w-2xl mx-auto">
                Stop sending spreadsheet reports. Give your clients a branded, real-time portal to track campaigns, leads, and results &mdash; synced live from Instantly &amp; Smartlead.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-center"
                >
                  Start Free Trial
                </Link>
                <Link
                  href="/features"
                  className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all text-center"
                >
                  See Features
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>14-day free trial</span>
                </div>
              </div>
            </div>

            {/* Hero Dashboard Mockup */}
            <HeroDashboardMockup />
          </div>
        </section>

        {/* Stats Bar */}
        <section className="relative py-16 bg-[#060a14] border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              {[
                { value: "4+ hrs", label: "saved per week", sublabel: "on reporting", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                { value: "2.2x", label: "client LTV", sublabel: "from retention", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
                { value: "30%", label: "happier clients", sublabel: "real-time visibility", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                { value: "87%", label: "retention rate", sublabel: "vs industry 65%", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 mb-3">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                    </svg>
                  </div>
                  <p className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{stat.value}</p>
                  <p className="text-sm text-zinc-300 font-medium mt-1">{stat.label}</p>
                  <p className="text-xs text-zinc-500">{stat.sublabel}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="py-20 lg:py-32 bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Your clients deserve better than spreadsheets
              </h2>
              <p className="text-lg text-zinc-400">
                Manual reporting wastes your time and leaves clients in the dark. Blue Reach automates everything so you can focus on results.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Card 1: No more spreadsheets */}
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                <div className="mb-5 h-24 flex items-center justify-center gap-3">
                  {/* Mini spreadsheet crossed out */}
                  <div className="relative">
                    <div className="w-14 h-16 rounded bg-white/5 border border-white/10 p-1.5 grid grid-cols-3 gap-0.5 opacity-40">
                      {[...Array(9)].map((_, j) => (
                        <div key={j} className="bg-white/10 rounded-[1px]" />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-0.5 bg-red-500/80 rotate-45" />
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  {/* Mini dashboard */}
                  <div className="w-14 h-16 rounded bg-blue-500/10 border border-blue-500/20 p-1.5 space-y-1">
                    <div className="flex gap-0.5">
                      <div className="flex-1 h-3 bg-blue-500/30 rounded-[2px]" />
                      <div className="flex-1 h-3 bg-cyan-500/30 rounded-[2px]" />
                    </div>
                    <div className="h-4 bg-emerald-500/20 rounded-[2px]" />
                    <div className="h-2 bg-white/5 rounded-[1px]" />
                    <div className="h-2 bg-white/5 rounded-[1px]" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">No more spreadsheets</h3>
                <p className="text-zinc-400 leading-relaxed">Stop exporting CSVs and building manual reports. Everything syncs automatically from Instantly &amp; Smartlead.</p>
              </div>

              {/* Card 2: Real-time updates */}
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                <div className="mb-5 h-24 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    {/* Live pulse dot */}
                    <div className="absolute -top-1 -right-1 w-4 h-4">
                      <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30" />
                      <div className="absolute inset-0.5 bg-emerald-400 rounded-full" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-time updates</h3>
                <p className="text-zinc-400 leading-relaxed">Clients see their campaign performance as it happens. Opens, replies, and meetings &mdash; all live.</p>
              </div>

              {/* Card 3: White-label ready */}
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                <div className="mb-5 h-24 flex items-center justify-center">
                  <div className="w-20 h-16 rounded-lg bg-white/[0.03] border border-white/10 overflow-hidden">
                    {/* Swappable color bar */}
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
                    {/* Swappable logo area */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-500/40 to-pink-500/40" />
                      <div className="flex-1 h-1.5 bg-white/10 rounded" />
                    </div>
                    {/* Mini content */}
                    <div className="px-2 space-y-1">
                      <div className="h-1 bg-white/5 rounded" />
                      <div className="h-1 bg-white/5 rounded w-3/4" />
                      <div className="h-1 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">White-label ready</h3>
                <p className="text-zinc-400 leading-relaxed">Add your logo, colors, and domain. Clients see your brand, not ours. Look professional without the dev work.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Showcase Section */}
        <section className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                See it in action
              </h2>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Every screen your clients will love, built and branded for your agency.
              </p>
            </div>

            <div className="space-y-12">
              {/* Client Dashboard */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
                    <span className="text-xs text-blue-300 font-medium">Client Dashboard</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Real-time campaign analytics</h3>
                  <p className="text-zinc-400 leading-relaxed">Clients log in to see live stats, reply tracking, and meeting counts. No more waiting for your weekly email.</p>
                </div>
                <ClientDashboardMockup />
              </div>

              {/* Lead Pipeline */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div className="lg:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
                    <span className="text-xs text-emerald-300 font-medium">Lead Pipeline</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Visual lead workflow</h3>
                  <p className="text-zinc-400 leading-relaxed">Track every lead from first contact to closed deal. Clients see exactly where their pipeline stands.</p>
                </div>
                <div className="lg:order-1">
                  <LeadPipelineMockup />
                </div>
              </div>

              {/* Slack Notifications */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
                    <span className="text-xs text-purple-300 font-medium">Slack Integration</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Updates where your clients work</h3>
                  <p className="text-zinc-400 leading-relaxed">Replies, meetings, and daily summaries delivered straight to your client&apos;s Slack. They stay informed without logging in.</p>
                </div>
                <SlackMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 lg:py-32 bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Everything you need to manage clients
              </h2>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                From campaign tracking to lead management, Blue Reach has you covered.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Client Portals",
                  description: "Each client gets their own branded dashboard. Manage multiple clients from one account.",
                  gradient: "from-blue-500 to-blue-600",
                  iconPath: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
                },
                {
                  title: "Real-time Analytics",
                  description: "Track opens, clicks, replies, and meetings. See exactly how campaigns are performing.",
                  gradient: "from-cyan-500 to-cyan-600",
                  iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                },
                {
                  title: "Lead Pipeline",
                  description: "Manage leads through your workflow. Track status, add notes, and move deals forward.",
                  gradient: "from-emerald-500 to-emerald-600",
                  iconPath: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                },
                {
                  title: "Email Sync",
                  description: "Connect Instantly, Smartlead, or Apollo. All your data in one place, synced automatically.",
                  gradient: "from-purple-500 to-purple-600",
                  iconPath: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                },
                {
                  title: "Instant Notifications",
                  description: "Get notified when leads reply or book meetings. Never miss an opportunity.",
                  gradient: "from-amber-500 to-amber-600",
                  iconPath: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
                },
                {
                  title: "Custom Workflows",
                  description: "Define your own lead stages. Match your existing process, not the other way around.",
                  gradient: "from-rose-500 to-rose-600",
                  iconPath: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
                },
                {
                  title: "Slack Integration",
                  description: "Auto-send campaign updates to your client's Slack. Replies, meetings, daily summaries — right where they work.",
                  gradient: "from-indigo-500 to-indigo-600",
                  iconPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.iconPath} />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                href="/features"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                See all features
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Trusted by agency owners
              </h2>
              <p className="text-lg text-zinc-400">
                See what other agencies are saying about Blue Reach.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "We were spending 4+ hours every Friday building client reports in Google Sheets. Now clients just log in and see everything live. We got that time back and retention went up because clients actually feel in the loop.",
                  author: "Marcus Chen",
                  role: "Founder",
                  company: "Pipeline Pros",
                  initials: "MC",
                  gradient: "from-blue-500 to-blue-600",
                },
                {
                  quote: "The white-label portals changed how prospects see us. During sales calls we pull up a demo dashboard and they immediately get it. We've closed 3 new retainer clients this quarter partly because of how professional it looks.",
                  author: "Jessica Walters",
                  role: "CEO",
                  company: "Outbound Studio",
                  initials: "JW",
                  gradient: "from-purple-500 to-purple-600",
                },
                {
                  quote: "Managing 12 clients across Instantly was chaos before Blue Reach. Now each client has their own portal, I can track every lead's status in one place, and my VA handles half the work she used to. Total game changer for scaling.",
                  author: "Daniel Okafor",
                  role: "Agency Owner",
                  company: "RevenueFlow Agency",
                  initials: "DO",
                  gradient: "from-emerald-500 to-emerald-600",
                },
                {
                  quote: "Our biggest client almost churned because they felt out of the loop on campaign performance. We set them up on Blue Reach and within a week they renewed for another 6 months. The real-time visibility builds trust you can't fake.",
                  author: "Sarah Mitchell",
                  role: "Head of Operations",
                  company: "ColdLeap",
                  initials: "SM",
                  gradient: "from-rose-500 to-rose-600",
                },
                {
                  quote: "I run a lean 2-person agency doing 50k+ emails a month. Blue Reach replaced our Notion tracker, Loom updates, and weekly report calls. Clients get more transparency and I get my Fridays back.",
                  author: "Tom Eriksson",
                  role: "Co-Founder",
                  company: "Nordic Outreach",
                  initials: "TE",
                  gradient: "from-amber-500 to-amber-600",
                },
                {
                  quote: "We tested 3 different client reporting tools before landing on Blue Reach. It's the only one that actually understands the agency model -- multi-client, Instantly-native, and doesn't try to be a CRM. Just works.",
                  author: "Priya Sharma",
                  role: "Director of Growth",
                  company: "ScaleMailer",
                  initials: "PS",
                  gradient: "from-cyan-500 to-cyan-600",
                },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="p-8 rounded-2xl bg-white/[0.02] border border-white/5"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-zinc-300 leading-relaxed mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-bold text-white">{testimonial.initials}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.author}</p>
                      <p className="text-sm text-zinc-500">{testimonial.role}, {testimonial.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-32 relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/20" />

          <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Stop losing clients to silence
            </h2>
            <p className="text-xl text-zinc-400 mb-4 max-w-2xl mx-auto">
              Agencies using Blue Reach retain 87% of clients and save 4+ hours per week on reporting.
            </p>
            <p className="text-lg text-zinc-500 mb-10 max-w-2xl mx-auto">
              Give your clients the visibility they&apos;re asking for. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-all shadow-xl hover:-translate-y-0.5 text-center"
              >
                Start Free Trial
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all text-center"
              >
                View Pricing
              </Link>
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
