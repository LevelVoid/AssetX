/**
 * Platform-resolved wallet entry point.
 *
 * Metro picks `AppWalletProvider.native.tsx` on Android/iOS and
 * `AppWalletProvider.web.tsx` in the browser; this file only gives TypeScript a
 * concrete module to resolve.
 */
export { AppWalletProvider } from "./AppWalletProvider.native";
