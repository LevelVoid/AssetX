import { mplCore } from "@metaplex-foundation/mpl-core";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import { RPC_URL } from "../config";

/** Read-only Umi client used to read Metaplex Core accounts. */
export const umi = createUmi(RPC_URL).use(mplCore());
