import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";

import { colors, radius } from "../theme";

const svgCache = new Map<string, Promise<string | null>>();

const downloadSvg = (uri: string): Promise<string | null> => {
  const cached = svgCache.get(uri);
  if (cached) return cached;

  const request = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(uri, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) return null;
      const text = await response.text();
      return text.includes("<svg") ? text : null;
    } catch {
      return null;
    }
  })();

  svgCache.set(uri, request);
  return request;
};

type Props = {
  uri?: string | null;
  label: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders demo artwork. Metadata served from the repository is SVG, which React Native's
 * Image cannot display, so SVG files are fetched once and rendered with react-native-svg.
 */
export function Artwork({ uri, label, style }: Props) {
  const isSvg = Boolean(uri && /\.svg(\?|#|$)/i.test(uri));
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setFailed(false);

    if (!uri || !isSvg) return;

    void downloadSvg(uri).then((text) => {
      if (!active) return;
      if (text) setSvg(text);
      else setFailed(true);
    });

    return () => {
      active = false;
    };
  }, [uri, isSvg]);

  const showImage = Boolean(uri) && !isSvg && !failed;
  const initial = (label.trim()[0] ?? "?").toUpperCase();

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.surfaceRaised, "#0a1020"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.placeholder}
      >
        <Text style={styles.initial}>{initial}</Text>
      </LinearGradient>

      {svg ? (
        <View style={styles.fill} pointerEvents="none">
          <SvgXml xml={svg} width="100%" height="100%" />
        </View>
      ) : null}

      {showImage ? (
        <Image
          source={{ uri: uri ?? undefined }}
          style={styles.fill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 34,
    fontWeight: "800",
    color: "rgba(94, 234, 212, 0.35)",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
});
