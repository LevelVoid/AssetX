import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { shortAddress } from "../lib/format";
import { describeError } from "../lib/errors";
import { useAppWallet } from "../wallet/context";
import { colors, radius, spacing, typography } from "../theme";

export function WalletButton() {
  const {
    connected,
    connecting,
    publicKey,
    connect,
    disconnect,
    connectError,
  } = useAppWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? connectError;

  const handlePress = async () => {
    setError(null);
    if (connected) {
      await disconnect().catch((cause) => setError(describeError(cause)));
      return;
    }

    setBusy(true);
    try {
      await connect();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || connecting;

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        disabled={pending}
        style={({ pressed }) => [
          styles.button,
          connected ? styles.connected : styles.disconnected,
          (pressed || pending) && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: connected ? colors.success : colors.muted },
          ]}
        />
        <Text
          style={[
            styles.label,
            { color: connected ? colors.text : colors.accentText },
          ]}
        >
          {pending
            ? "Connecting…"
            : connected && publicKey
              ? shortAddress(publicKey.toBase58())
              : "Connect wallet"}
        </Text>
      </Pressable>
      {shownError ? (
        <Text style={styles.error} numberOfLines={2}>
          {shownError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "flex-end",
    gap: spacing.xs,
    maxWidth: 220,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderWidth: 1,
  },
  connected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  disconnected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    ...typography.small,
    fontWeight: "700",
  },
  error: {
    ...typography.small,
    fontSize: 11,
    color: colors.danger,
    textAlign: "right",
  },
});
