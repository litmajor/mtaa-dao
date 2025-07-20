import { useState, useEffect } from 'react';
import { estimateCeloGasFee, estimateCUSDGasFee } from '../lib/blockchain';
import { useWallet } from '../pages/hooks/useWallet';
import useToast from '../components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toastTx } from '@/utils/toastTx';
import { isValidCeloAddress } from '@/lib/blockchain';
import { Copy, Loader2 } from 'lucide-react';
import { formatAddress } from '@/lib/blockchain';
import { motion } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SendTransactionModal({ open, onClose }: Props) {
  const { sendTransaction, address, isLoading, refreshBalances } = useWallet();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'CELO' | 'cUSD'>('CELO');
  const [submitting, setSubmitting] = useState(false);
  const [gasFee, setGasFee] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  // Estimate gas fee for CELO/cUSD
  useEffect(() => {
    if (!recipient || !isValidCeloAddress(recipient) || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setGasFee(null);
      return;
    }
    let cancelled = false;
    async function estimate() {
      setEstimating(true);
      let fee = '0';
      try {
        if (currency === 'CELO') {
          fee = await estimateCeloGasFee(recipient, amount);
        } else if (currency === 'cUSD') {
          fee = await estimateCUSDGasFee(recipient, amount);
        } else {
          fee = '~0.001';
        }
      } catch (e) {
        fee = '0';
      }
      if (!cancelled) setGasFee(fee);
      setEstimating(false);
    }
    estimate();
    return () => { cancelled = true; };
  }, [recipient, amount, currency]);

  const handleSend = async () => {
    if (!isValidCeloAddress(recipient)) {
      toast({
        title: 'Invalid address',
        variant: 'destructive',
      });
      return;
    }

    if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
      toast({
        title: 'Enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const txHash = await sendTransaction({ to: recipient, amount, currency });
      toast({
        title: 'Success',
        description: `${currency} sent! Hash: ${txHash.slice(0, 10)}...`,
      });
      setRecipient('');
      setAmount('');
      onClose();
    } catch (err: any) {
      toast({
        title: 'Transaction failed',
        description: err.message || 'Transaction failed',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      refreshBalances();
    }
  };

  const isDisabled = submitting || isLoading || !recipient || !amount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send {currency}</DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Input
            placeholder="Recipient Address (0x...)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={isValidCeloAddress(recipient) ? '' : 'border-destructive'}
          />

          <Input
            placeholder="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="flex gap-2">
            <Button
              variant={currency === 'CELO' ? 'default' : 'outline'}
              onClick={() => setCurrency('CELO')}
            >
              CELO
            </Button>
            <Button
              variant={currency === 'cUSD' ? 'default' : 'outline'}
              onClick={() => setCurrency('cUSD')}
            >
              cUSD
            </Button>
          </div>

          {/* Show gas fee for CELO/cUSD */}
          {recipient && isValidCeloAddress(recipient) && amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
            <div className="text-sm text-gray-600 mb-2">
              {estimating ? 'Estimating gas fee...' : gasFee ? `Estimated Gas Fee: ${gasFee} ${currency}` : 'Could not estimate gas fee'}
            </div>
          )}
          <Button
            disabled={isDisabled}
            onClick={handleSend}
            className="w-full mt-2"
          >
            {submitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            Send
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
