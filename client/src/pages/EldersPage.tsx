import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, Shield, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Elders Dashboard Page
 * 
 * Displays the three specialized governance elders:
 * - ELD-SCRY: Surveillance & threat detection
 * - ELD-LUMEN: Code review & smart contract auditing
 * - ELD-CIPHER: Encryption & security management
 */

interface ElderInfo {
  id: string;
  name: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  capabilities: string[];
  status: 'active' | 'monitoring' | 'pending';
  color: string;
}

export default function EldersPage() {
  const elders: ElderInfo[] = [
    {
      id: 'scry',
      name: 'ELD-SCRY',
      title: 'Surveillance Elder',
      icon: <Eye className="w-8 h-8" />,
      description: 'Advanced threat detection and DAO surveillance system',
      capabilities: [
        'Real-time threat monitoring',
        'Behavior pattern analysis',
        'Risk scoring & forecasting',
        'Member activity surveillance',
        'Anomaly detection',
      ],
      status: 'active',
      color: 'emerald',
    },
    {
      id: 'lumen',
      name: 'ELD-LUMEN',
      title: 'Auditing Elder',
      icon: <Zap className="w-8 h-8" />,
      description: 'Smart contract auditing and code review system',
      capabilities: [
        'Code quality analysis',
        'Smart contract security review',
        'Gas optimization recommendations',
        'Vulnerability detection',
        'Best practices enforcement',
      ],
      status: 'active',
      color: 'amber',
    },
    {
      id: 'cipher',
      name: 'ELD-CIPHER',
      title: 'Encryption Elder',
      icon: <Shield className="w-8 h-8" />,
      description: 'Encryption, key management, and secure communication',
      capabilities: [
        'End-to-end encryption',
        'Key management & rotation',
        'Secure data storage',
        'Communication privacy',
        'Compliance verification',
      ],
      status: 'active',
      color: 'blue',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800';
      case 'monitoring':
        return 'bg-amber-100 text-amber-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">The Three Elders</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Specialized governance and security systems working together to protect and optimize your DAO
        </p>
      </div>

      {/* Elders Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {elders.map((elder) => (
          <Card key={elder.id} className="overflow-hidden hover:shadow-lg transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-emerald-600 dark:text-emerald-400">
                    {elder.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{elder.name}</CardTitle>
                    <CardDescription className="text-sm">{elder.title}</CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(elder.status)}>
                  {elder.status.charAt(0).toUpperCase() + elder.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {elder.description}
              </p>
              
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Key Capabilities:
                </h4>
                <ul className="space-y-1">
                  {elder.capabilities.map((capability, idx) => (
                    <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg transition-colors text-sm font-medium">
                  View Dashboard →
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Overview */}
      <Card className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20">
        <CardHeader>
          <CardTitle>How The Three Elders Work Together</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">
                🛡️ Protection Layer
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ELD-SCRY monitors threats and patterns. ELD-CIPHER secures communications. Together they protect your DAO.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                ⚙️ Quality Layer
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ELD-LUMEN reviews code and smart contracts. Ensures quality and security before deployment.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                🔄 Integration Layer
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                All three elders share data and insights. Coordinated governance and decision-making.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/30">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Status:</strong> All three elders are operational and monitoring your DAO. Access detailed dashboards for each elder above.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Features */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">Advanced Features (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>✨ Multi-elder coordination dashboards</li>
            <li>✨ Real-time threat intelligence feeds</li>
            <li>✨ Automated response protocols</li>
            <li>✨ Historical analytics and trend analysis</li>
            <li>✨ Custom elder configurations</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
