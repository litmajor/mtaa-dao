import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Sparkles } from "lucide-react";

export default function Achievements() {
  // Example achievements data
  const achievements = [
    { title: "First Proposal", description: "Created your first proposal.", icon: <Sparkles /> },
    { title: "Community Builder", description: "Invited 10 members.", icon: <Trophy /> },
    { title: "DAO Voter", description: "Voted on 5 proposals.", icon: <Trophy /> },
  ];

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Trophy className="text-yellow-500" /> Achievements
      </h1>
      <div className="space-y-4">
        {achievements.map((a, i) => (
          <Card key={i} className="shadow-md">
            <CardHeader className="flex items-center gap-3">
              {a.icon}
              <CardTitle>{a.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{a.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
