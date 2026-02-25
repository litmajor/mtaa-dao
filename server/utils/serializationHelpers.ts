/**
 * Serialization Helpers
 * Safely serialize ethers.js objects, BigInt values, and circular references
 */

/**
 * Deep serialize an object, converting BigInt to strings and filtering ethers objects
 */
export function serializeTransaction(tx: any): any {
  if (!tx) return null;

  // Handle null/undefined
  if (tx === null || tx === undefined) return null;

  // Handle BigInt
  if (typeof tx === 'bigint') {
    return tx.toString();
  }

  // Handle primitive types
  if (typeof tx !== 'object') {
    return tx;
  }

  // Handle Date
  if (tx instanceof Date) {
    return tx.toISOString();
  }

  // Handle arrays
  if (Array.isArray(tx)) {
    return tx.map(item => serializeTransaction(item));
  }

  // Track visited objects to avoid circular references
  const visited = new WeakSet();
  
  return deepSerialize(tx, visited);
}

function deepSerialize(obj: any, visited: WeakSet<any>): any {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'bigint') return obj.toString();
    return obj;
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return '[Circular]';
  }
  visited.add(obj);

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item, visited));
  }

  // Handle ethers.js objects and classes with their own toString properties
  if (obj._isSigner || obj._isProvider || obj.ens) {
    // Skip ethers signer/provider objects
    return null;
  }

  // Handle plain objects
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip internal properties
    if (key.startsWith('_') || key.startsWith('provider') || key.startsWith('signer')) {
      continue;
    }

    if (typeof value === 'bigint') {
      result[key] = value.toString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'function') {
      continue; // Skip functions
    } else if (typeof value === 'object' && value !== null) {
      result[key] = deepSerialize(value, visited);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Serialize vault deposit/withdraw response
 */
export function serializeVaultResponse(data: any): any {
  return {
    success: true,
    data: {
      vaultId: data.vaultId || data.id,
      amount: serializeNumeric(data.amount),
      shares: serializeNumeric(data.shares),
      sharePrice: serializeNumeric(data.sharePrice),
      currentValue: serializeNumeric(data.currentValue),
      profitLoss: serializeNumeric(data.profitLoss),
      withdrawAmount: serializeNumeric(data.withdrawAmount),
      timestamp: new Date().toISOString(),
      txHash: data.txHash || null,
    },
  };
}

/**
 * Serialize numeric values (handle BigInt and numbers)
 */
export function serializeNumeric(value: any): string {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Safe JSON stringify with BigInt support
 */
export function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}
