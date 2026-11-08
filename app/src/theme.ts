/** Dark, high-contrast palette shared across native and web. */
export const colors = {
  background: "#070b14",
  surface: "#0f172a",
  surfaceRaised: "#16213a",
  border: "#24324d",
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#64748b",
  accent: "#5eead4",
  accentSoft: "rgba(94, 234, 212, 0.12)",
  accentText: "#042f2e",
  warning: "#fbbf24",
  warningSoft: "rgba(251, 191, 36, 0.12)",
  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.12)",
  success: "#4ade80",
  successSoft: "rgba(74, 222, 128, 0.12)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.6 },
  small: { fontSize: 12, fontWeight: "500" as const },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
