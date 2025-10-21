
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '../ui/use-toast';
import { Users, Plus, Minus, Send } from 'lucide-react';

interface Participant {
  id: string;
  username: string;
  share: string;
}

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export default function SplitBillModal({ isOpen, onClose, userAddress }: SplitBillModalProps) {
  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', username: '', share: '' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addParticipant = () => {
    setParticipants([...participants, { id: Date.now().toString(), username: '', share: '' }]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const updateParticipant = (id: string, field: 'username' | 'share', value: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const splitEqually = () => {
    if (!totalAmount || participants.length === 0) return;
    const equalShare = (parseFloat(totalAmount) / participants.length).toFixed(2);
    setParticipants(participants.map(p => ({ ...p, share: equalShare })));
  };

  const handleCreateSplit = async () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      toast({ title: 'Error', description: 'Please enter valid total amount', variant: 'destructive' });
      return;
    }

    const validParticipants = participants.filter(p => p.username && parseFloat(p.share) > 0);
    if (validParticipants.length === 0) {
      toast({ title: 'Error', description: 'Add at least one participant with valid share', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet/split-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAddress: userAddress,
          totalAmount,
          description,
          participants: validParticipants
        })
      });

      if (!response.ok) throw new Error('Failed to create split bill');

      toast({
        title: 'Split Bill Created',
        description: `Payment requests sent to ${validParticipants.length} participants`
      });

      setTotalAmount('');
      setDescription('');
      setParticipants([{ id: '1', username: '', share: '' }]);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create split bill',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Split Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Dinner at restaurant"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="total">Total Amount</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                placeholder="100.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={splitEqually} variant="outline">
                Split Equally
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Participants</Label>
              <Button onClick={addParticipant} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {participants.map((participant, index) => (
              <div key={participant.id} className="flex gap-2 items-center">
                <span className="text-sm font-medium w-6">{index + 1}.</span>
                <Input
                  placeholder="@username"
                  value={participant.username}
                  onChange={(e) => updateParticipant(participant.id, 'username', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={participant.share}
                  onChange={(e) => updateParticipant(participant.id, 'share', e.target.value)}
                  className="w-32"
                />
                {participants.length > 1 && (
                  <Button
                    onClick={() => removeParticipant(participant.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Total:</span>
              <span className="font-medium">{totalAmount || '0.00'} cUSD</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Allocated:</span>
              <span className="font-medium">
                {participants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0).toFixed(2)} cUSD
              </span>
            </div>
          </div>

          <Button onClick={handleCreateSplit} disabled={isLoading} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            {isLoading ? 'Creating...' : 'Create Split Bill'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
