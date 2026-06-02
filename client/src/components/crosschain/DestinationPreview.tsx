import React from 'react';

type Props = { chain: string; token: string; eta?: string };

export default function DestinationPreview({ chain, token, eta }: Props) {
  return (
    <div className="p-3 bg-muted/50 rounded flex items-center gap-4">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">🔗</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">You will receive</div>
        <div className="font-medium">{token} on {chain}</div>
        {eta && <div className="text-xs text-muted-foreground">Estimated: {eta}</div>}
      </div>
    </div>
  );
}
