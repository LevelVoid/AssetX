import { Buffer } from "buffer";

import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// web3.js and Anchor assume a Node-style Buffer on React Native.
const globalObject = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!globalObject.Buffer) {
  globalObject.Buffer = Buffer;
}
