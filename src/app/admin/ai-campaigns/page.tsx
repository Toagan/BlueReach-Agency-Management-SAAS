"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  BarChart3,
  MessageSquare,
  Upload,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Target,
  Mail,
  Shuffle,
  PenTool,
  ArrowRight,
  Bot,
  User,
  Lock,
} from "lucide-react";

// ─── Step indicator ───
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i === current
                ? "bg-primary text-primary-foreground"
                : i < current
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`text-sm font-medium whitespace-nowrap ${
              i === current ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {step}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Knowledge Base ───
function KnowledgeBaseStep() {
  const mockFiles = [
    { name: "cold-email-skill-v2.md", size: "24 KB", active: true },
    { name: "follow-up-sequences.md", size: "12 KB", active: true },
    { name: "objection-handling.md", size: "8 KB", active: false },
    { name: "icp-role-play.md", size: "6 KB", active: true },
    { name: "qa-checklist.md", size: "4 KB", active: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">
          Upload your best practices MD files. The AI uses these as its playbook
          for writing campaigns.
        </p>
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
        <Upload className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Drop .md files here or click to upload
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Markdown files with cold email frameworks, copy rules, QA checklists
        </p>
      </div>

      {/* Existing files */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Active knowledge files</p>
        {mockFiles.map((file) => (
          <div
            key={file.name}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">{file.size}</span>
            </div>
            <div
              className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${
                file.active ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  file.active ? "left-3.5" : "left-0.5"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon overlay hint */}
      <div className="flex items-center gap-2 text-xs text-primary/60">
        <Lock className="w-3 h-3" />
        File upload will be enabled when the AI builder launches
      </div>
    </div>
  );
}

// ─── Step 2: Campaign Selector ───
function CampaignSelectorStep() {
  const mockCampaigns = [
    { name: "Scaile - SaaS Decision Makers", replies: 142, rate: "4.8%", positive: 34, selected: true },
    { name: "Digital Bude - E-Commerce Founders", replies: 89, rate: "3.2%", positive: 21, selected: true },
    { name: "Almaron - FinTech CFOs", replies: 67, rate: "5.1%", positive: 18, selected: false },
    { name: "BlueReach - Agency Owners", replies: 203, rate: "6.3%", positive: 52, selected: false },
    { name: "Palantir Agency - Enterprise IT", replies: 45, rate: "2.1%", positive: 8, selected: false },
    { name: "RemixDynamics - Startup CTOs", replies: 156, rate: "4.5%", positive: 41, selected: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Reference Campaigns</h2>
        <p className="text-sm text-muted-foreground">
          Select your best-performing campaigns. The AI studies their copy, targeting,
          and results to inform the new campaign.
        </p>
      </div>

      <div className="space-y-2">
        {mockCampaigns.map((campaign) => (
          <div
            key={campaign.name}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${
              campaign.selected
                ? "border-primary/40 bg-primary/5"
                : "border-border/50 bg-muted/20 hover:border-border"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  campaign.selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {campaign.selected && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium">{campaign.name}</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.replies} replies &middot; {campaign.positive} positive
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{campaign.rate}</p>
                <p className="text-[10px] text-muted-foreground">reply rate</p>
              </div>
              <BarChart3 className="w-4 h-4 text-muted-foreground/40" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        3 campaigns selected &middot; AI will analyze copy patterns, subject lines, and offer angles from these
      </p>
    </div>
  );
}

// ─── Step 3: Campaign Builder (Chat) ───
function CampaignBuilderStep() {
  const chatMessages = [
    {
      role: "bot" as const,
      content: "What\u2019s the client domain? I\u2019ll research their business first.",
    },
    {
      role: "user" as const,
      content: "scaile.io",
    },
    {
      role: "bot" as const,
      content:
        "Got it. Scaile.io is an AI-powered sales agency that helps B2B companies scale outbound. They offer done-for-you lead gen, cold email infrastructure, and appointment setting.\n\nWho do you want to target with this campaign?",
      options: [
        "SaaS founders (Series A-B)",
        "VP of Sales at mid-market",
        "Agency owners scaling outbound",
        "Custom target...",
      ],
    },
    {
      role: "user" as const,
      content: "SaaS founders (Series A-B)",
    },
    {
      role: "bot" as const,
      content:
        "Good pick. SaaS founders post-Series A are usually hiring their first SDRs and burning budget on ramp time. What\u2019s the main pain point we should lead with?",
      options: [
        "Slow pipeline \u2014 not enough meetings",
        "SDR hiring is expensive and slow",
        "Outbound isn\u2019t working / low reply rates",
        "Custom pain point...",
      ],
    },
    {
      role: "user" as const,
      content: "SDR hiring is expensive and slow",
    },
    {
      role: "bot" as const,
      content:
        "Strong angle. We\u2019ll position Scaile as the alternative to hiring \u2014 same output, fraction of the cost. What offer structure works best?",
      options: [
        "Pay-per-meeting (risk reversal)",
        "Free audit of their current outbound",
        "Case study + ROI comparison vs hiring",
        "Custom offer...",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Campaign Builder</h2>
        <p className="text-sm text-muted-foreground">
          AI asks questions one at a time. Your answers shape the campaign strategy,
          targeting, and copy.
        </p>
      </div>

      {/* Chat interface */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Campaign Strategist AI</span>
          <Badge variant="secondary" className="text-[10px] ml-auto">Demo</Badge>
        </div>

        <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {chatMessages.map((msg, i) => (
            <div key={i}>
              <div
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "bot" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/50"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Options */}
              {msg.options && (
                <div className="ml-10 mt-2 flex flex-wrap gap-2">
                  {msg.options.map((opt) => (
                    <button
                      key={opt}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-3 flex items-center gap-2">
          <div className="flex-1 h-10 rounded-lg bg-muted/30 border border-border/50 flex items-center px-3">
            <span className="text-sm text-muted-foreground/50">Type your answer...</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Copy Generation ───
function CopyGenerationStep() {
  const emailVersions = [
    {
      version: "V1",
      subject: "quick question",
      body: `Hey {{first_name}},

Saw {{company}} just closed Series A \u2014 congrats. Quick question: are you hiring SDRs to ramp outbound, or exploring alternatives?

We helped {{case_study_company}} book 34 meetings/month without a single SDR hire \u2014 just cold email at {{cost_comparison}} the cost of a full-time rep.

Worth a 10-min look at how we\u2019d do it for {{company}}?`,
      wordCount: 58,
      feedback: null,
    },
    {
      version: "V2",
      subject: "{{first_name}} - hiring SDRs?",
      body: `Hi {{first_name}},

Noticed {{company}} is scaling post-raise. Most SaaS founders I talk to are debating: hire SDRs or outsource pipeline.

{{case_study_company}} chose option B \u2014 went from 0 to 40 meetings/month in 6 weeks, no ramp time, no recruiting headaches.

If you\u2019re weighing the same question, happy to share what worked for them.`,
      wordCount: 62,
      feedback: "Good but make the CTA more specific",
    },
    {
      version: "V3 (Final)",
      subject: "{{company}}'s pipeline",
      body: `Hey {{first_name}},

After Series A most founders burn 3-4 months hiring and ramping SDRs before seeing a single meeting.

{{case_study_company}} skipped that \u2014 we built their outbound in 2 weeks. 40 meetings/month, $0 in SDR salaries.

Want me to map out what that\u2019d look like for {{company}}? Takes 10 min, no strings.`,
      wordCount: 55,
      feedback: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Copy Generation</h2>
        <p className="text-sm text-muted-foreground">
          AI generates email copy based on your answers. Give feedback, iterate,
          and lock in the version you like.
        </p>
      </div>

      <div className="space-y-4">
        {emailVersions.map((email, i) => (
          <Card
            key={email.version}
            className={`border-border/50 ${
              i === emailVersions.length - 1
                ? "ring-2 ring-primary/30 border-primary/20"
                : ""
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={i === emailVersions.length - 1 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {email.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Subject: <span className="font-mono">{email.subject}</span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {email.wordCount} words
                </span>
              </div>

              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-muted-foreground bg-muted/30 rounded-lg p-4 border border-border/30">
                {email.body}
              </pre>

              {email.feedback && (
                <div className="mt-3 flex items-start gap-2 text-xs">
                  <MessageSquare className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-amber-500/80">
                    Your feedback: &quot;{email.feedback}&quot;
                  </span>
                </div>
              )}

              {i === emailVersions.length - 1 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                  <CheckCircle className="w-3 h-3" />
                  Approved &mdash; this version moves to A/B testing
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Follow-up sequence preview */}
      <div className="border border-border/50 rounded-xl p-5">
        <p className="text-sm font-medium mb-3">Follow-up Sequence</p>
        <div className="space-y-2">
          {[
            { day: "Day 3", angle: "Case study deep-dive", words: 48 },
            { day: "Day 7", angle: "ROI comparison vs SDR hire", words: 52 },
            { day: "Day 14", angle: "Breakup \u2014 last touch", words: 35 },
          ].map((followup) => (
            <div
              key={followup.day}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-primary w-14">{followup.day}</span>
                <span className="text-sm text-muted-foreground">{followup.angle}</span>
              </div>
              <span className="text-xs text-muted-foreground">{followup.words}w</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: A/B Testing Matrix ───
function ABTestingStep() {
  const matrix = {
    offers: [
      { label: "Pay-per-meeting", type: "Risk reversal" },
      { label: "Free outbound audit", type: "Value-first" },
      { label: "ROI case study", type: "Social proof" },
    ],
    subjects: [
      { label: "quick question", type: "Internal" },
      { label: "{{first_name}} - hiring SDRs?", type: "Name + hook" },
      { label: "{{company}}'s pipeline", type: "Company ref" },
    ],
    ctas: [
      { label: "Want me to map it out?", type: "Soft ask" },
      { label: "Here's the case study \u2192", type: "Value exchange" },
      { label: "Worth a 10-min call?", type: "Direct" },
    ],
    firstLines: [
      { label: "Saw {{company}} closed Series A", type: "Signal-based" },
      { label: "Most founders burn 3-4 months...", type: "Pattern interrupt" },
      { label: "Not sure if you or {{colleague}}...", type: "Colleague ref" },
    ],
    followups: [
      { label: "Case study \u2192 ROI \u2192 Breakup", type: "Proof ladder" },
      { label: "Different angle each email", type: "Value rotation" },
      { label: "Same thread, increasing urgency", type: "Thread bump" },
    ],
  };

  const categories = [
    { key: "offers", label: "Offer Angle", icon: Target, data: matrix.offers },
    { key: "subjects", label: "Subject Line", icon: Mail, data: matrix.subjects },
    { key: "ctas", label: "CTA Style", icon: PenTool, data: matrix.ctas },
    { key: "firstLines", label: "First Line", icon: Sparkles, data: matrix.firstLines },
    { key: "followups", label: "Follow-up Strategy", icon: Shuffle, data: matrix.followups },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">A/B Testing Matrix</h2>
        <p className="text-sm text-muted-foreground">
          Full test matrix based on Nick Abraham&apos;s framework. Test one variable at a
          time &mdash; 200+ contacts per variant for statistical significance.
        </p>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.key} className="border border-border/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/30">
              <cat.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">{cat.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {cat.data.length} variants
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {cat.data.map((variant, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm font-mono">{variant.label}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {variant.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Test recommendations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Testing Recommendations
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>&bull; Test <strong>one variable at a time</strong> &mdash; change only the offer angle OR subject line, never both</li>
            <li>&bull; Send <strong>200+ contacts per variant</strong> for reliable results</li>
            <li>&bull; Measure <strong>reply rate, not open rate</strong> &mdash; inbox placement is the real metric</li>
            <li>&bull; Run tests for <strong>minimum 5 business days</strong> before declaring a winner</li>
            <li>&bull; Target benchmarks: <strong>&gt;1% reply rate</strong>, <strong>&lt;1% bounce rate</strong>, <strong>20%+ positive sentiment</strong></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───
const STEPS = [
  "Knowledge Base",
  "Reference Campaigns",
  "Campaign Builder",
  "Copy Generation",
  "A/B Testing",
];

export default function AICampaignsPage() {
  const [currentStep, setCurrentStep] = useState(0);

  const stepComponents = [
    <KnowledgeBaseStep key="kb" />,
    <CampaignSelectorStep key="cs" />,
    <CampaignBuilderStep key="cb" />,
    <CopyGenerationStep key="cg" />,
    <ABTestingStep key="ab" />,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">AI Campaign Builder</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              Coming Soon
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Domain URL to full campaign. Upload your playbook, select winning campaigns as
            references, answer a few questions, and get research-driven email copy with A/B
            test variants.
          </p>
        </div>
      </div>

      {/* Step Navigator */}
      <StepIndicator steps={STEPS} current={currentStep} />

      {/* Step Content */}
      <div className="max-w-3xl">
        {stepComponents[currentStep]}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between max-w-3xl pt-4 border-t border-border/50">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStep ? "bg-primary" : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
          disabled={currentStep === STEPS.length - 1}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
