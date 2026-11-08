import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork } from "../components/Artwork";
import { AssetCard } from "../components/AssetCard";
import { Badge } from "../components/Badge";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { LoadingView, Screen } from "../components/Screen";
import { WalletButton } from "../components/WalletButton";
import { describeError } from "../lib/errors";
import { shortAddress } from "../lib/format";
import {
  fetchMyListings,
  fetchOwnedAssets,
  resolveListing,
  type OwnedAsset,
} from "../lib/marketplace";
import type { AssetSummary } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { useAppWallet } from "../wallet/context";

export function PortfolioScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { program, publicKey } = useAppWallet();

  const [owned, setOwned] = useState<OwnedAsset[]>([]);
  const [listings, setListings] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!publicKey) {
        setOwned([]);
        setListings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const [assets, activeListings] = await Promise.all([
          fetchOwnedAssets(program, publicKey),
          fetchMyListings(program, publicKey),
        ]);

        const resolved = await Promise.all(
          activeListings.map(async (record) => {
            try {
              return await resolveListing(
                program,
                record.publicKey,
                record.account
              );
            } catch {
              return null;
            }
          })
        );

        setOwned(assets);
        setListings(
          resolved.filter((item): item is AssetSummary => Boolean(item))
        );
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [program, publicKey]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const tickets = useMemo(
    () => owned.filter((asset) => asset.kind === "ticket"),
    [owned]
  );
  const collectibles = useMemo(
    () => owned.filter((asset) => asset.kind === "collectible"),
    [owned]
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>YOUR WALLET</Text>
          <Text style={styles.title}>Portfolio</Text>
          {publicKey ? (
            <Text style={styles.address}>{shortAddress(publicKey.toBase58(), 6)}</Text>
          ) : null}
        </View>
        <WalletButton />
      </View>

      {error ? (
        <Banner kind="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {!publicKey ? (
        <EmptyState
          glyph="◎"
          title="Connect to see your assets"
          message="Connect a Solana wallet to view the tickets and collectibles you own, and to list them for resale."
        >
          <WalletButton />
        </EmptyState>
      ) : null}

      {publicKey && loading && owned.length === 0 && listings.length === 0 ? (
        <LoadingView />
      ) : null}

      {publicKey && listings.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your active listings</Text>
          <View style={styles.list}>
            {listings.map((summary) => (
              <AssetCard
                key={`listing-${summary.asset.toBase58()}`}
                summary={summary}
                onPress={() =>
                  navigation.navigate("AssetDetail", {
                    asset: summary.asset.toBase58(),
                    kind: summary.kind,
                    listing: summary.listing?.toBase58(),
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {publicKey && !loading && owned.length === 0 && listings.length === 0 ? (
        <EmptyState
          glyph="◇"
          title="No assets yet"
          message="Buy a ticket or collectible from the marketplace, or ask a demo issuer to mint one to this wallet."
        />
      ) : null}

      {tickets.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tickets</Text>
          <View style={styles.list}>
            {tickets.map((asset) => (
              <OwnedRow
                key={asset.asset.toBase58()}
                asset={asset}
                onOpen={() =>
                  navigation.navigate("AssetDetail", {
                    asset: asset.asset.toBase58(),
                    kind: "ticket",
                  })
                }
                onList={() =>
                  navigation.navigate("ListAsset", {
                    asset: asset.asset.toBase58(),
                    kind: "ticket",
                    name: asset.name,
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {collectibles.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collectibles</Text>
          <View style={styles.list}>
            {collectibles.map((asset) => (
              <OwnedRow
                key={asset.asset.toBase58()}
                asset={asset}
                onOpen={() =>
                  navigation.navigate("AssetDetail", {
                    asset: asset.asset.toBase58(),
                    kind: "collectible",
                  })
                }
                onList={() =>
                  navigation.navigate("ListAsset", {
                    asset: asset.asset.toBase58(),
                    kind: "collectible",
                    name: asset.name,
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function OwnedRow({
  asset,
  onOpen,
  onList,
}: {
  asset: OwnedAsset;
  onOpen: () => void;
  onList: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Artwork uri={asset.image} label={asset.name} style={styles.thumb} />
      <View style={styles.rowBody}>
        <Badge
          label={asset.kind === "ticket" ? "TICKET" : "COLLECTIBLE"}
          tone={asset.kind === "ticket" ? "ticket" : "collectible"}
        />
        <Text style={styles.rowName} numberOfLines={1}>
          {asset.name}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {asset.subtitle}
        </Text>
      </View>
      <Button title="List" variant="secondary" compact onPress={onList} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  address: {
    ...typography.small,
    color: colors.faint,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.muted,
    textTransform: "uppercase",
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 56,
    height: 64,
    borderRadius: radius.sm,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.small,
    color: colors.muted,
  },
});
