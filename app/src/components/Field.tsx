import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing, typography } from "../theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  editable = true,
  hint,
  error,
  maxLength,
  style,
}: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        editable={editable}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          error ? styles.inputError : null,
        ]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    textTransform: "uppercase",
    color: colors.muted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  inputDisabled: {
    color: colors.muted,
    backgroundColor: colors.surfaceRaised,
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    ...typography.small,
    color: colors.faint,
  },
  error: {
    ...typography.small,
    color: colors.danger,
  },
});
