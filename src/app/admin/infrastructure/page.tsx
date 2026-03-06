import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Shield,
  Mail,
  Activity,
  ArrowRightLeft,
  Flame,
} from "lucide-react";
/* eslint-disable @next/next/no-img-element */

export default function InfrastructurePage() {
  const features = [
    {
      name: "Domain Purchase",
      description:
        "Buy and register sending domains directly from the dashboard. Bulk purchase across Namecheap and Cloudflare Registrar with auto-configuration for cold email infrastructure.",
      icon: Globe,
      iconBg: "bg-orange-500/15",
      iconColor: "text-orange-400",
      providers: [
        { name: "Namecheap", logo: "/logos/namecheap.svg" },
        { name: "Cloudflare", logo: "/logos/cloudflare.svg" },
      ],
      highlight: "Bulk domain registration",
    },
    {
      name: "DNS Configuration",
      description:
        "Auto-configure SPF, DKIM, and DMARC records via the Cloudflare API. One-click DNS setup for all your sending domains — no manual record editing required.",
      icon: Shield,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-400",
      providers: [{ name: "Cloudflare", logo: "/logos/cloudflare.svg" }],
      highlight: "Auto SPF / DKIM / DMARC",
    },
    {
      name: "Inbox Creation",
      description:
        "Spin up sending inboxes at scale via Purelymail and Zapmail. Create, configure, and connect email accounts to your campaigns — all from one place.",
      icon: Mail,
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-400",
      providers: [
        { name: "Purelymail", logo: "/logos/purelymail.svg" },
        { name: "Zapmail", logo: "/logos/zapmail.svg" },
      ],
      highlight: "Bulk inbox provisioning",
    },
    {
      name: "Domain Monitoring",
      description:
        "Track DNS health, deliverability scores, and blacklist status across all your sending domains. Get alerts when records change or domains land on blocklists.",
      icon: Activity,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
      providers: [],
      highlight: "Health scores & blacklist alerts",
    },
    {
      name: "DNS Forwarding",
      description:
        "Set up email forwarding rules for your sending domains. Route replies and catch-all addresses to your team's inboxes without touching DNS panels.",
      icon: ArrowRightLeft,
      iconBg: "bg-cyan-500/15",
      iconColor: "text-cyan-400",
      providers: [{ name: "Cloudflare", logo: "/logos/cloudflare.svg" }],
      highlight: "Reply routing & catch-all",
    },
    {
      name: "Warmup Tracking",
      description:
        "Monitor inbox warmup reputation, emails sent and received, and daily sending limits. Track warmup progress across Instantly and Smartlead accounts.",
      icon: Flame,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-400",
      providers: [
        { name: "Instantly", logo: "/logos/instantly.svg" },
        { name: "Smartlead", logo: "/logos/smartlead.svg" },
      ],
      highlight: "Reputation & deliverability",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Infrastructure</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Manage your entire cold email infrastructure from one place — domains,
          DNS, inboxes, and deliverability monitoring.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Card
            key={feature.name}
            className="relative overflow-hidden border-border/50 bg-card/50 hover:border-border transition-colors"
          >
            {/* Coming Soon Badge */}
            <div className="absolute top-4 right-4">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 text-xs font-medium"
              >
                Coming Soon
              </Badge>
            </div>

            <CardContent className="p-6 pt-6">
              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-xl ${feature.iconBg} flex items-center justify-center mb-5`}
              >
                <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2">{feature.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* Provider Logos */}
              {feature.providers.length > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  {feature.providers.map((provider) => (
                    <div
                      key={provider.name}
                      className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5"
                    >
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        width={16}
                        height={16}
                        className="opacity-70"
                      />
                      <span className="text-xs text-muted-foreground">
                        {provider.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Highlight */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                {feature.highlight}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom note */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-6">
        <p className="text-sm text-muted-foreground">
          All infrastructure tools are currently in development. When launched,
          you&apos;ll be able to purchase domains, configure DNS, create inboxes,
          and monitor deliverability — all without leaving Blue Reach.
        </p>
      </div>
    </div>
  );
}
