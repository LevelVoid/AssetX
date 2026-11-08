import { Buffer } from "buffer";
import { BN } from "@anchor-lang/core";

import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// web3.js and Anchor assume a Node-style Buffer on React Native.
const globalObject = globalThis as typeof globalThis & { Buffer?: typeof Buffer; BN?: typeof BN };
if (!globalObject.Buffer) {
  globalObject.Buffer = Buffer;
}

// Some Anchor/web3 code may expect BN on global
if (!globalObject.BN) {
  globalObject.BN = BN;
}
