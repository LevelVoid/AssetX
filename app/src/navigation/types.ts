import type { AssetKind } from "../lib/types";

/** Route parameters for the authenticated screens of the app. */
export type RootStackParamList = {
  Tabs: undefined;
  AssetDetail: {
    asset: string;
    kind: AssetKind;
    listing?: string;
  };
  ListAsset: {
    asset: string;
    kind: AssetKind;
    name: string;
  };
};

export type TabParamList = {
  Marketplace: undefined;
  Portfolio: undefined;
  Activity: undefined;
  Settings: undefined;
};
