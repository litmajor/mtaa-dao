/**
 * Wallet Connection UI Component
 * 
 * ConnectWallet - Button and modal for wallet connection
 * ChainSwitcher - Multi-chain selection
 */

'use client'; // For Next.js

import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { SUPPORTED_CHAINS, ChainConfig } from '../../server/agent-wallet/networks-config';

/**
 * Connect Wallet Button Component
 */
export const ConnectWalletButton: React.FC<{
  className?: string;
  showBalance?: boolean;
  showFullAddress?: boolean;
  onConnect?: () => void;
}> = ({ className = '', showBalance = true, showFullAddress = false, onConnect }) => {
  const wallet = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = async () => {
    try {
      await wallet.connect();
      setIsOpen(false);
      onConnect?.();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleCopyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (wallet.isConnected && wallet.address) {
    const displayAddress = showFullAddress 
      ? wallet.address 
      : `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    return (
      <div className={`wallet-connected ${className}`}>
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-lg border border-blue-200">
          {/* Wallet Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>

          {/* Address Display with Copy */}
          <div 
            className="wallet-info cursor-pointer hover:bg-white/50 px-2 py-1 rounded transition"
            onClick={handleCopyAddress}
            title="Click to copy address"
          >
            <p className="text-sm font-semibold font-mono text-gray-800 hover:text-blue-600">
              {displayAddress}
            </p>
            {showBalance && wallet.balanceEth !== null && (
              <p className="text-xs text-gray-600">
                💰 {wallet.balanceEth.toFixed(4)} {wallet.chainId === 42220 ? 'CELO' : 'ETH'}
              </p>
            )}
          </div>

          {/* Copy Button / Copied Indicator */}
          <button
            onClick={handleCopyAddress}
            className={`px-2 py-1 rounded text-xs font-semibold transition ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          {/* Disconnect Button */}
          <button
            onClick={() => wallet.disconnect()}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-semibold transition"
            title="Disconnect wallet"
          >
            ✕ Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 font-semibold shadow-md hover:shadow-lg transition ${className}`}
        disabled={wallet.isLoading}
      >
        {wallet.isLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Connecting...
          </span>
        ) : (
          '🔗 Connect Wallet'
        )}
      </button>

      {isOpen && (
        <WalletModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onConnect={handleConnect}
          isLoading={wallet.isLoading}
          error={wallet.error}
        />
      )}
    </>
  );
};

/**
 * Wallet Connection Modal
 */
interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  isLoading: boolean;
  error: string | null;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isLoading,
  error
}) => {
  if (!isOpen) return null;

  const wallets = [
    { 
      name: 'MetaMask', 
      icon: '🦊', 
      id: 'metamask',
      description: 'Most popular Ethereum wallet',
      supported: true,
      integration: 'Native support'
    },
    { 
      name: 'WalletConnect', 
      icon: '📱', 
      id: 'walletconnect',
      description: 'Connect any mobile wallet',
      supported: true,
      integration: 'QR code connection'
    },
    { 
      name: 'Coinbase Wallet', 
      icon: '🏦', 
      id: 'coinbase',
      description: 'Coinbase official wallet',
      supported: true,
      integration: 'Browser extension'
    },
    { 
      name: 'Ledger', 
      icon: '🔐', 
      id: 'ledger',
      description: 'Hardware wallet support',
      supported: true,
      integration: 'USB/Bluetooth'
    },
    { 
      name: 'Magic Link', 
      icon: '✨', 
      id: 'magic',
      description: 'Email-based wallet (Coming soon)',
      supported: false,
      integration: 'OAuth integration'
    },
    { 
      name: 'Gnosis Safe', 
      icon: '🔒', 
      id: 'gnosissafe',
      description: 'Multisig wallet (Coming soon)',
      supported: false,
      integration: 'Smart contract'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">🔗 Connect Your Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl font-light"
            title="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
            <p className="font-semibold">⚠️ Connection Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Supported Wallets */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 uppercase mb-3">✅ Supported Wallets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {wallets.filter(w => w.supported).map(wallet => (
              <WalletOption
                key={wallet.id}
                wallet={wallet}
                onSelect={onConnect}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Coming Soon */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm font-semibold text-gray-600 uppercase mb-3">🚀 Coming Soon</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {wallets.filter(w => !w.supported).map(wallet => (
              <WalletOption
                key={wallet.id}
                wallet={wallet}
                onSelect={onConnect}
                isLoading={isLoading}
                disabled={true}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-600">
          <p className="font-semibold mb-2">💡 What happens next?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your wallet provider will ask for permission to connect</li>
            <li>Your private key stays secure in your wallet</li>
            <li>You'll see your balance and address immediately</li>
            <li>You can switch chains anytime with the chain selector</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Individual Wallet Option Component
 */
interface WalletOptionProps {
  wallet: {
    name: string;
    icon: string;
    id: string;
    description: string;
    supported: boolean;
    integration: string;
  };
  onSelect: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const WalletOption: React.FC<WalletOptionProps> = ({ 
  wallet, 
  onSelect, 
  isLoading,
  disabled = false 
}) => {
  return (
    <button
      onClick={onSelect}
      disabled={isLoading || disabled}
      className={`p-3 rounded-lg border-2 transition flex items-center gap-3 ${
        disabled
          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
          : 'border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'
      }`}
      title={disabled ? 'Coming soon' : `Connect with ${wallet.name}`}
    >
      <span className="text-3xl">{wallet.icon}</span>
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900">{wallet.name}</p>
        <p className="text-xs text-gray-500">{wallet.description}</p>
        <p className="text-xs text-blue-600 mt-1">{wallet.integration}</p>
      </div>
      {isLoading && <span className="animate-spin text-lg">⏳</span>}
      {disabled && <span className="text-gray-400 font-semibold">Coming</span>}
    </button>
  );
};

/**
 * Chain Switcher Component
 */
export const ChainSwitcher: React.FC<{
  className?: string;
  onChainSwitch?: (chainId: number) => void;
}> = ({ className = '', onChainSwitch }) => {
  const wallet = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  if (!wallet.isConnected) {
    return null;
  }

  const currentChain = wallet.chainId
    ? SUPPORTED_CHAINS[wallet.chainId]
    : null;

  const handleSwitchChain = async (chainId: number) => {
    try {
      await wallet.switchChain(chainId);
      setIsOpen(false);
      onChainSwitch?.(chainId);
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-2"
      >
        {currentChain && (
          <>
            {currentChain.logoUrl && (
              <img
                src={currentChain.logoUrl}
                alt={currentChain.name}
                className="w-4 h-4 rounded-full"
              />
            )}
            <span className="text-sm font-semibold">{currentChain.symbol}</span>
          </>
        )}
        <span className="text-xs">▼</span>
      </button>

      {isOpen && (
        <ChainDropdown
          onChainSelect={handleSwitchChain}
          currentChainId={wallet.chainId}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Chain Dropdown Menu
 */
interface ChainDropdownProps {
  onChainSelect: (chainId: number) => void;
  currentChainId: number | null;
  onClose: () => void;
}

export const ChainDropdown: React.FC<ChainDropdownProps> = ({
  onChainSelect,
  currentChainId,
  onClose
}) => {
  const chains = Object.values(SUPPORTED_CHAINS);
  
  // Separate mainnets and testnets
  const mainnets = chains.filter(c => !c.name.includes('Test') && !c.name.includes('Sepolia') && !c.name.includes('Alfajores') && !c.name.includes('Mumbai'));
  const testnets = chains.filter(c => c.name.includes('Test') || c.name.includes('Sepolia') || c.name.includes('Alfajores') || c.name.includes('Mumbai'));

  return (
    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded shadow-lg min-w-64 z-50 max-h-96 overflow-y-auto">
      {/* Mainnets */}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mainnet</p>
        {mainnets.map(chain => (
          <ChainOption
            key={chain.chainId}
            chain={chain}
            isActive={chain.chainId === currentChainId}
            onSelect={() => {
              onChainSelect(chain.chainId);
              onClose();
            }}
          />
        ))}
      </div>

      {/* Testnets */}
      {testnets.length > 0 && (
        <div className="border-t border-gray-200 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Testnet</p>
          {testnets.map(chain => (
            <ChainOption
              key={chain.chainId}
              chain={chain}
              isActive={chain.chainId === currentChainId}
              onSelect={() => {
                onChainSelect(chain.chainId);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Individual Chain Option
 */
interface ChainOptionProps {
  chain: ChainConfig;
  isActive: boolean;
  onSelect: () => void;
}

export const ChainOption: React.FC<ChainOptionProps> = ({
  chain,
  isActive,
  onSelect
}) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center justify-between transition ${
        isActive ? 'bg-blue-50 border-l-4 border-blue-500' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {chain.logoUrl && (
          <img
            src={chain.logoUrl}
            alt={chain.name}
            className="w-5 h-5 rounded-full"
          />
        )}
        <div>
          <p className="text-sm font-semibold">{chain.name}</p>
          <p className="text-xs text-gray-500">{chain.symbol}</p>
        </div>
      </div>
      {isActive && <span className="text-green-500">✓</span>}
    </button>
  );
};

/**
 * Wallet Status Component (Quick Info Display)
 */
export const WalletStatus: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
  const wallet = useWallet();
  const chain = wallet.chainId ? SUPPORTED_CHAINS[wallet.chainId] : null;

  if (!wallet.isConnected) {
    return (
      <div className="p-4 bg-gray-100 rounded text-center text-gray-600">
        Wallet not connected
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded p-4 ${compact ? 'text-sm' : ''}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-600 uppercase font-semibold">Address</p>
          <p className="font-mono text-sm mt-1">
            {wallet.address?.slice(0, 10)}...{wallet.address?.slice(-8)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 uppercase font-semibold">Chain</p>
          <p className="text-sm mt-1 flex items-center gap-2">
            {chain?.logoUrl && (
              <img src={chain.logoUrl} alt={chain?.name} className="w-4 h-4 rounded-full" />
            )}
            {chain?.name || 'Unknown'}
          </p>
        </div>
        {wallet.balanceEth !== null && (
          <div>
            <p className="text-xs text-gray-600 uppercase font-semibold">Balance</p>
            <p className="text-sm mt-1 font-semibold">{wallet.balanceEth.toFixed(4)} {chain?.symbol}</p>
          </div>
        )}
      </div>
    </div>
  );
};
