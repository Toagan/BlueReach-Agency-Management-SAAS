"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  Globe,
  Target,
  Mail,
  Users,
  Search,
  FileText,
  Zap,
  CheckCircle,
  ArrowRight,
  Database,
  Brain,
  MessageSquare,
  BarChart3,
  Construction,
} from "lucide-react";

export default function AICampaignsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Campaign Builder</h1>
            <p className="text-muted-foreground">
              Automate campaign research and copy generation with AI
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/50">
            <Construction className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
            <p className="text-muted-foreground mt-1">
              We're building an AI-powered campaign builder that automatically researches prospects,
              generates personalized copy, and suggests who to target - all from a single client domain URL.
            </p>
          </div>
        </div>
      </div>

      {/* The Vision */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            The Vision: Domain URL to Full Campaign
          </CardTitle>
          <CardDescription>
            Input a client's domain URL → Get a complete, research-driven outreach campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Globe className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">Client Website</p>
                <p className="text-sm text-muted-foreground">company.com</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Brain className="h-8 w-8 text-purple-500" />
              <div>
                <p className="font-medium">AI Research</p>
                <p className="text-sm text-muted-foreground">Signals & ICP</p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Mail className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Full Campaign</p>
                <p className="text-sm text-muted-foreground">Copy + Targeting</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Research */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-sm">
                1
              </div>
              <CardTitle className="text-lg">Automated Research</CardTitle>
            </div>
            <CardDescription>
              AI analyzes the client's website to extract key business intelligence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Product/Service Analysis</strong> - What they sell, pricing tiers, key features
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Case Studies & Proof Points</strong> - Customer wins, metrics, outcomes
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Signal Detection</strong> - Hiring patterns, tech stack, competitive positioning
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 2: ICP Definition */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 font-bold text-sm">
                2
              </div>
              <CardTitle className="text-lg">ICP Generation</CardTitle>
            </div>
            <CardDescription>
              AI suggests who to target based on the client's ideal customer profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Target className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Target Personas</strong> - Job titles, seniority levels, decision makers
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Company Criteria</strong> - Industry verticals, company size, geography
                </span>
              </li>
              <li className="flex items-start gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Signal Matching</strong> - Pain points, buying triggers, timing indicators
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 3: Copy Generation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 font-bold text-sm">
                3
              </div>
              <CardTitle className="text-lg">Copy Generation</CardTitle>
            </div>
            <CardDescription>
              AI writes personalized email sequences based on research signals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Signal-Based First Lines</strong> - Specific, research-driven openers
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Value Prop Rotation</strong> - Different angles for follow-ups
                </span>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-green-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">4-Email Sequences</strong> - Complete follow-up strategy included
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 4: Lead Enrichment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-bold text-sm">
                4
              </div>
              <CardTitle className="text-lg">Lead Enrichment</CardTitle>
            </div>
            <CardDescription>
              Automatically find and enrich leads matching the ICP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Database className="h-4 w-4 text-orange-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Clay Integration</strong> - Pull leads from multiple data sources
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Search className="h-4 w-4 text-orange-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Email Verification</strong> - Ensure deliverability before sending
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-orange-500 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Custom Variables</strong> - Personalization fields for each lead
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Tools We'll Integrate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Planned Integrations</CardTitle>
          <CardDescription>
            Tools that will power the AI Campaign Builder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="https://clay.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <Database className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Clay</div>
                <p className="text-xs text-muted-foreground">Lead enrichment & research automation</p>
              </div>
            </a>

            <a
              href="https://openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <Brain className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">OpenAI / Claude</div>
                <p className="text-xs text-muted-foreground">AI-powered copy generation</p>
              </div>
            </a>

            <a
              href="https://apollo.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Apollo</div>
                <p className="text-xs text-muted-foreground">B2B contact database</p>
              </div>
            </a>

            <a
              href="https://clearbit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Search className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Clearbit</div>
                <p className="text-xs text-muted-foreground">Company intelligence API</p>
              </div>
            </a>

            <a
              href="https://serper.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-teal-100 dark:bg-teal-900/30">
                <Globe className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Serper</div>
                <p className="text-xs text-muted-foreground">Google search API for signals</p>
              </div>
            </a>

            <a
              href="https://instantly.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Instantly</div>
                <p className="text-xs text-muted-foreground">Email sending infrastructure</p>
              </div>
            </a>

            <a
              href="https://smartlead.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-pink-100 dark:bg-pink-900/30">
                <Zap className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">Smartlead</div>
                <p className="text-xs text-muted-foreground">Cold email platform</p>
              </div>
            </a>

            <a
              href="https://n8n.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                <Sparkles className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-center">
                <div className="font-medium group-hover:text-primary transition-colors">n8n</div>
                <p className="text-xs text-muted-foreground">Workflow automation</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Cold Email Methodology */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">The Methodology</CardTitle>
          <CardDescription>
            Based on proven cold email principles that generate results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Signal-Based Personalization</h4>
              <p className="text-sm text-muted-foreground">
                Every email starts with a specific, research-driven insight. No generic templates -
                each message references real data from the prospect's world.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Campaign Signal Ranking</h4>
              <p className="text-sm text-muted-foreground">
                AI ranks campaign ideas by signal strength: Custom research signals → AI-generated insights →
                Standard personalization → Whole offer fallback.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Short & Punchy Copy</h4>
              <p className="text-sm text-muted-foreground">
                Target 50-90 words per email. Every word earns its place.
                Should read aloud in under 20 seconds.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">Value Prop Rotation</h4>
              <p className="text-sm text-muted-foreground">
                Follow-ups rotate through different value angles: save time/money → make money →
                risk reduction → social proof.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="font-medium mb-3">Quality Standards</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                  50-90 words
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  No hallucinations
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                  Low-effort CTA
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                  2:1 about them
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for Future Feature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Try It Out</CardTitle>
          <CardDescription>
            Enter a client domain to generate a campaign (coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">Feature Under Development</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
              Soon you'll be able to paste a client's website URL and get a complete campaign
              with targeting suggestions, email copy, and follow-up sequences.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
