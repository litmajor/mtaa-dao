import React, { useState } from 'react';
import PriceImpact from './PriceImpact';

type Props = {
  quote: any;
  fromToken: string;
  toToken: string;
};

export default function ExpandableQuote({ quote, fromToken, toToken }: Props) {
  const [open, setOpen] = useState(false);

  if (!quote) return null;

  return (
    <div className="bg-muted/50 p-4 rounded">
      {/* Compact view */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">You receive</div>
          <div className="font-medium text-lg">{Number(quote?.estimatedToAmount ?? 0).toFixed(6)} {toToken}</div>
        </div>
        <div className="flex items-center gap-3">
          <PriceImpact value={Number(quote?.priceImpact ?? 0)} />
          <button className="text-sm text-blue-600" onClick={() => setOpen((s) => !s)}>
            {open ? 'Collapse' : 'Details'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>Exchange Rate:</span>
            <span className="font-medium">1 {fromToken} = {Number(quote?.exchangeRate ?? 0).toFixed(6)} {toToken}</span>
          </div>
          <div className="flex justify-between">
            <span>Swap Fee:</span>
            <span className="font-medium">{quote?.swapFee ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Bridge Fee:</span>
            <span className="font-medium">{quote?.bridgeFee ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Gas Fee:</span>
            <span className="font-medium">{quote?.estimatedGas ?? '—'}</span>
          </div>
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <div className="mb-1">Route:</div>
            <div>{(quote?.route || []).join(' → ')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
