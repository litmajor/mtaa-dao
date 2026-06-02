import React from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OpportunityCardProps {
  opp: any; // accepts ExtendedOpportunity shape
  onView?: (opp: any) => void;
  onExecute?: (opp: any) => void;
  getTypeColor?: (type: string) => string;
  getRiskColor?: (risk: string) => string;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opp, onView, onExecute, getTypeColor, getRiskColor }) => {
  return (
    <Card key={opp.id} className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Symbol</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-bold text-lg text-gray-900 dark:text-white">{opp.symbol}</p>
              {getTypeColor && <Badge className={getTypeColor(opp.type)}>{opp.type.replace('-', ' ')}</Badge>}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Venues</p>
            <div className="mt-1 space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{opp.venue1} → {opp.venue2}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">${opp.price1.toFixed(4)} → ${opp.price2.toFixed(4)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Profit</p>
            <div className="mt-1">
              <p className="font-bold text-lg text-green-600">{opp.effectiveProfit.toFixed(2)}%</p>
              {opp.profitAmount && (<p className="text-xs text-gray-600 dark:text-gray-400">${opp.profitAmount.toFixed(2)}</p>)}
              <p className="text-xs text-gray-500">Net: {opp.netProfit.toFixed(2)}% (est slippage {opp.estimatedSlippage.toFixed(2)}%)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Risk</p>
              {getRiskColor && <Badge className={getRiskColor(opp.risk)}>{opp.risk}</Badge>}
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Confidence</p>
              <p className="font-bold text-gray-900 dark:text-white">{opp.confidence}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Volume</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{(opp.volume / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Updated</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{Math.round(opp.ageSeconds)}s ago</p>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            {opp.executionRecommendation && (
              <div className="space-y-2">
                <Button className="w-full" variant={opp.executionRecommendation.venue === 'dex' ? 'default' : 'outline'} onClick={() => onExecute && onExecute(opp)}>
                  Execute on {opp.executionRecommendation.venue === 'dex' ? opp.executionRecommendation.dex : opp.executionRecommendation.exchange}
                </Button>
                <Button className="w-full" variant="ghost" onClick={() => onView && onView(opp)}>View</Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(OpportunityCard);
