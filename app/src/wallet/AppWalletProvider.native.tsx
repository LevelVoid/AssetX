import {
  MobileWalletProvider,
  useMobileWallet,
} from "@wallet-ui/react-native-web3js";
import { Transaction } from "@solana/web3.js";
import React, { useCallback, useState, type ReactNode } from "react";

import { APP_IDENTITY, RPC_URL } from "../config";
import { useAppWalletValue, WalletValueProvider } from "./context";

/** MWA chain identifier; the RPC endpoint stays configurable through EXPO_PUBLIC_RPC_URL. */
const DEVNET_CHAIN = "solana:devnet";

export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <MobileWalletProvider
      chain={DEVNET_CHAIN}
      endpoint={RPC_URL}
      identity={APP_IDENTITY}
      commitmentOrConfig="confirmed"
    >
      <MobileWalletBridge>{children}</MobileWalletBridge>
    </MobileWalletProvider>
  );
}

/**
 * Bridges the Mobile Wallet Adapter into the app-wide wallet context. Android opens the
 * user's wallet app for authorization and every signature.
 */
function MobileWalletBridge({ children }: { children: ReactNode }) {
  const wallet = useMobileWallet();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await wallet.connect();
    } finally {
      setConnecting(false);
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    await wallet.disconnect();
  }, [wallet]);

  const signTransaction = useCallback(
    async (transaction: Transaction) => {
      const signed = await wallet.signTransaction(transaction);
      return (Array.isArray(signed) ? signed[0] : signed) as Transaction;
    },
    [wallet]
  );

  const signAllTransactions = useCallback(
    async (transactions: Transaction[]) => {
      const signed = await wallet.signTransactions(transactions);
      return (Array.isArray(signed) ? signed : [signed]) as Transaction[];
    },
    [wallet]
  );

  const value = useAppWalletValue({
    connection: wallet.connection,
    publicKey: wallet.account?.address ?? null,
    connected: Boolean(wallet.account),
    connecting,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
  });

  return <WalletValueProvider value={value}>{children}</WalletValueProvider>;
}
