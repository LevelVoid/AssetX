import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../theme";

type Props = {
  glyph?: string;
  title: string;
  message?: string;
  children?: React.ReactNode;
};

export function EmptyState({ glyph = "◇", title, message, children }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.glyphCircle}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  glyphCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  glyph: {
    fontSize: 28,
    color: colors.accent,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
  },
  action: {
    marginTop: spacing.md,
  },
});
