import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatSol, timeLeft } from "../lib/format";
import type { AssetSummary } from "../lib/types";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { Artwork } from "./Artwork";
import { Badge } from "./Badge";

type Props = {
  summary: AssetSummary;
  onPress: () => void;
};

export function AssetCard({ summary, onPress }: Props) {
  const isTicket = summary.kind === "ticket";
  const eventDate = summary.ticket
    ? new Date(summary.ticket.eventTimestamp.toNumber() * 1000)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Artwork uri={summary.image} label={summary.name} style={styles.artwork} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge
            label={isTicket ? "TICKET" : "COLLECTIBLE"}
            tone={isTicket ? "ticket" : "collectible"}
          />
          {summary.expiresAt ? (
            <Text style={styles.expiry}>{timeLeft(summary.expiresAt)}</Text>
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {summary.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {eventDate
            ? `${summary.subtitle} · ${eventDate.toLocaleDateString()}`
            : summary.subtitle}
        </Text>

        <View style={styles.bottomRow}>
          {summary.priceLamports ? (
            <Text style={styles.price}>{formatSol(summary.priceLamports)}</Text>
          ) : (
            <Text style={styles.muted}>Not listed</Text>
          )}
          <Text style={styles.view}>View →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.85,
  },
  artwork: {
    width: 96,
    height: 112,
  },
  body: {
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expiry: {
    ...typography.small,
    color: colors.faint,
  },
  name: {
    ...typography.heading,
    color: colors.text,
    lineHeight: 21,
  },
  subtitle: {
    ...typography.small,
    color: colors.muted,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing.xs,
  },
  price: {
    ...typography.heading,
    color: colors.accent,
  },
  muted: {
    ...typography.small,
    color: colors.faint,
  },
  view: {
    ...typography.small,
    color: colors.muted,
    fontWeight: "700",
  },
});
