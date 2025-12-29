import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadStats } from "@/lib/queries/stats";

interface StatsCardsProps {
  stats: LeadStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Contacted",
      value: stats.total_contacted,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
    {
      title: "Replied",
      value: stats.total_replied,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Meetings Booked",
      value: stats.total_booked,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Closed Won",
      value: stats.total_won,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={card.bgColor}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
