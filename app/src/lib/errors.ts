/** Turns RPC / wallet errors into a single readable line for banners. */
export function describeError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const anyError = error as {
    message?: unknown;
    error?: { errorMessage?: string; message?: string };
    cause?: { message?: unknown };
  };

  const message = String(
    anyError.error?.errorMessage ??
      anyError.message ??
      anyError.cause?.message ??
      error
  );

  const anchorMatch =
    /Error Code: (\w+)\. Error Number: \d+\. Error Message: ([^\n]*)/.exec(
      message
    );
  if (anchorMatch) {
    const [, code, detail] = anchorMatch;
    return `${humanizeErrorCode(code)} — ${detail}`;
  }

  if (
    /user rejected|rejected the request|declined|cancelled by user|operation cancelled|cancellationexception/i.test(
      message
    )
  ) {
    return "Request cancelled in your wallet.";
  }

  if (/insufficient funds|insufficient lamports/i.test(message)) {
    return "Not enough SOL to pay for this transaction.";
  }

  if (/blockhash not found|block height exceeded/i.test(message)) {
    return "The transaction expired before confirmation. Please try again.";
  }

  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine;
}

const humanizeErrorCode = (code: string) =>
  code.replace(/([a-z])([A-Z])/g, "$1 $2");

export const isWalletRejection = (error: unknown): boolean =>
  /user rejected|rejected the request|declined|cancelled by user/i.test(
    String((error as { message?: unknown })?.message ?? error)
  );
