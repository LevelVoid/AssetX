import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge } from "../components/Badge";
import { Banner, type BannerKind } from "../components/Banner";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { LoadingView, Screen } from "../components/Screen";
import { MPL_CORE_ID } from "../config";
import { describeError } from "../lib/errors";
import {
  formatDateTime,
  formatSol,
  formatTimestamp,
  solToLamports,
} from "../lib/format";
import {
  fetchCoreCollection,
  fetchMarketplaceConfig,
  getListingPda,
  getMarketplacePda,
} from "../lib/marketplace";
import type { MarketplaceConfigAccount, TicketAccount } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

export function ListAssetScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ListAsset">>();
  const { program, publicKey } = useAppWallet();

  const [ticket, setTicket] = useState<TicketAccount | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [config, setConfig] = useState<MarketplaceConfigAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const [price, setPrice] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: BannerKind; text: string } | null>(
    null
  );

  const { asset, kind, name } = route.params;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const configAccount = await fetchMarketplaceConfig(program);
        if (!active) return;
        setConfig(configAccount);

        if (kind === "ticket") {
          const ticketAccount = (await (program.account as any).ticket.fetch(
            asset
          )) as TicketAccount;
          if (active) setTicket(ticketAccount);
        } else {
          const collectionAddress = await fetchCoreCollection(
            new PublicKey(asset)
          );
          if (active) setCollection(collectionAddress?.toBase58() ?? null);
        }
      } catch (cause) {
        if (active) setMessage({ kind: "error", text: describeError(cause) });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [program, asset, kind]);

  const priceLamports = useMemo(() => solToLamports(price), [price]);
  const durationDays = Number(days.trim());
  const expiresAt = useMemo(
    () =>
      Math.floor(Date.now() / 1000) +
      (Number.isFinite(durationDays) ? Math.round(durationDays * 86_400) : 0),
    [durationDays]
  );

  const priceError = useMemo(() => {
    if (price.trim() === "") return null;
    if (!priceLamports) return "Enter a valid SOL amount (max 9 decimals).";
    if (priceLamports.isZero()) return "Price must be greater than zero.";
    if (ticket && priceLamports.gt(ticket.maxResalePrice)) {
      return `Above the ${formatSol(ticket.maxResalePrice)} resale cap set by the issuer.`;
    }
    return null;
  }, [price, priceLamports, ticket]);

  const daysError = useMemo(() => {
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      return "Enter a listing duration in days.";
    }
    if (durationDays > 90) return "Use 90 days or less.";
    if (ticket && expiresAt > ticket.transferDeadline.toNumber()) {
      return `Ticket transfers close ${formatDateTime(ticket.transferDeadline)}. Use a shorter duration.`;
    }
    return null;
  }, [durationDays, expiresAt, ticket]);

  const fee = useMemo(
    () =>
      priceLamports && config
        ? priceLamports.muln(config.feeBps).divn(10_000)
        : null,
    [priceLamports, config]
  );

  const canSubmit = Boolean(
    publicKey &&
      priceLamports &&
      !priceError &&
      !daysError &&
      !busy &&
      config &&
      !config.paused
  );

  const submit = useCallback(async () => {
    if (!publicKey || !priceLamports || priceError || daysError) return;
    setBusy(true);
    setMessage(null);

    try {
      const marketplace = getMarketplacePda();
      const assetKey = new PublicKey(asset);
      const listing = getListingPda(assetKey);
      const expiresAtBn = new BN(expiresAt);

      if (kind === "ticket") {
        await program.methods
          .listTicket(priceLamports, expiresAtBn)
          .accountsPartial({
            seller: publicKey,
            marketplace,
            ticket: assetKey,
            listing,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } else {
        await program.methods
          .listCollectible(priceLamports, expiresAtBn)
          .accountsPartial({
            seller: publicKey,
            marketplace,
            asset: assetKey,
            collection: (collection ?? null) as any,
            listing,
            mplCoreProgram: MPL_CORE_ID,
            logWrapper: null as any,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      navigation.goBack();
    } catch (cause) {
      setMessage({ kind: "error", text: describeError(cause) });
    } finally {
      setBusy(false);
    }
  }, [
    publicKey,
    priceLamports,
    priceError,
    daysError,
    expiresAt,
    kind,
    program,
    asset,
    collection,
    navigation,
  ]);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Badge
          label={kind === "ticket" ? "EVENT TICKET" : "DIGITAL COLLECTIBLE"}
          tone={kind === "ticket" ? "ticket" : "collectible"}
        />
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.subtitle}>
          The asset moves into marketplace escrow until it sells or you cancel
          the listing.
        </Text>
      </View>

      {message ? (
        <Banner
          kind={message.kind}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      {loading ? <LoadingView /> : null}

      {ticket ? (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Ticket limits</Text>
          <InfoRow
            label="Resale cap"
            value={formatSol(ticket.maxResalePrice)}
          />
          <InfoRow
            label="Event"
            value={formatTimestamp(ticket.eventTimestamp)}
          />
          <InfoRow
            label="Transfers close"
            value={formatDateTime(ticket.transferDeadline)}
          />
        </View>
      ) : null}

      <Field
        label="Price (SOL)"
        value={price}
        onChangeText={setPrice}
        placeholder={ticket ? formatSol(ticket.maxResalePrice).replace(" SOL", "") : "0.25"}
        keyboardType="decimal-pad"
        error={priceError}
        hint={
          ticket
            ? `Your issuer capped resale at ${formatSol(ticket.maxResalePrice)}.`
            : "Buyer pays this price in native SOL."
        }
      />

      <Field
        label="Listing duration (days)"
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
        error={daysError}
        hint={
          Number.isFinite(durationDays) && durationDays > 0
            ? `Expires ${formatDateTime(expiresAt)}`
            : undefined
        }
      />

      {priceLamports && fee && !priceError ? (
        <View style={styles.settlement}>
          <InfoRow label="Buyer pays" value={formatSol(priceLamports)} />
          <InfoRow
            label={`Marketplace fee (${((config?.feeBps ?? 0) / 100).toFixed(2)}%)`}
            value={formatSol(fee)}
          />
          <InfoRow
            label="You receive"
            value={formatSol(priceLamports.sub(fee))}
          />
        </View>
      ) : null}

      {config?.paused ? (
        <Banner
          kind="warning"
          message="The marketplace is paused, so new listings are disabled."
        />
      ) : null}

      <Button
        title={busy ? "Escrowing asset…" : "Create listing"}
        onPress={() => void submit()}
        loading={busy}
        disabled={!canSubmit}
      />

      <Text style={styles.disclaimer}>
        Your wallet signs the escrow transfer. The listing account can be reused
        after a sale or cancellation. Demo marketplace on Solana Devnet.
      </Text>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    lineHeight: 21,
  },
  infoCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.small,
    color: colors.muted,
  },
  infoValue: {
    ...typography.small,
    color: colors.text,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  settlement: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: "rgba(94, 234, 212, 0.25)",
  },
  disclaimer: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
  },
});
