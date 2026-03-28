/**
 * Determines whether the assignee should be woken up on issue checkout.
 *
 * Skips the wakeup only when an agent checks out itself while already
 * running (i.e. self-checkout inside an active run), which avoids a
 * redundant wakeup loop.
 */
export function shouldWakeAssigneeOnCheckout(opts: {
  actorType: string;
  actorAgentId: string | null;
  checkoutAgentId: string;
  checkoutRunId: string | null;
}): boolean {
  if (
    opts.actorType === "agent" &&
    opts.actorAgentId === opts.checkoutAgentId &&
    opts.checkoutRunId != null
  ) {
    return false;
  }
  return true;
}
