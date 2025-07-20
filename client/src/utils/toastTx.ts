import { useToastStore } from "@/lib/stores/ToastStore";
import React from "react";
const getExplorerUrl = (txHash: string): string => {
  const baseUrl = "https://explorer.celo.org/alfajores"; // or mainnet if needed
  return `${baseUrl}/tx/${txHash}`;
};

export const toastTx = async <T>(
  promise: Promise<T>,
  {
    loading = "Sending transaction...",
    success = "Transaction sent!",
    error = "Something went wrong",
    txHash,
  }: {
    loading?: string;
    success?: string;
    error?: string;
    txHash?: string;
  }
): Promise<T> => {
  useToastStore.getState().fire({
    type: "loading",
    title: loading,
  });

  try {
    const result = await promise;

    if (txHash) {
      useToastStore.getState().fire({
        type: "success",
        title: success,
        description: `View on Explorer: ${getExplorerUrl(txHash)}`,
      });
    } else {
      useToastStore.getState().fire({ type: "success", title: success });
    }

    return result;
  } catch (err: any) {
    console.error("Tx error:", err);
    useToastStore.getState().fire({
      type: "error",
      title: error,
      description: err?.message || "Unknown error",
    });
    throw err;
  }
};