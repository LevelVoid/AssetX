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

// The `buffer` polyfill used by React Native inherits `subarray` from
// Uint8Array, so slicing a Buffer returns a plain Uint8Array. Anchor's Borsh
// layouts slice account data and then call Node Buffer methods such as
// `readUIntLE`, which fails on Hermes with "undefined is not a function".
// Restore Node's Buffer-returning `subarray` behaviour.
const bufferPrototype = Buffer.prototype as unknown as {
  subarray: (start?: number, end?: number) => Uint8Array;
};
const originalSubarray = bufferPrototype.subarray;
bufferPrototype.subarray = function (
  this: Buffer,
  start?: number,
  end?: number
): Uint8Array {
  const view = originalSubarray.call(this, start, end);
  if (Buffer.isBuffer(view)) return view;
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
} as typeof bufferPrototype.subarray;
