import { z } from "zod";
import { ISSUE_COMPLEXITIES, MODEL_ROUTING_CONSTRAINTS, MODEL_ROUTING_STRATEGIES } from "../constants.js";

export const modelRoutingProfileInputSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  routingStrategy: z.enum(MODEL_ROUTING_STRATEGIES).default("pinned"),
  defaultAdapterType: z.string().optional().nullable(),
  defaultModelId: z.string().optional().nullable(),
  fallbackChain: z.array(z.object({
    adapterType: z.string().min(1),
    modelId: z.string().min(1),
  }).strict()).default([]),
  allowCrossProviderFallback: z.boolean().default(true),
  preferFreeModels: z.boolean().default(false),
  preferLocalModels: z.boolean().default(false),
  maxCostPerRequestMicro: z.number().int().nonnegative().optional().nullable(),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  minContextWindow: z.number().int().nonnegative().optional().nullable(),
  maxLatencyMs: z.number().int().nonnegative().optional().nullable(),
}).strict();

export const modelRoutingAssignmentInputSchema = z.object({
  companyId: z.string().uuid(),
  profileId: z.string().uuid(),
  agentId: z.string().uuid().optional().nullable(),
  role: z.string().optional().nullable(),
  complexity: z.enum([...MODEL_ROUTING_CONSTRAINTS, ...ISSUE_COMPLEXITIES] as [string, ...string[]]).default("any"),
  priority: z.number().int().default(0),
}).strict();

export const modelRoutingPolicyInputSchema = modelRoutingProfileInputSchema.extend({
  agentId: z.string().uuid().optional().nullable(),
  role: z.string().optional().nullable(),
  complexity: z.enum([...MODEL_ROUTING_CONSTRAINTS, ...ISSUE_COMPLEXITIES] as [string, ...string[]]).default("any"),
  priority: z.number().int().default(0),
});

export type ModelRoutingProfileInput = z.infer<typeof modelRoutingProfileInputSchema>;
export type ModelRoutingAssignmentInput = z.infer<typeof modelRoutingAssignmentInputSchema>;
export type ModelRoutingPolicyInput = z.infer<typeof modelRoutingPolicyInputSchema>;
