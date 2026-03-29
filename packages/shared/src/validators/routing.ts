import { z } from "zod";

export const routingConstraintsSchema = z.object({
  maxCostPerRunUsd: z.number().nonnegative().nullable().default(null),
  minContextWindow: z.number().int().nonnegative().nullable().default(null),
  allowedProviders: z.array(z.string().min(1)).nullable().default(null),
  blockedProviders: z.array(z.string().min(1)).nullable().default(null),
  qualityBias: z.number().min(0).max(1).default(0.5),
  preferredTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
});

export const routingPolicySchema = z.object({
  mode: z.enum(["manual", "auto_constrained", "full_auto"]),
  constraints: routingConstraintsSchema.optional(),
  fallback: z.object({
    adapterType: z.string().min(1),
    model: z.string().min(1),
  }),
});

export const updateRoutingPolicySchema = routingPolicySchema.partial();

export type RoutingConstraintsInput = z.infer<typeof routingConstraintsSchema>;
export type RoutingPolicyInput = z.infer<typeof routingPolicySchema>;
export type UpdateRoutingPolicyInput = z.infer<typeof updateRoutingPolicySchema>;
