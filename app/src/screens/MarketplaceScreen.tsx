import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AssetCard } from "../components/AssetCard";
import { Banner } from "../components/Banner";
import { EmptyState } from "../components/EmptyState";
import { LoadingView, Screen } from "../components/Screen";
import { WalletButton } from "../components/WalletButton";
import { describeError } from "../lib/errors";
import { fetchActiveListings, resolveListing } from "../lib/marketplace";
import type { AssetSummary } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

type Filter = "all" | "ticket" | "collectible";

const filters: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "ticket", label: "Tickets" },
  { key: "collectible", label: "Collectibles" },
];

export function MarketplaceScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { program } = useAppWallet();

  const [items, setItems] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const records = await fetchActiveListings(program);
        const summaries = await Promise.all(
          records.map(async (record) => {
            try {
              return await resolveListing(
                program,
                record.publicKey,
                record.account
              );
            } catch {
              return null;
            }
          })
        );
        setItems(
          summaries.filter((summary): summary is AssetSummary => Boolean(summary))
        );
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [program]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((item) => item.kind === filter),
    [items, filter]
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentStyle={styles.content}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>SOLANA DEVNET · DEMO MARKET</Text>
            <Text style={styles.title}>AssetX</Text>
          </View>
          <WalletButton />
        </View>
        <Text style={styles.subtitle}>
          A secondary market for transferable event tickets and Metaplex Core
          collectibles, settled atomically in native SOL.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map((entry) => {
          const active = entry.key === filter;
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              onPress={() => setFilter(entry.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
        <Text style={styles.count}>
          {visible.length} live {visible.length === 1 ? "listing" : "listings"}
        </Text>
      </View>

      {error ? (
        <Banner kind="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {loading && items.length === 0 ? <LoadingView /> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          glyph="◇"
          title="No live listings"
          message="Listings appear here as soon as an issuer or collector escrows an asset. Pull down to refresh."
        />
      ) : null}

      <View style={styles.list}>
        {visible.map((summary) => (
          <AssetCard
            key={`${summary.kind}-${summary.asset.toBase58()}`}
            summary={summary}
            onPress={() =>
              navigation.navigate("AssetDetail", {
                asset: summary.asset.toBase58(),
                kind: summary.kind,
                listing: summary.listing?.toBase58(),
              })
            }
          />
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Demo marketplace · all events and collectibles are simulated. Assets are
        real Solana Devnet accounts created by the AssetX program.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(94, 234, 212, 0.5)",
  },
  chipText: {
    ...typography.small,
    fontWeight: "700",
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.accent,
  },
  count: {
    ...typography.small,
    color: colors.faint,
    marginLeft: "auto",
  },
  list: {
    gap: spacing.md,
  },
  disclaimer: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
    paddingTop: spacing.md,
  },
});
