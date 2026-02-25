
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import AdvancedSwap from '../dex/AdvancedSwap';

interface TokenSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenSwapModal({ isOpen, onClose }: TokenSwapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Swap Tokens</CardTitle>
            <div>
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AdvancedSwap />
        </CardContent>
      </Card>
    </div>
  );
}
