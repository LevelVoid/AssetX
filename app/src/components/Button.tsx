import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing, typography } from "../theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const backgrounds: Record<ButtonVariant, string> = {
  primary: colors.accent,
  secondary: colors.surfaceRaised,
  ghost: "transparent",
  danger: colors.dangerSoft,
};

const textColors: Record<ButtonVariant, string> = {
  primary: colors.accentText,
  secondary: colors.text,
  ghost: colors.accent,
  danger: colors.danger,
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  compact = false,
  icon,
  style,
}: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: backgrounds[variant] },
        variant === "secondary" && styles.secondaryBorder,
        variant === "ghost" && styles.ghostBorder,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: textColors[variant] }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    flexDirection: "row",
  },
  regular: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  compact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostBorder: {
    borderWidth: 1,
    borderColor: "rgba(94, 234, 212, 0.35)",
  },
  inactive: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: "700",
  },
});
