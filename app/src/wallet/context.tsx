import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import idl from "../idl/rwa_exchange.json";

export type SignTransaction = (transaction: Transaction) => Promise<Transaction>;
export type SignAllTransactions = (
  transactions: Transaction[]
) => Promise<Transaction[]>;

export type AppWalletContextValue = {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  /** Last connection error surfaced by a platform wallet provider, if any. */
  connectError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  connection: Connection;
  program: Program;
};

export const AppWalletContext = createContext<AppWalletContextValue | null>(
  null
);

export function useAppWallet(): AppWalletContextValue {
  const context = useContext(AppWalletContext);
  if (!context) {
    throw new Error("useAppWallet must be used inside AppWalletProvider");
  }
  return context;
}

const unsupportedSign = async (transaction: Transaction) => transaction;
const unsupportedSignAll = async (transactions: Transaction[]) =>
  transactions;

export type AppWalletParams = {
  connection: Connection;
  publicKey: PublicKey | null;
  connected?: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction?: SignTransaction | null;
  signAllTransactions?: SignAllTransactions | null;
  connectError?: string | null;
};

/**
 * Builds the shared wallet value: a read-only Anchor program while disconnected and
 * a signing program backed by the platform wallet (MWA on Android, wallet-adapter on web).
 */
export function useAppWalletValue({
  connection,
  publicKey,
  connected,
  connecting,
  connect,
  disconnect,
  signTransaction,
  signAllTransactions,
  connectError,
}: AppWalletParams): AppWalletContextValue {
  const wallet = useMemo<Wallet>(() => {
    if (publicKey && signTransaction && signAllTransactions) {
      return {
        publicKey,
        signTransaction,
        signAllTransactions,
        payer: undefined,
      } as unknown as Wallet;
    }
    return {
      publicKey: PublicKey.default,
      signTransaction: unsupportedSign,
      signAllTransactions: unsupportedSignAll,
      payer: undefined,
    } as unknown as Wallet;
  }, [publicKey, signTransaction, signAllTransactions]);

  const provider = useMemo(
    () =>
      new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }),
    [connection, wallet]
  );

  const program = useMemo(
    () => new Program(idl as any, provider),
    [provider]
  );

  return useMemo(
    () => ({
      publicKey,
      connected: connected ?? Boolean(publicKey),
      connecting,
      connectError: connectError ?? null,
      connect,
      disconnect,
      connection,
      program,
    }),
    [
      publicKey,
      connected,
      connecting,
      connectError,
      connect,
      disconnect,
      connection,
      program,
    ]
  );
}

export function WalletValueProvider({
  value,
  children,
}: {
  value: AppWalletContextValue;
  children: ReactNode;
}) {
  return (
    <AppWalletContext.Provider value={value}>
      {children}
    </AppWalletContext.Provider>
  );
}
