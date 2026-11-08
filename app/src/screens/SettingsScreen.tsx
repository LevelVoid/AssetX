import { useFocusEffect } from "@react-navigation/native";
import { PublicKey } from "@solana/web3.js";
import React, { useCallback, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Banner, type BannerKind } from "../components/Banner";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { LoadingView, Screen } from "../components/Screen";
import { WalletButton } from "../components/WalletButton";
import {
  addressExplorerUrl,
  CLUSTER,
  PROGRAM_ID,
  RPC_URL,
} from "../config";
import { describeError } from "../lib/errors";
import { formatSol, shortAddress } from "../lib/format";
import { fetchMarketplaceConfig, getMarketplacePda } from "../lib/marketplace";
import type { MarketplaceConfigAccount } from "../lib/types";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

const MAX_FEE_BPS = 1_000;

type Message = { kind: BannerKind; text: string };

export function SettingsScreen() {
  const { program, connection, publicKey } = useAppWallet();

  const [config, setConfig] = useState<MarketplaceConfigAccount | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const [treasuryInput, setTreasuryInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const next = await fetchMarketplaceConfig(program);
        setConfig(next);
        setFeeInput(String(next.feeBps));
        setTreasuryInput(next.treasury.toBase58());
        if (publicKey) {
          setBalance(await connection.getBalance(publicKey, "confirmed"));
        } else {
          setBalance(null);
        }
      } catch (cause) {
        setMessage({ kind: "error", text: describeError(cause) });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [program, connection, publicKey]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isAdmin = Boolean(
    publicKey && config && config.authority.equals(publicKey)
  );

  const saveConfig = async (nextPaused: boolean, action: "save" | "toggle") => {
    if (!publicKey || !config) return;
    setMessage(null);

    const fee = Number(feeInput.trim());
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_BPS) {
      setMessage({
        kind: "warning",
        text: `Fee must be a whole number between 0 and ${MAX_FEE_BPS} basis points.`,
      });
      return;
    }

    let treasury: PublicKey;
    try {
      treasury = new PublicKey(treasuryInput.trim());
    } catch {
      setMessage({ kind: "warning", text: "Treasury is not a valid address." });
      return;
    }

    setBusy(action);
    try {
      await program.methods
        .updateMarketplace(fee, treasury, nextPaused)
        .accountsPartial({
          authority: publicKey,
          marketplace: getMarketplacePda(),
        })
        .rpc();

      setMessage({
        kind: "success",
        text: nextPaused
          ? "Marketplace paused. New listings and purchases are blocked."
          : "Marketplace configuration saved and live.",
      });
      await load();
    } catch (cause) {
      setMessage({ kind: "error", text: describeError(cause) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ACCOUNT & NETWORK</Text>
        <Text style={styles.title}>Settings</Text>
      </View>

      {message ? (
        <Banner
          kind={message.kind}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Wallet</Text>
          <WalletButton />
        </View>

        {publicKey ? (
          <View style={styles.stats}>
            <Stat
              label="Address"
              value={shortAddress(publicKey.toBase58(), 6)}
              onPress={() =>
                void Linking.openURL(addressExplorerUrl(publicKey.toBase58()))
              }
            />
            <Stat
              label="Devnet balance"
              value={balance === null ? "Loading…" : formatSol(balance)}
            />
          </View>
        ) : (
          <Text style={styles.muted}>
            Connect a wallet to buy, sell and redeem demo assets. Android uses
            the Mobile Wallet Adapter; the web build uses a browser wallet
            extension.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Marketplace</Text>

        {loading && !config ? (
          <LoadingView />
        ) : config ? (
          <View style={styles.stats}>
            <Stat label="Program" value={shortAddress(PROGRAM_ID.toBase58(), 6)} onPress={() => void Linking.openURL(addressExplorerUrl(PROGRAM_ID.toBase58()))} />
            <Stat label="Cluster" value={CLUSTER} />
            <Stat label="Fee" value={`${(config.feeBps / 100).toFixed(2)}%`} />
            <Stat label="Status" value={config.paused ? "Paused" : "Open"} />
            <Stat
              label="Treasury"
              value={shortAddress(config.treasury.toBase58(), 6)}
              onPress={() =>
                void Linking.openURL(addressExplorerUrl(config.treasury.toBase58()))
              }
            />
            <Stat
              label="Admin"
              value={shortAddress(config.authority.toBase58(), 6)}
              onPress={() =>
                void Linking.openURL(
                  addressExplorerUrl(config.authority.toBase58())
                )
              }
            />
            <Stat label="RPC" value={shortAddress(RPC_URL, 12)} />
          </View>
        ) : (
          <Text style={styles.muted}>
            Marketplace config not found. The program may not be deployed on this
            cluster yet.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Admin controls</Text>
          {isAdmin ? (
            <Text style={styles.adminTag}>AUTHORITY</Text>
          ) : null}
        </View>

        {!isAdmin ? (
          <Text style={styles.muted}>
            Only the marketplace authority can change fees, the treasury or pause
            trading. Read-only configuration is shown above.
          </Text>
        ) : (
          <>
            <Field
              label="Fee (basis points)"
              value={feeInput}
              onChangeText={setFeeInput}
              keyboardType="number-pad"
              hint={`0–${MAX_FEE_BPS} bps · ${MAX_FEE_BPS / 100}% maximum`}
            />
            <Field
              label="Treasury address"
              value={treasuryInput}
              onChangeText={setTreasuryInput}
              hint="Receives the marketplace fee on every sale."
            />
            <View style={styles.adminActions}>
              <Button
                title="Save configuration"
                onPress={() => void saveConfig(config?.paused ?? false, "save")}
                loading={busy === "save"}
                disabled={busy !== null}
              />
              <Button
                title={config?.paused ? "Resume marketplace" : "Pause marketplace"}
                variant={config?.paused ? "primary" : "danger"}
                onPress={() => void saveConfig(!(config?.paused ?? false), "toggle")}
                loading={busy === "toggle"}
                disabled={busy !== null}
              />
            </View>
          </>
        )}
      </View>

      <View style={[styles.card, styles.demoCard]}>
        <Text style={styles.cardTitle}>Demo disclaimer</Text>
        <Text style={styles.muted}>
          AssetX is a Devnet demo. Event tickets, issuers, collectibles and
          their metadata are simulated; no asset represents a real-world claim.
          Never send mainnet SOL to these demo addresses.
        </Text>
      </View>
    </Screen>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, onPress ? styles.statLink : null]}
        onPress={onPress}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoCard: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(251, 191, 36, 0.28)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
  },
  adminTag: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  stats: {
    gap: spacing.sm,
  },
  stat: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statLabel: {
    ...typography.small,
    color: colors.muted,
  },
  statValue: {
    ...typography.small,
    color: colors.text,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  statLink: {
    color: colors.accent,
  },
  muted: {
    ...typography.body,
    color: colors.muted,
    lineHeight: 21,
  },
  adminActions: {
    gap: spacing.sm,
  },
});
