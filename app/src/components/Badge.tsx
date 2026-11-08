import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme";

type Tone = "ticket" | "collectible" | "success" | "warning" | "muted";

const tones: Record<Tone, { background: string; text: string }> = {
  ticket: { background: colors.accentSoft, text: colors.accent },
  collectible: { background: "rgba(129, 140, 248, 0.14)", text: "#a5b4fc" },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  muted: { background: colors.surfaceRaised, text: colors.muted },
};

type Props = {
  label: string;
  tone?: Tone;
};

export function Badge({ label, tone = "muted" }: Props) {
  const palette = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
