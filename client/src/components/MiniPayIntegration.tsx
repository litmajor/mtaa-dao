import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Smartphone, Wallet, Send, ArrowUpRight, ArrowDownLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  isMiniPay, 
  getMiniPayFeatures, 
  getMiniPayPhoneNumber, 
  connectWallet,
  getBalance,
  getCUSDBalance,
  sendCUSD,
  estimateCUSDGasFee,
  estimateCeloGasFee,
  getWalletClientInstance // Assuming this function exists to get a wallet client instance for sending CELO
} from '../lib/blockchain';

interface MiniPayIntegrationProps {
  onPaymentSuccess?: (txHash: string, amount: string, currency: string) => void;
  onError?: (error: string) => void;
}

export default function MiniPayIntegration({ onPaymentSuccess, onError }: MiniPayIntegrationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [celoBalance, setCeloBalance] = useState<string>('0');
  const [cusdBalance, setCusdBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<'CELO' | 'cUSD'>('cUSD');
  const [estimatedFee, setEstimatedFee] = useState('0');

  const miniPayFeatures = getMiniPayFeatures();

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (sendAmount && sendTo) {
      estimateTransactionFee();
    }
  }, [sendAmount, sendTo, selectedCurrency]);

  const checkConnection = async () => {
    if (isMiniPay()) {
      try {
        // Check if already connected
        const accounts = await window.ethereum?.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setUserAddress(accounts[0]);
          setIsConnected(true);
          await loadBalances(accounts[0]);
          await loadPhoneNumber();
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectMiniPay = async () => {
    setIsLoading(true);
    try {
      const accounts = await connectWallet();
      if (accounts.length > 0) {
        setUserAddress(accounts[0]);
        setIsConnected(true);
        await loadBalances(accounts[0]);
        await loadPhoneNumber();
      }
    } catch (error) {
      console.error('Connection error:', error);
      onError?.('Failed to connect to MiniPay');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalances = async (address: string) => {
    try {
      const [celo, cusd] = await Promise.all([
        getBalance(address),
        getCUSDBalance(address)
      ]);
      setCeloBalance(celo);
      setCusdBalance(cusd);
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadPhoneNumber = async () => {
    try {
      const phone = await getMiniPayPhoneNumber();
      if (phone) {
        setPhoneNumber(phone);
      }
    } catch (error) {
      console.error('Error loading phone number:', error);
    }
  };

  const sendTransaction = async () => {
    if (!sendAmount || !sendTo) return;

    setIsLoading(true);
    try {
      const amount = parseFloat(sendAmount);
      let txHash: string;

      if (selectedCurrency === 'cUSD') {
        txHash = await sendCUSD(sendTo, amount.toString());
      } else {
        // Send CELO (native token)
        const walletClient = getWalletClientInstance();
        const hash = await walletClient.sendTransaction({
          to: sendTo as `0x${string}`,
          value: parseFloat(sendAmount) * 1e18, // Convert to wei
        });
        txHash = hash;
      }

      // Update balances
      await loadBalances(userAddress);

      // Clear form
      setSendAmount('');
      setSendTo('');

      // Call success callback
      onPaymentSuccess?.(txHash, sendAmount, selectedCurrency);

    } catch (error: any) {
      console.error('Transaction failed:', error);
      onError?.(`Transaction failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const estimateTransactionFee = async () => {
    try {
      if (!sendAmount || !sendTo) return;

      let fee: string;
      if (selectedCurrency === 'cUSD') {
        fee = await estimateCUSDGasFee(sendTo, parseFloat(sendAmount));
      } else {
        fee = await estimateCeloGasFee(sendTo, parseFloat(sendAmount));
      }

      setEstimatedFee(fee);
    } catch (error) {
      console.error('Error estimating fee:', error);
      setEstimatedFee('0');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!miniPayFeatures.isMiniPay) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2 justify-center">
            <Smartphone className="h-5 w-5" />
            MiniPay Not Detected
          </CardTitle>
          <CardDescription>
            This feature requires MiniPay wallet. Please open this app in MiniPay to continue.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            MiniPay Wallet
            {isConnected && <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>}
          </CardTitle>
          <CardDescription>
            Secure mobile payments on Celo blockchain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <Button 
              onClick={connectMiniPay} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Connecting...' : 'Connect MiniPay'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Wallet Address</div>
                <div className="font-mono text-sm">{formatAddress(userAddress)}</div>
                {phoneNumber && (
                  <>
                    <div className="text-sm text-gray-600 mt-2">Phone Number</div>
                    <div className="font-mono text-sm">{phoneNumber}</div>
                  </>
                )}
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600">CELO</div>
                  <div className="font-semibold">{parseFloat(celoBalance).toFixed(4)}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600">cUSD</div>
                  <div className="font-semibold">{parseFloat(cusdBalance).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Payment */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Currency Selection */}
            <div className="flex gap-2">
              <Button
                variant={selectedCurrency === 'cUSD' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCurrency('cUSD')}
                className="flex-1"
              >
                cUSD
              </Button>
              <Button
                variant={selectedCurrency === 'CELO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCurrency('CELO')}
                className="flex-1"
              >
                CELO
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Recipient Address</label>
                <Input
                  placeholder="0x..."
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                />
              </div>

              {estimatedFee !== '0' && (
                <div className="p-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-600">Estimated Fee: </span>
                  <span className="font-medium">{parseFloat(estimatedFee).toFixed(6)} CELO</span>
                </div>
              )}

              <Button
                onClick={sendTransaction}
                disabled={!sendAmount || !sendTo || isLoading}
                className="w-full"
              >
                {isLoading ? 'Sending...' : `Send ${selectedCurrency}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">MiniPay Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>cUSD Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Mobile Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Low Fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Fast Transfers</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>CELO Support</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}