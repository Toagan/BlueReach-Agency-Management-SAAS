import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Linkedin, Zap } from "lucide-react";

export default function ScrapingPage() {
  const tools = [
    {
      name: "Google Maps",
      description:
        "Scrape local businesses by category and location. Pull business names, emails, phone numbers, websites, and ratings from Google Maps at scale.",
      icon: MapPin,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-400",
      expectedLeads: "Up to 10,000 leads per search",
    },
    {
      name: "LinkedIn Sales Navigator",
      description:
        "Extract B2B decision-makers from LinkedIn. Scrape company followers, job titles, engagement signals, and build hyper-targeted prospect lists.",
      icon: Linkedin,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-400",
      expectedLeads: "Unlimited prospect lists",
    },
    {
      name: "Blitz API",
      description:
        "High-speed bulk lead enrichment and scraping. Find verified emails, phone numbers, and company data from domain lists and CSV uploads.",
      icon: Zap,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-400",
      expectedLeads: "Bulk enrichment at scale",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Scraping</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Build targeted lead lists from multiple sources. Scrape Google Maps,
          LinkedIn, and more — all from one place.
        </p>
      </div>

      {/* Tool Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Card
            key={tool.name}
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
                className={`w-14 h-14 rounded-xl ${tool.iconBg} flex items-center justify-center mb-5`}
              >
                <tool.icon className={`w-7 h-7 ${tool.iconColor}`} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {tool.description}
              </p>

              {/* Expected Volume */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                {tool.expectedLeads}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom note */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-6">
        <p className="text-sm text-muted-foreground">
          All scraping integrations are currently in development. Each tool will
          allow you to build lead lists, export to CSV, and push directly into
          your client campaigns. Stay tuned.
        </p>
      </div>
    </div>
  );
}
