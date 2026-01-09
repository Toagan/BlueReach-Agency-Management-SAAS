"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, ArrowLeft, Construction } from "lucide-react";

export default function ScrapingPage() {
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
        <h1 className="text-2xl font-bold text-foreground">Lead Scraping</h1>
        <p className="text-muted-foreground">
          Extract leads from Google Maps and Google Search results
        </p>
      </div>

      {/* Scraping Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Maps Scraping */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Construction className="h-3 w-3" />
              Coming Soon
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <MapPin className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle>Google Maps Scraper</CardTitle>
                <CardDescription>
                  Extract business leads from Google Maps
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Search for businesses by location, category, or keyword and extract:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Business name and address</li>
                <li>Phone numbers</li>
                <li>Website URLs</li>
                <li>Email addresses (when available)</li>
                <li>Ratings and review counts</li>
                <li>Business categories</li>
              </ul>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground/70">
                  Example: "Marketing agencies in Berlin" or "Restaurants near Times Square"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Search Scraping */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Construction className="h-3 w-3" />
              Coming Soon
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Google Search Scraper</CardTitle>
                <CardDescription>
                  Find leads from Google search results
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Search Google and extract contact information from results:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Company websites</li>
                <li>Contact pages</li>
                <li>Email addresses</li>
                <li>Social media profiles</li>
                <li>LinkedIn company pages</li>
                <li>Domain information</li>
              </ul>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground/70">
                  Example: "SaaS companies hiring" or "E-commerce agencies Germany"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scraping Tools & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scraping Tools & Resources</CardTitle>
          <CardDescription>
            External tools and APIs for lead scraping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://blitzapi.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Search className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">BlitzAPI</div>
                <p className="text-sm text-muted-foreground">
                  Fast Google Maps & Places API for scraping business data at scale
                </p>
              </div>
            </a>

            <a
              href="https://zenrows.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <Search className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">ZenRows</div>
                <p className="text-sm text-muted-foreground">
                  Web scraping API with anti-bot bypass, rotating proxies & JavaScript rendering
                </p>
              </div>
            </a>

            <a
              href="https://rapidapi.com/rockapis-rockapis-default/api/google-map-places"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">RapidAPI Rock API</div>
                <p className="text-sm text-muted-foreground">
                  Google Maps Places API on RapidAPI for business search & details
                </p>
              </div>
            </a>

            <a
              href="https://texau.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <Search className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">TexAu</div>
                <p className="text-sm text-muted-foreground">
                  Growth automation platform for LinkedIn, Twitter, and web scraping
                </p>
              </div>
            </a>

            <a
              href="https://phantombuster.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                <Search className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">PhantomBuster</div>
                <p className="text-sm text-muted-foreground">
                  No-code automation for LinkedIn, Sales Navigator, Google Maps & more
                </p>
              </div>
            </a>

            <a
              href="https://chrome.google.com/webstore/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoiiah"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
                <Search className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">Instant Data Scraper</div>
                <p className="text-sm text-muted-foreground">
                  Free Chrome extension for scraping data from any website with AI detection
                </p>
              </div>
            </a>

            <a
              href="https://ahrefs.com/blog/google-advanced-search-operators/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                <Search className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">Google Search Operators</div>
                <p className="text-sm text-muted-foreground">
                  Advanced search operators guide for finding targeted leads on Google
                </p>
              </div>
            </a>

            <a
              href="https://serper.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-md bg-teal-100 dark:bg-teal-900/30">
                <Search className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium group-hover:text-primary transition-colors">Serper</div>
                <p className="text-sm text-muted-foreground">
                  Google Search API for real-time SERP data, images, news & more
                </p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for future scraping jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scraping Jobs</CardTitle>
          <CardDescription>
            Your scraping jobs will appear here once the feature is available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">Feature Under Development</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
              We're building powerful scraping tools to help you find leads.
              Check back soon for updates!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
