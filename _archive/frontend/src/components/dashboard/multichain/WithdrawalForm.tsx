/**
 * WithdrawalForm Component
 * Handles user input for multichain withdrawal
 * Integrates routing selector and execution flow
 */

import React, { useState, useEffect } from 'react';
import { useMultichainWithdrawal } from '../../hooks/useMultichainWithdrawal';

interface WithdrawalFormProps {
  onSuccess?: (withdrawalId: string) => void;
}

const WithdrawalForm: React.FC<WithdrawalFormProps> = ({ onSuccess }) => {
  const {
    routingOptions,
    selectedRoute,
    getRoutingOptions,
    executeWithdrawal,
    getSupportedChains,
    selectRoute,
    loading,
    error,
    clearError,
  } = useMultichainWithdrawal();

  const [chains, setChains] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    targetChain: 'polygon',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    amount: '100',
    recipientAddress: '',
    priority: 'balanced' as const,
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [executingStep, setExecutingStep] = useState(0);

  // Load supported chains
  useEffect(() => {
    getSupportedChains().then(setChains);
  }, [getSupportedChains]);

  // Get routing options when form changes
  useEffect(() => {
    if (formData.amount && parseFloat(formData.amount) > 0) {
      getRoutingOptions(
        formData.targetChain,
        formData.token,
        formData.amount,
        formData.priority
      );
    }
  }, [formData.amount, formData.targetChain, formData.priority, getRoutingOptions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError();
  };

  const handleExecute = async () => {
    if (!selectedRoute) {
      alert('Please select a routing option');
      return;
    }

    if (!formData.recipientAddress) {
      alert('Please enter recipient address');
      return;
    }

    if (!password) {
      alert('Please enter password to confirm');
      return;
    }

    setExecutingStep(1);
    const result = await executeWithdrawal(
      formData.targetChain,
      formData.token,
      formData.amount,
      formData.recipientAddress,
      selectedRoute.id,
      password
    );

    if (result?.success) {
      setExecutingStep(2);
      onSuccess?.(result.withdrawalId);

      // Reset form
      setTimeout(() => {
        setFormData({
          targetChain: 'polygon',
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: '100',
          recipientAddress: '',
          priority: 'balanced',
        });
        setPassword('');
        setExecutingStep(0);
      }, 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Multi-Chain Withdrawal
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* Target Chain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Chain
          </label>
          <select
            name="targetChain"
            value={formData.targetChain}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {chains.map((chain) => (
              <option key={chain.name} value={chain.name}>
                {chain.name.charAt(0).toUpperCase() + chain.name.slice(1)} ({chain.liquidity.toFixed(2)} ETH)
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount (USDC)
          </label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            placeholder="100"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            name="recipientAddress"
            value={formData.recipientAddress}
            onChange={handleInputChange}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Priority
          </label>
          <div className="flex gap-4">
            {(['cost', 'balanced', 'speed'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFormData((prev) => ({ ...prev, priority: p }))}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  formData.priority === p
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routing Options */}
      {routingOptions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Route
          </h3>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {routingOptions.slice(0, 3).map((route) => (
              <div
                key={route.id}
                onClick={() => selectRoute(route)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedRoute?.id === route.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {route.method === 'direct' ? 'Direct' : route.method === 'bridge' ? 'Bridge' : 'Swap + Bridge'}
                  </span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    route.riskLevel === 'low'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : route.riskLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {route.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${route.totalCostUSD}
                    </div>
                    <div className="text-xs">Cost</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {Math.ceil(route.estimatedTimeSeconds / 60)}m
                    </div>
                    <div className="text-xs">Time</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {(route.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs">Confidence</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Password Confirmation */}
      {selectedRoute && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password Confirmation
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to confirm"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      )}

      {/* Execute Button */}
      <div className="flex gap-4">
        <button
          onClick={handleExecute}
          disabled={!selectedRoute || loading || executingStep > 0}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold text-white transition ${
            !selectedRoute || loading || executingStep > 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
          }`}
        >
          {executingStep === 0 && (loading ? 'Processing...' : 'Execute Withdrawal')}
          {executingStep === 1 && '⏳ Executing...'}
          {executingStep === 2 && '✓ Success! Redirecting...'}
        </button>
      </div>
    </div>
  );
};

export default WithdrawalForm;
