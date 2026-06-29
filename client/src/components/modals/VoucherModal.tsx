import React, { Suspense } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const GiftCardVoucher = React.lazy(() => import('@/components/wallet/GiftCardVoucher'));

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoucherModal({ isOpen, onClose }: VoucherModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-slate-900 border-slate-800 text-white">
        <div className="max-h-[85vh] overflow-y-auto">
          <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Vouchers...</div>}>
            <div className="p-4 md:p-6">
              <GiftCardVoucher />
            </div>
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}
