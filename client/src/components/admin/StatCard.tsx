import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';

interface Props {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: any;
}

export default function StatCard({ title, value, icon }: Props) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>{value}</CardTitle>
          <CardDescription className="text-sm">{title}</CardDescription>
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </CardHeader>
      <CardContent />
    </Card>
  );
}
