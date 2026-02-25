import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: React.ReactNode;
  color: "emerald" | "gold" | "purple" | "terra";
}

export default function StatsCard({ title, value, change, icon, color }: StatsCardProps) {
  const colorClasses = {
    emerald: "bg-mtaa-emerald/10 text-mtaa-emerald",
    gold: "bg-mtaa-gold/10 text-mtaa-gold",
    purple: "bg-mtaa-purple/10 text-mtaa-purple",
    terra: "bg-mtaa-terra/10 text-mtaa-terra",
  };

  const badgeClasses = {
    emerald: "bg-mtaa-emerald text-white",
    gold: "bg-mtaa-gold text-white",
    purple: "bg-mtaa-purple text-white",
    terra: "bg-mtaa-terra text-white",
  };

  return (
    <Card className="hover-lift">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
          <Badge className={badgeClasses[color]}>{change}</Badge>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
        <p className="text-gray-600">{title}</p>
      </CardContent>
    </Card>
  );
}
