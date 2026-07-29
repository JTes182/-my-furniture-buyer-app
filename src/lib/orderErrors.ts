// Turns a structured order-placement error code into plain language with a
// concrete next step, instead of surfacing a raw message directly to the
// user. Shared between the AI assistant's confirm flow and the regular
// product-card purchase flow, since both call the same /api/orders/live
// route and can hit the same error cases.
//
// Two distinct "not enough money" cases, deliberately not merged:
//   - personal_allowance_exceeded: this user's own local spending cap
//     (User.budget) was hit. /api/orders/live already constructs a
//     specific, friendly message with real numbers for this — shown as-is,
//     not replaced with a generic template.
//   - insufficient_balance: the real furniture-shop API's own shared
//     account balance was hit (its raw message looks like "Balance 402.0
//     is less than total price 13800.0") — this one genuinely needs
//     translating into plain language.

export type OrderErrorCode =
  | "personal_allowance_exceeded"
  | "insufficient_balance"
  | "not_found"
  | "other";

export function friendlyOrderError(
  code: OrderErrorCode | undefined,
  rawMessage: string,
): { message: string; suggestion?: string } {
  switch (code) {
    case "personal_allowance_exceeded":
      // Already plain language with real numbers — just add a suggestion.
      return {
        message: rawMessage,
        suggestion: "Try a smaller quantity, or look for something cheaper in the catalogue.",
      };
    case "insufficient_balance":
      return {
        message:
          "The shared account doesn't have enough balance for this purchase (this isn't about " +
          "your personal allowance — the whole account is short).",
        suggestion: "Try a smaller quantity.",
      };
    case "not_found":
      return {
        message: "That product couldn't be found — it may have been removed or the ID was wrong.",
        suggestion: "Try browsing or searching the catalogue again to find it.",
      };
    default:
      // Unclassified failure — don't invent a friendly explanation for an
      // error shape we don't actually understand, just show what we got.
      return { message: rawMessage };
  }
}
