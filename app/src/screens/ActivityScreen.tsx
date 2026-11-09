import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "../components/Banner";
import { EmptyState } from "../components/EmptyState";
import { LoadingView, Screen } from "../components/Screen";
import { txExplorerUrl } from "../config";
import { describeError } from "../lib/errors";
import { fetchActivity, type ActivityItem } from "../lib/marketplace";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

const activityGlyph = (label: string): string => {
  switch (label) {
    case "Asset sold":
      return "⇄";
    case "New listing":
      return "＋";
    case "Listing cancelled":
      return "－";
    case "Demo ticket issued":
      return "✦";
    case "Ticket redeemed":
      return "✓";
    default:
      return "•";
  }
};

const formatWhen = (blockTime?: number): string => {
  if (!blockTime) return "confirmed";
  return new Date(blockTime * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ACTIVITY_CACHE_MS = 60_000;
let activityCache: { endpoint: string; at: number; items: ActivityItem[] } | null =
  null;

const readActivityCache = (endpoint: string): ActivityItem[] | null => {
  if (
    !activityCache ||
    activityCache.endpoint !== endpoint ||
    Date.now() - activityCache.at > ACTIVITY_CACHE_MS
  ) {
    return null;
  }
  return activityCache.items;
};

const writeActivityCache = (endpoint: string, items: ActivityItem[]) => {
  activityCache = { endpoint, at: Date.now(), items };
};

export function ActivityScreen() {
  const { connection, program } = useAppWallet();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const cached = readActivityCache(connection.rpcEndpoint);
        if (!isRefresh && cached) {
          setItems(cached);
          setLoading(false);
          return;
        }
        const next = await fetchActivity(connection, program, 10);
        writeActivityCache(connection.rpcEndpoint, next);
        setItems(next);
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [connection, program]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ON-CHAIN FEED</Text>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>
          Decoded program events from recent Devnet transactions. Tap an entry to
          open it in the Solana Explorer.
        </Text>
      </View>

      {error ? (
        <Banner kind="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {loading && items.length === 0 ? <LoadingView /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          glyph="≋"
          title="No activity yet"
          message="Listings, sales, redemptions and demo issuances will appear here as the program is used."
        />
      ) : null}

      <View style={styles.feed}>
        {items.map((item, index) => (
          <Pressable
            key={`${item.signature}-${index}`}
            onPress={() => void Linking.openURL(txExplorerUrl(item.signature))}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.glyphCircle}>
              <Text style={styles.glyph}>{activityGlyph(item.label)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowMeta}>
                {item.detail ? `${item.detail} · ` : ""}
                {formatWhen(item.blockTime)}
              </Text>
            </View>
            <Text style={styles.explorer}>↗</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
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
  subtitle: {
    ...typography.body,
    color: colors.muted,
    lineHeight: 22,
  },
  feed: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  glyphCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  glyph: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: "700",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  rowMeta: {
    ...typography.small,
    color: colors.muted,
  },
  explorer: {
    ...typography.body,
    color: colors.faint,
  },
});
