import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface GuideContent {
  title: string;
  tag: string;
  description: string;
  sections: Array<{
    heading: string;
    content: string[];
    type?: "steps" | "tips" | "warning" | "info";
    items?: string[];
  }>;
}

const guides: Record<string, GuideContent> = {
  "getting-started": {
    title: "Getting Started with BlueReach",
    tag: "Onboarding",
    description: "Everything you need to set up your agency workspace and start running outbound campaigns.",
    sections: [
      {
        heading: "1. Create Your First Customer",
        content: [
          "From the Command Center, click \"New Customer\" to add your first client. Fill in the company name, logo URL (optional), and website.",
          "Once created, click into the customer to access their dashboard where you can configure campaign settings, target market details, and link campaigns.",
        ],
        type: "steps",
        items: [
          "Go to Command Center",
          "Click \"New Customer\" button",
          "Enter company name and details",
          "Click into the customer to configure their workspace",
        ],
      },
      {
        heading: "2. Configure Customer Settings",
        content: [
          "Each customer has key settings that help you track performance and set expectations:",
        ],
        type: "info",
        items: [
          "ACV (Average Contract Value) - The average deal size for this client",
          "TCV (Total Contract Value) - The total pipeline value target",
          "TAM (Total Addressable Market) - How many leads are in the target market",
          "Target Daily Emails - The daily sending volume goal",
          "Verticals - Target industries for the campaign",
          "The Offer - What you're pitching to prospects",
          "ICP (Ideal Customer Profile) - Who you're targeting",
        ],
      },
      {
        heading: "3. Connect Your Email Provider",
        content: [
          "BlueReach integrates with Instantly and Smartlead. You need to add your API key so campaigns can be synced.",
          "Go to the customer's Settings tab and add your provider API key. For Smartlead, use the API key from your Smartlead account settings. For Instantly, use your Instantly API key.",
        ],
        type: "steps",
        items: [
          "Navigate to customer Settings tab",
          "Click \"Add Provider\" and select Instantly or Smartlead",
          "Paste your API key",
          "Save and verify the connection",
        ],
      },
      {
        heading: "4. Link Campaigns",
        content: [
          "Once your provider is connected, go to the Campaigns tab and click \"Link Campaign\". You'll see a list of campaigns from your provider account.",
          "Select the campaigns you want to track for this customer. BlueReach will automatically sync leads, email stats, and reply data.",
        ],
      },
      {
        heading: "5. Sync & Monitor",
        content: [
          "After linking campaigns, click \"Sync\" on each campaign card to pull in all existing leads and analytics. The dashboard auto-refreshes every 30 seconds for real-time updates.",
          "Use the Overview tab for high-level stats, the Lead Workflow for pipeline management, and Campaign Performance for per-campaign breakdowns.",
        ],
      },
      {
        heading: "Pro Tips",
        content: [],
        type: "tips",
        items: [
          "Set up webhooks for real-time lead status updates instead of waiting for manual syncs",
          "Use the A/B variant analytics to see which email copy performs best",
          "Export leads as CSV to re-use non-responders in follow-up campaigns",
          "The positive reply notification emails include one-click \"Reply to Lead\" buttons for fast follow-up",
        ],
      },
    ],
  },

  "lead-workflow": {
    title: "Lead Workflow & Pipeline",
    tag: "Pipeline",
    description: "How to manage leads from first contact through to closed deal using the built-in workflow.",
    sections: [
      {
        heading: "Understanding Lead Statuses",
        content: [
          "Every lead in BlueReach goes through a defined workflow. The status reflects where each lead is in the sales process:",
        ],
        type: "info",
        items: [
          "Contacted - Email has been sent, no response yet",
          "Opened - Lead opened the email (tracked via pixel)",
          "Clicked - Lead clicked a link in the email",
          "Replied - Lead responded to the email",
          "Booked - A meeting has been scheduled",
          "Won - Deal closed successfully",
          "Lost - Deal did not close",
          "Not Interested - Lead explicitly declined",
        ],
      },
      {
        heading: "Working the Pipeline",
        content: [
          "The Lead Workflow section on each customer dashboard shows positive replies and lets you manage them through the funnel. This is your daily working view.",
        ],
        type: "steps",
        items: [
          "Check the Lead Workflow section for new positive replies",
          "Click \"Mark Responded\" once you've followed up with the lead",
          "Schedule a meeting and update the status to \"Booked\"",
          "After the meeting, mark as \"Won\" or \"Lost\" with deal value",
        ],
      },
      {
        heading: "Adding Notes & Context",
        content: [
          "Each lead card has a notes field. Use it to track call outcomes, meeting details, objections, and next steps. Notes persist across sessions and are visible to anyone with access to the customer.",
        ],
      },
      {
        heading: "Positive Reply Notifications",
        content: [
          "When a lead replies positively (via webhook), BlueReach sends an HTML email notification to agency users with two buttons:",
        ],
        type: "info",
        items: [
          "\"Reply to Lead\" - Opens Gmail or Outlook with pre-filled reply including the email thread",
          "\"View in Dashboard\" - Deep-links directly to the lead card in BlueReach, scrolling to and highlighting it",
        ],
      },
      {
        heading: "Exporting Leads",
        content: [
          "Use the All Leads page to export leads as CSV. You can filter by client, campaign, status, and positive replies. The export includes all lead data: contact info, company details, reply tracking, variant attribution, and timestamps.",
          "This is especially useful for re-targeting non-responders in new campaigns or building lookalike audiences.",
        ],
        type: "tips",
        items: [
          "Use \"No Response\" export to get leads that were contacted but never replied",
          "Use \"Positive Replies\" export for case studies and success tracking",
          "Filter by campaign to export leads from a specific outreach effort",
        ],
      },
    ],
  },

  "dns-inbox-setup": {
    title: "DNS & Inbox Setup",
    tag: "Infrastructure",
    description: "How to configure sending domains, DNS records, email warmup, and inbox rotation for maximum deliverability.",
    sections: [
      {
        heading: "Domain Strategy",
        content: [
          "Never send cold emails from your primary domain. Buy separate sending domains that are similar to your main brand. Use 2-3 inboxes per domain, and rotate across multiple domains.",
        ],
        type: "warning",
        items: [
          "Buy domains that look similar to your main domain (e.g., acme-mail.com, getacme.com)",
          "Use .com or your country TLD - avoid cheap TLDs like .xyz or .info",
          "Set up 2-3 mailboxes per domain (e.g., john@, sarah@, team@)",
          "Wait 2-4 weeks for warmup before sending cold emails",
        ],
      },
      {
        heading: "DNS Records (SPF, DKIM, DMARC)",
        content: [
          "These three DNS records tell email providers your domain is legitimate. All three are required for good deliverability.",
        ],
        type: "steps",
        items: [
          "SPF Record - Add a TXT record: v=spf1 include:_spf.google.com ~all (adjust for your provider)",
          "DKIM Record - Your email provider generates this. Add the CNAME or TXT record they give you",
          "DMARC Record - Add a TXT record at _dmarc: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com",
          "Verify all records using the Infrastructure tab in BlueReach - it auto-checks SPF, DKIM & DMARC",
        ],
      },
      {
        heading: "Setting Up with Google Workspace",
        content: [
          "Google Workspace is the most common setup for cold email sending accounts.",
        ],
        type: "steps",
        items: [
          "Purchase Google Workspace Starter ($6/user/month) for each sending domain",
          "Add your domain and verify ownership via DNS TXT record",
          "Create user accounts (these become your sending addresses)",
          "Google auto-configures DKIM - just enable it in Admin Console > Apps > Gmail > Authenticate email",
          "Add SPF record: v=spf1 include:_spf.google.com ~all",
        ],
      },
      {
        heading: "Email Warmup",
        content: [
          "New email accounts have no sender reputation. Warmup gradually builds trust by sending and receiving real emails over 2-4 weeks.",
        ],
        type: "info",
        items: [
          "Enable warmup in Instantly or Smartlead immediately after creating accounts",
          "Start with 5-10 emails/day and gradually increase to 30-50/day over 2-3 weeks",
          "Keep warmup running even while sending campaigns (at reduced volume)",
          "Monitor warmup reputation in the BlueReach Infrastructure tab",
          "Aim for 90%+ warmup reputation before starting campaigns",
        ],
      },
      {
        heading: "Inbox Rotation & Sending Limits",
        content: [
          "Spreading volume across multiple inboxes protects deliverability and prevents any single account from getting flagged.",
        ],
        type: "tips",
        items: [
          "Max 30-50 cold emails per inbox per day",
          "Use inbox rotation in Instantly/Smartlead to distribute sending automatically",
          "For 500 emails/day, you need minimum 10-15 sending accounts",
          "Set random delays between emails (60-300 seconds) to appear human",
          "Monitor bounce rates - pause accounts exceeding 5% bounce rate",
        ],
      },
    ],
  },

  "analytics-reporting": {
    title: "Analytics & Reporting",
    tag: "Analytics",
    description: "How to read your dashboard metrics, interpret campaign performance, and optimize for better results.",
    sections: [
      {
        heading: "Command Center Overview",
        content: [
          "The Command Center is your high-level dashboard showing aggregated stats across all customers and campaigns. Use the period filter (This Week, This Month, This Quarter, All Time) to analyze trends.",
        ],
        type: "info",
        items: [
          "Total Leads - Number of unique leads contacted across all campaigns",
          "Emails Sent - Total outbound emails sent (including follow-ups)",
          "Replies - Total leads that responded (positive and negative)",
          "Positive Replies - Leads marked as interested or requesting meetings",
          "Reply Rate - Replies divided by emails sent (benchmark: 1-5%)",
        ],
      },
      {
        heading: "Campaign Performance Metrics",
        content: [
          "Each campaign card shows detailed performance metrics. Here's how to interpret them:",
        ],
        type: "info",
        items: [
          "Sent - Total outbound emails delivered for this campaign",
          "Replies - Number of leads who responded, with reply rate percentage",
          "Positive - Leads categorized as interested (the metric that matters most)",
          "Bounced - Emails that failed to deliver, with bounce rate percentage",
          "Campaign Progress - Leads contacted vs total leads in the campaign",
        ],
      },
      {
        heading: "A/B Variant Analytics",
        content: [
          "For campaigns with multiple email variants (A/B testing), click into the campaign to see per-variant performance. This shows you exactly which copy drives the best results.",
          "The system tracks which specific variant each reply came from, so you can identify winning copy and iterate.",
        ],
        type: "tips",
        items: [
          "Look at positive reply rate per variant, not just total replies",
          "A variant needs 100+ sends to be statistically meaningful",
          "The \"Winner\" badge highlights the best-performing variant automatically",
          "Use Copy Review to get feedback on variants before launching",
        ],
      },
      {
        heading: "Key Benchmarks",
        content: [
          "Use these benchmarks to evaluate whether your campaigns are performing well:",
        ],
        type: "info",
        items: [
          "Reply Rate: 1-3% = Average, 3-5% = Good, 5%+ = Excellent",
          "Positive Reply Rate: 0.5-1% = Average, 1-2% = Good, 2%+ = Excellent",
          "Bounce Rate: <2% = Good, 2-5% = Acceptable, >5% = Needs attention",
          "Open Rate: 40-60% = Average, 60%+ = Good (less reliable due to tracking limitations)",
        ],
      },
      {
        heading: "Optimizing Performance",
        content: [
          "When campaigns underperform, diagnose systematically:",
        ],
        type: "steps",
        items: [
          "High bounce rate (>5%)? Your lead list quality is poor - clean your data or switch sources",
          "Low reply rate (<1%)? Test new subject lines and opening hooks in A/B variants",
          "Replies but no positive? Your offer doesn't resonate - revisit the value proposition",
          "Good positive rate but no meetings? Follow-up speed and quality needs work",
          "Export non-responders and re-target with a different angle in a new campaign",
        ],
      },
    ],
  },
};

function SectionCard({ section }: { section: GuideContent["sections"][0] }) {
  const iconMap = {
    steps: <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />,
    tips: <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />,
    info: <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />,
  };

  const borderMap = {
    steps: "border-l-blue-500",
    tips: "border-l-amber-500",
    warning: "border-l-red-500",
    info: "border-l-border",
  };

  return (
    <div className={`border-l-2 ${borderMap[section.type || "info"]} pl-4`}>
      <h3 className="text-base font-semibold mb-2">{section.heading}</h3>
      {section.content.map((paragraph, i) => (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">
          {paragraph}
        </p>
      ))}
      {section.items && section.items.length > 0 && (
        <ul className="space-y-2 mt-3">
          {section.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              {section.type === "steps" ? (
                <span className="text-blue-500 font-medium shrink-0">{i + 1}.</span>
              ) : (
                iconMap[section.type || "info"]
              )}
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides[slug];

  if (!guide) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Command Center
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <Badge variant="secondary">{guide.tag}</Badge>
        </div>
        <h1 className="text-2xl font-bold">{guide.title}</h1>
        <p className="text-muted-foreground mt-1">{guide.description}</p>
      </div>

      {/* Sections */}
      <Card>
        <CardContent className="pt-6 space-y-8">
          {guide.sections.map((section, i) => (
            <SectionCard key={i} section={section} />
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Command Center
          </Button>
        </Link>
        {(() => {
          const slugs = Object.keys(guides);
          const currentIndex = slugs.indexOf(slug);
          const nextSlug = slugs[currentIndex + 1];
          const nextGuide = nextSlug ? guides[nextSlug] : null;
          if (!nextGuide) return null;
          return (
            <Link href={`/admin/guides/${nextSlug}`}>
              <Button variant="outline" size="sm">
                Next: {nextGuide.title}
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </Link>
          );
        })()}
      </div>
    </div>
  );
}
