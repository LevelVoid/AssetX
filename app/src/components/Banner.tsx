import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme";

export type BannerKind = "info" | "success" | "warning" | "error";

const palette: Record<
  BannerKind,
  { background: string; border: string; text: string }
> = {
  info: {
    background: colors.accentSoft,
    border: "rgba(94, 234, 212, 0.3)",
    text: colors.accent,
  },
  success: {
    background: colors.successSoft,
    border: "rgba(74, 222, 128, 0.3)",
    text: colors.success,
  },
  warning: {
    background: colors.warningSoft,
    border: "rgba(251, 191, 36, 0.3)",
    text: colors.warning,
  },
  error: {
    background: colors.dangerSoft,
    border: "rgba(248, 113, 113, 0.3)",
    text: colors.danger,
  },
};

type Props = {
  kind: BannerKind;
  message: string;
  onDismiss?: () => void;
};

export function Banner({ kind, message, onDismiss }: Props) {
  const colorsForKind = palette[kind];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorsForKind.background,
          borderColor: colorsForKind.border,
        },
      ]}
    >
      <Text style={[styles.message, { color: colorsForKind.text }]}>
        {message}
      </Text>
      {onDismiss ? (
        <Pressable
          accessibilityLabel="Dismiss message"
          hitSlop={10}
          onPress={onDismiss}
        >
          <Text style={[styles.dismiss, { color: colorsForKind.text }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  message: {
    ...typography.small,
    flex: 1,
    lineHeight: 17,
  },
  dismiss: {
    fontSize: 14,
    fontWeight: "700",
  },
});
