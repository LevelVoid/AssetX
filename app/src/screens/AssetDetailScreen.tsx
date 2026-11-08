import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchAsset } from "@metaplex-foundation/mpl-core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Artwork } from "../components/Artwork";
import { Badge } from "../components/Badge";
import { Banner, type BannerKind } from "../components/Banner";
import { Button } from "../components/Button";
import { LoadingView, Screen } from "../components/Screen";
import { MPL_CORE_ID } from "../config";
import { describeError } from "../lib/errors";
import {
  formatDateTime,
  formatSol,
  shortAddress,
  timeLeft,
  formatTimestamp,
} from "../lib/format";
import {
  collectibleSummary,
  fetchListing,
  fetchMarketplaceConfig,
  getListingPda,
  getMarketplacePda,
  ticketSummary,
} from "../lib/marketplace";
import { umi } from "../lib/umi";
import type {
  AssetKind,
  AssetSummary,
  IssuerAccount,
  ListingAccount,
  MarketplaceConfigAccount,
  TicketAccount,
} from "../lib/types";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

type Detail = {
  asset: PublicKey;
  kind: AssetKind;
  summary: AssetSummary;
  ticket: TicketAccount | null;
  issuerAuthority: PublicKey | null;
  coreOwner: PublicKey | null;
  listing: { address: PublicKey; account: ListingAccount } | null;
};

type Action = "buy" | "cancel" | "redeem";

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function AssetDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AssetDetail">>();
  const { program, connection, publicKey } = useAppWallet();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [config, setConfig] = useState<MarketplaceConfigAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: BannerKind; text: string } | null>(
    null
  );

  const { asset, kind, listing: listingParam } = route.params;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const assetKey = new PublicKey(asset);
        const configAccount = await fetchMarketplaceConfig(program);
        setConfig(configAccount);

        let listingAddress: PublicKey | null = listingParam
          ? new PublicKey(listingParam)
          : null;
        let listingAccount: ListingAccount | null = null;

        if (listingAddress) {
          listingAccount = await fetchListing(program, listingAddress).catch(
            () => null
          );
        } else {
          const candidate = getListingPda(assetKey);
          const info = await connection.getAccountInfo(candidate);
          if (info) {
            listingAddress = candidate;
            listingAccount = await fetchListing(program, candidate).catch(
              () => null
            );
          }
        }

        const record =
          listingAccount && listingAddress
            ? { publicKey: listingAddress, account: listingAccount }
            : undefined;

        let summary: AssetSummary;
        let ticket: TicketAccount | null = null;
        let issuerAuthority: PublicKey | null = null;
        let coreOwner: PublicKey | null = null;

        if (kind === "ticket") {
          ticket = (await (program.account as any).ticket.fetch(
            assetKey
          )) as TicketAccount;
          summary = await ticketSummary(ticket, assetKey, record);
          try {
            const issuer = (await (program.account as any).issuer.fetch(
              ticket.issuer
            )) as IssuerAccount;
            issuerAuthority = issuer.authority;
          } catch {
            issuerAuthority = null;
          }
        } else {
          const core = await fetchAsset(umi, assetKey.toBase58());
          coreOwner = new PublicKey(core.owner);
          summary = await collectibleSummary(assetKey, record);
        }

        setDetail({
          asset: assetKey,
          kind,
          summary,
          ticket,
          issuerAuthority,
          coreOwner,
          listing:
            listingAccount && listingAddress
              ? { address: listingAddress, account: listingAccount }
              : null,
        });
        setConfirming(false);
      } catch (cause) {
        setMessage({ kind: "error", text: describeError(cause) });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [program, connection, asset, kind, listingParam]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: Action) => {
    if (!publicKey || !detail || !config) return;
    setBusy(action);
    setMessage(null);

    try {
      const marketplace = getMarketplacePda();

      if (action === "buy" && detail.listing) {
        if (detail.kind === "ticket") {
          await program.methods
            .buyTicket()
            .accountsPartial({
              buyer: publicKey,
              marketplace,
              ticket: detail.asset,
              seller: detail.listing.account.seller,
              treasury: config.treasury,
              listing: detail.listing.address,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        } else {
          await program.methods
            .buyCollectible()
            .accountsPartial({
              buyer: publicKey,
              marketplace,
              asset: detail.asset,
              collection: (detail.summary.collection ?? null) as any,
              seller: detail.listing.account.seller,
              treasury: config.treasury,
              listing: detail.listing.address,
              mplCoreProgram: MPL_CORE_ID,
              logWrapper: null as any,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        }
        setMessage({
          kind: "success",
          text: "Purchase confirmed on Devnet. The asset is now in your wallet.",
        });
      } else if (action === "cancel" && detail.listing) {
        if (detail.kind === "ticket") {
          await program.methods
            .cancelTicketListing()
            .accountsPartial({
              seller: publicKey,
              marketplace,
              ticket: detail.asset,
              listing: detail.listing.address,
            })
            .rpc();
        } else {
          await program.methods
            .cancelCollectibleListing()
            .accountsPartial({
              seller: publicKey,
              marketplace,
              asset: detail.asset,
              collection: (detail.summary.collection ?? null) as any,
              listing: detail.listing.address,
              mplCoreProgram: MPL_CORE_ID,
              logWrapper: null as any,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        }
        setMessage({
          kind: "success",
          text: "Listing cancelled and the asset returned to your wallet.",
        });
      } else if (action === "redeem" && detail.ticket && detail.issuerAuthority) {
        await program.methods
          .redeemTicket()
          .accountsPartial({
            authority: publicKey,
            issuer: detail.ticket.issuer,
            ticket: detail.asset,
          })
          .rpc();
        setMessage({
          kind: "success",
          text: "Ticket redeemed. It can no longer be listed or resold.",
        });
      }

      setConfirming(false);
      await load();
    } catch (cause) {
      setMessage({ kind: "error", text: describeError(cause) });
    } finally {
      setBusy(null);
    }
  };

  if (loading && !detail) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <Banner
          kind="error"
          message={message?.text ?? "Asset could not be loaded."}
        />
      </Screen>
    );
  }

  const { summary, ticket } = detail;
  const listing = detail.listing;
  const price = listing?.account.priceLamports ?? null;
  const fee =
    price && config ? price.muln(config.feeBps).divn(10_000) : null;
  const sellerReceives = price && fee ? price.sub(fee) : null;

  const wallet = publicKey?.toBase58();
  const isSeller = Boolean(
    wallet && listing && listing.account.seller.toBase58() === wallet
  );
  const owner = ticket?.owner ?? detail.coreOwner;
  const isOwner = Boolean(wallet && owner && owner.toBase58() === wallet);
  const isIssuer = Boolean(
    wallet && detail.issuerAuthority?.toBase58() === wallet
  );

  const expired = Boolean(
    listing && listing.account.expiresAt.toNumber() <= nowSeconds()
  );
  const transferClosed = Boolean(
    ticket && ticket.transferDeadline.toNumber() <= nowSeconds()
  );
  const cancelled = Boolean(ticket?.redeemed);

  const buyBlocked = !publicKey
    ? "Connect a wallet to buy."
    : !config || config.paused
      ? "The marketplace is paused."
      : isSeller
        ? "You already own this listing."
        : expired
          ? "This listing has expired; the seller can cancel it."
          : cancelled
            ? "This ticket has been redeemed."
            : transferClosed
              ? "The ticket transfer window has closed."
              : null;

  const canList = Boolean(
    publicKey &&
      isOwner &&
      !listing &&
      !expired &&
      !cancelled &&
      !transferClosed &&
      config &&
      !config.paused
  );

  const canRedeem = Boolean(
    publicKey && isIssuer && ticket && !ticket.redeemed && !listing
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentStyle={styles.content}
    >
      <Artwork uri={summary.image} label={summary.name} style={styles.hero} />

      <View style={styles.titleBlock}>
        <View style={styles.badgeRow}>
          <Badge
            label={detail.kind === "ticket" ? "EVENT TICKET" : "DIGITAL COLLECTIBLE"}
            tone={detail.kind === "ticket" ? "ticket" : "collectible"}
          />
          {listing ? (
            <Badge label="FOR SALE" tone="success" />
          ) : cancelled ? (
            <Badge label="REDEEMED" tone="warning" />
          ) : null}
        </View>
        <Text style={styles.name}>{summary.name}</Text>
        <Text style={styles.subtitle}>{summary.subtitle}</Text>
      </View>

      {message ? (
        <Banner
          kind={message.kind}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      {listing && price ? (
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>ASKING PRICE</Text>
              <Text style={styles.price}>{formatSol(price)}</Text>
            </View>
            <View style={styles.priceMeta}>
              <Text style={styles.priceLabel}>EXPIRES</Text>
              <Text style={styles.priceMetaValue}>
                {timeLeft(listing.account.expiresAt)}
              </Text>
            </View>
          </View>

          <View style={styles.settlement}>
            <SettlementRow
              label={`Marketplace fee (${((config?.feeBps ?? 0) / 100).toFixed(2)}%)`}
              value={fee ? formatSol(fee) : "—"}
            />
            <SettlementRow
              label="Seller receives"
              value={sellerReceives ? formatSol(sellerReceives) : "—"}
            />
            <SettlementRow
              label="Seller"
              value={shortAddress(listing.account.seller.toBase58(), 5)}
            />
          </View>

          {isSeller ? (
            <Button
              title="Cancel listing"
              variant="secondary"
              loading={busy === "cancel"}
              disabled={busy !== null}
              onPress={() => void run("cancel")}
            />
          ) : (
            <Button
              title={
                confirming
                  ? `Confirm purchase · ${formatSol(price)}`
                  : buyBlocked ?? `Buy now · ${formatSol(price)}`
              }
              loading={busy === "buy"}
              disabled={Boolean(buyBlocked) || busy !== null}
              onPress={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                void run("buy");
              }}
            />
          )}
          {confirming && !buyBlocked ? (
            <Text style={styles.confirmHint}>
              Tap the button again to sign the purchase in your wallet.
            </Text>
          ) : null}
        </View>
      ) : null}

      {!listing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ownership</Text>
          <DetailRow
            label="Owner"
            value={
              owner
                ? publicKey && owner.equals(publicKey)
                  ? "You"
                  : shortAddress(owner.toBase58(), 5)
                : "—"
            }
          />
          {isOwner ? (
            canList ? (
              <Button
                title="List for resale"
                onPress={() =>
                  navigation.navigate("ListAsset", {
                    asset: detail.asset.toBase58(),
                    kind: detail.kind,
                    name: summary.name,
                  })
                }
              />
            ) : (
              <Text style={styles.muted}>
                {cancelled
                  ? "Redeemed tickets cannot be listed."
                  : transferClosed
                    ? "The transfer window for this ticket has closed."
                    : config?.paused
                      ? "Listing is disabled while the marketplace is paused."
                      : "This asset already has an active listing."}
              </Text>
            )
          ) : null}
        </View>
      ) : null}

      {ticket ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ticket details</Text>
          <DetailRow label="Seat category" value={ticket.seatCategory} />
          <DetailRow
            label="Event date"
            value={formatTimestamp(ticket.eventTimestamp)}
          />
          <DetailRow
            label="Transfer deadline"
            value={formatDateTime(ticket.transferDeadline)}
          />
          <DetailRow
            label="Resale cap"
            value={formatSol(ticket.maxResalePrice)}
          />
          <DetailRow label="Redeemed" value={ticket.redeemed ? "Yes" : "No"} />
          <DetailRow
            label="Issuer"
            value={shortAddress(ticket.issuer.toBase58(), 5)}
          />
          {canRedeem ? (
            <Button
              title="Redeem ticket (issuer)"
              variant="secondary"
              loading={busy === "redeem"}
              disabled={busy !== null}
              onPress={() => void run("redeem")}
            />
          ) : null}
        </View>
      ) : null}

      {summary.metadata?.description ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.muted}>{summary.metadata.description}</Text>
          {(summary.metadata.attributes ?? []).length > 0 ? (
            <View style={styles.attributes}>
              {summary.metadata.attributes?.map((attribute) => (
                <View
                  key={`${attribute.trait_type}-${attribute.value}`}
                  style={styles.attribute}
                >
                  <Text style={styles.attributeLabel}>
                    {attribute.trait_type}
                  </Text>
                  <Text style={styles.attributeValue}>{attribute.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>On-chain</Text>
        <DetailRow
          label="Asset"
          value={shortAddress(detail.asset.toBase58(), 6)}
          onPress={() =>
            void Linking.openURL(
              `https://explorer.solana.com/address/${detail.asset.toBase58()}?cluster=devnet`
            )
          }
        />
        {listing ? (
          <DetailRow
            label="Listing"
            value={shortAddress(listing.address.toBase58(), 6)}
            onPress={() =>
              void Linking.openURL(
                `https://explorer.solana.com/address/${listing.address.toBase58()}?cluster=devnet`
              )
            }
          />
        ) : null}
        {summary.collection ? (
          <DetailRow
            label="Collection"
            value={shortAddress(summary.collection.toBase58(), 6)}
            onPress={() =>
              void Linking.openURL(
                `https://explorer.solana.com/address/${summary.collection?.toBase58()}?cluster=devnet`
              )
            }
          />
        ) : null}
      </View>

      <Text style={styles.disclaimer}>
        Demo asset · simulated real-world item on Solana Devnet. Transfers settle
        atomically in native SOL through the RWA Exchange program.
      </Text>
    </Screen>
  );
}

function DetailRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, onPress ? styles.link : null]}
        onPress={onPress}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function SettlementRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settlementRow}>
      <Text style={styles.settlementLabel}>{label}</Text>
      <Text style={styles.settlementValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  hero: {
    width: "100%",
    height: 240,
    borderRadius: radius.lg,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  priceCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: "rgba(94, 234, 212, 0.25)",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  priceLabel: {
    ...typography.label,
    color: colors.muted,
    fontSize: 10,
  },
  price: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: -0.5,
  },
  priceMeta: {
    alignItems: "flex-end",
  },
  priceMetaValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  settlement: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  settlementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settlementLabel: {
    ...typography.small,
    color: colors.muted,
  },
  settlementValue: {
    ...typography.small,
    color: colors.text,
    fontWeight: "700",
  },
  confirmHint: {
    ...typography.small,
    color: colors.faint,
    textAlign: "center",
  },
  card: {
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.small,
    color: colors.muted,
  },
  detailValue: {
    ...typography.small,
    color: colors.text,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  link: {
    color: colors.accent,
  },
  muted: {
    ...typography.body,
    color: colors.muted,
    lineHeight: 21,
  },
  attributes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  attribute: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 1,
  },
  attributeLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.faint,
  },
  attributeValue: {
    ...typography.small,
    fontSize: 11,
    color: colors.text,
    fontWeight: "700",
  },
  disclaimer: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
  },
});
