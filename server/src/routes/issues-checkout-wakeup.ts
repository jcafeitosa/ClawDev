/**
 * Utility to determine whether to wake an assignee agent on issue checkout.
 */

type CheckoutWakeInput = {
  actorType: "board" | "agent" | "none";
  actorAgentId: string | null;
  checkoutAgentId: string;
  checkoutRunId: string | null;
};

export function shouldWakeAssigneeOnCheckout(input: CheckoutWakeInput): boolean {
  if (input.actorType !== "agent") return true;
  if (!input.actorAgentId) return true;
  if (input.actorAgentId !== input.checkoutAgentId) return true;
  if (!input.checkoutRunId) return true;
  return false;
}
