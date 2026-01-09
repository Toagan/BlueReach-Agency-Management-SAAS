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

      {/* Placeholder for future filters/settings */}
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
