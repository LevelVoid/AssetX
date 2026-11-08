import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Transaction } from "@solana/web3.js";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { RPC_URL } from "../config";
import { describeError } from "../lib/errors";
import { useAppWalletValue, WalletValueProvider } from "./context";

/**
 * Web does not expose Mobile Wallet Adapter, so the browser build connects to an injected
 * wallet extension (Phantom or Solflare) through the wallet-adapter package.
 */
export function AppWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={() => undefined}>
        <WebWalletBridge>{children}</WebWalletBridge>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function WebWalletBridge({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Selecting a wallet is a state update; connect once wallet-adapter has adopted it.
  useEffect(() => {
    if (!pending || !wallet.wallet || wallet.connected || wallet.connecting) {
      return;
    }

    let cancelled = false;
    setPending(false);
    setConnecting(true);

    wallet
      .connect()
      .catch((cause) => {
        if (!cancelled) setConnectError(describeError(cause));
      })
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pending, wallet]);

  const connect = useCallback(async () => {
    setConnectError(null);

    if (wallet.wallet) {
      setConnecting(true);
      try {
        await wallet.connect();
      } finally {
        setConnecting(false);
      }
      return;
    }

    const preferred =
      wallet.wallets.find(
        (entry) => entry.adapter.readyState === "Installed"
      ) ??
      wallet.wallets.find((entry) => entry.adapter.name === "Phantom") ??
      wallet.wallets[0];

    if (!preferred) {
      const message = "No Solana wallet was found in this browser.";
      setConnectError(message);
      throw new Error(message);
    }

    if (preferred.adapter.readyState === "NotDetected") {
      const message = `${preferred.adapter.name} was not detected. Install the browser extension and reload this page.`;
      setConnectError(message);
      throw new Error(message);
    }

    setPending(true);
    wallet.select(preferred.adapter.name as Parameters<typeof wallet.select>[0]);
  }, [wallet]);

  const disconnect = useCallback(async () => {
    setConnectError(null);
    await wallet.disconnect();
  }, [wallet]);

  const signTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!wallet.signTransaction) {
        throw new Error("The selected wallet cannot sign transactions.");
      }
      return wallet.signTransaction(transaction);
    },
    [wallet]
  );

  const signAllTransactions = useCallback(
    async (transactions: Transaction[]) => {
      if (wallet.signAllTransactions) {
        return wallet.signAllTransactions(transactions);
      }
      return Promise.all(transactions.map((transaction) => signTransaction(transaction)));
    },
    [wallet, signTransaction]
  );

  const value = useAppWalletValue({
    connection,
    publicKey: wallet.publicKey ?? null,
    connected: wallet.connected && Boolean(wallet.publicKey),
    connecting: connecting || wallet.connecting || pending,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    connectError,
  });

  return <WalletValueProvider value={value}>{children}</WalletValueProvider>;
}
