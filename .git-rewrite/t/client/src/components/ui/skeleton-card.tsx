
import React from 'react';
import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';

interface SkeletonCardProps {
  showAvatar?: boolean;
  showHeader?: boolean;
  lines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showAvatar = false,
  showHeader = true,
  lines = 3,
  className
}) => {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center space-x-4">
            {showAvatar && <Skeleton className="h-12 w-12 rounded-full" />}
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton 
              key={i} 
              className={`h-4 ${i === lines - 1 ? 'w-[60%]' : 'w-full'}`} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
