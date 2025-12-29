import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/queries/clients";
import { getCampaigns } from "@/lib/queries/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddCampaignDialog } from "./add-campaign-dialog";
import Link from "next/link";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function CampaignsPage({ params }: PageProps) {
  const { clientId } = await params;
  const supabase = await createClient();

  let client;
  try {
    client = await getClient(supabase, clientId);
  } catch {
    notFound();
  }

  const campaigns = await getCampaigns(supabase, clientId);

  // Get lead counts for each campaign
  const { data: leadCounts } = await supabase
    .from("leads")
    .select("campaign_id")
    .in(
      "campaign_id",
      campaigns.map((c) => c.id)
    );

  const countByCampaign = leadCounts?.reduce(
    (acc, lead) => {
      acc[lead.campaign_id] = (acc[lead.campaign_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link
            href="/admin/clients"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to Clients
          </Link>
          <h1 className="text-2xl font-bold mt-2">{client.name}</h1>
          <p className="text-gray-500">Manage campaigns for this client</p>
        </div>
        <AddCampaignDialog clientId={clientId} />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>No campaigns yet. Add a campaign to start receiving leads.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {campaign.name}
                    <Badge variant={campaign.is_active ? "default" : "secondary"}>
                      {campaign.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {countByCampaign?.[campaign.id] || 0} leads
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {campaign.instantly_campaign_id && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500">Instantly Campaign ID</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {campaign.instantly_campaign_id}
                    </code>
                  </div>
                )}
                {campaign.copy_body && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email Copy</p>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {campaign.copy_body}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
