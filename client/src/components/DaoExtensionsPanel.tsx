
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  MessageCircle, 
  BarChart3, 
  Calendar, 
  TrendingUp,
  Zap,
  CheckCircle 
} from "lucide-react";

interface Extension {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  isPremium: boolean;
}

export default function DaoExtensionsPanel({ daoId }: { daoId: string }) {
  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: 'polls',
      name: 'Polls & Surveys',
      description: 'Quick community polls for non-binding decisions',
      icon: <BarChart3 className="w-6 h-6" />,
      enabled: true,
      isPremium: false
    },
    {
      id: 'events',
      name: 'Event Calendar',
      description: 'Schedule and track community events',
      icon: <Calendar className="w-6 h-6" />,
      enabled: true,
      isPremium: false
    },
    {
      id: 'fundraiser',
      name: 'Fundraiser Tracker',
      description: 'Track progress on fundraising campaigns',
      icon: <TrendingUp className="w-6 h-6" />,
      enabled: false,
      isPremium: false
    },
    {
      id: 'chat',
      name: 'Community Chat',
      description: 'In-app chat or Telegram integration',
      icon: <MessageCircle className="w-6 h-6" />,
      enabled: true,
      isPremium: false
    },
    {
      id: 'analytics',
      name: 'Advanced Analytics',
      description: 'Detailed insights and reporting',
      icon: <Zap className="w-6 h-6" />,
      enabled: false,
      isPremium: true
    }
  ]);

  const toggleExtension = (id: string) => {
    setExtensions(extensions.map(ext => 
      ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>DAO Extensions</CardTitle>
        <p className="text-sm text-gray-500">Customize your DAO with these modules</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {extensions.map((ext) => (
          <div 
            key={ext.id} 
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${ext.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                {ext.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{ext.name}</h4>
                  {ext.isPremium && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      Premium
                    </Badge>
                  )}
                  {ext.enabled && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{ext.description}</p>
              </div>
            </div>
            <Switch
              checked={ext.enabled}
              onCheckedChange={() => toggleExtension(ext.id)}
              disabled={ext.isPremium}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
