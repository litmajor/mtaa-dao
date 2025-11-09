
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Users, Heart, Gift, Briefcase, Sparkles } from 'lucide-react';

const templates = [
  {
    id: 'chama',
    name: 'Savings Chama',
    icon: Users,
    color: 'bg-blue-500',
    description: 'Monthly savings group with rotating loans',
    preset: {
      category: 'savings',
      governanceModel: '1-person-1-vote',
      quorum: 50,
      votingPeriod: '7d',
      treasuryType: 'cusd',
      depositRequired: true
    }
  },
  {
    id: 'wedding',
    name: 'Wedding Fund',
    icon: Heart,
    color: 'bg-pink-500',
    description: 'Fundraising for wedding expenses',
    preset: {
      category: 'fundraiser',
      governanceModel: 'weighted-stake',
      quorum: 30,
      votingPeriod: '3d',
      treasuryType: 'cusd',
      depositRequired: false
    }
  },
  {
    id: 'funeral',
    name: 'Funeral Fund',
    icon: Gift,
    color: 'bg-gray-600',
    description: 'Community support for funeral expenses',
    preset: {
      category: 'funeral',
      governanceModel: '1-person-1-vote',
      quorum: 40,
      votingPeriod: '24h',
      treasuryType: 'cusd',
      depositRequired: false
    }
  },
  {
    id: 'investment',
    name: 'Investment Club',
    icon: Briefcase,
    color: 'bg-green-500',
    description: 'Collective investment group',
    preset: {
      category: 'investment',
      governanceModel: 'weighted-stake',
      quorum: 60,
      votingPeriod: '7d',
      treasuryType: 'dual',
      depositRequired: true
    }
  },
  {
    id: 'custom',
    name: 'Custom DAO',
    icon: Sparkles,
    color: 'bg-purple-500',
    description: 'Start from scratch with full control',
    preset: null
  }
];

export default function DaoTemplates({ onSelect }: { onSelect: (preset: any) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose a Template</h3>
        <p className="text-sm text-gray-600">Start with a pre-configured DAO type or customize your own</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selected === template.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelected(template.id);
                onSelect(template.preset);
              }}
            >
              <CardHeader>
                <div className={`${template.color} w-12 h-12 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {template.preset && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {template.preset.governanceModel}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.preset.quorum}% quorum
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
