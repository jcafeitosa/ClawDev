import { eq, desc, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentTemplates, agents } from "@clawdev/db";

export function agentTemplateService(db: Db) {
  async function list(companyId: string) {
    return db
      .select()
      .from(agentTemplates)
      .where(eq(agentTemplates.companyId, companyId))
      .orderBy(desc(agentTemplates.usageCount));
  }

  async function getById(templateId: string) {
    const [row] = await db
      .select()
      .from(agentTemplates)
      .where(eq(agentTemplates.id, templateId));
    return row ?? null;
  }

  async function create(
    companyId: string,
    data: {
      name: string;
      description?: string;
      baseConfig: Record<string, unknown>;
      isPublic?: boolean;
    },
    createdBy?: { agentId?: string; userId?: string },
  ) {
    const [row] = await db
      .insert(agentTemplates)
      .values({
        companyId,
        name: data.name,
        description: data.description,
        baseConfig: data.baseConfig,
        isPublic: data.isPublic ?? false,
        createdByAgentId: createdBy?.agentId,
        createdByUserId: createdBy?.userId,
      })
      .returning();
    return row;
  }

  async function update(
    templateId: string,
    data: Partial<{
      name: string;
      description: string;
      baseConfig: Record<string, unknown>;
      isPublic: boolean;
    }>,
  ) {
    const [row] = await db
      .update(agentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentTemplates.id, templateId))
      .returning();
    return row ?? null;
  }

  async function remove(templateId: string) {
    const [row] = await db
      .delete(agentTemplates)
      .where(eq(agentTemplates.id, templateId))
      .returning();
    return row ?? null;
  }

  async function instantiate(
    templateId: string,
    overrides?: Record<string, unknown>,
  ) {
    const template = await getById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Increment usage count
    await db
      .update(agentTemplates)
      .set({ usageCount: sql`${agentTemplates.usageCount} + 1` })
      .where(eq(agentTemplates.id, templateId));

    const config = { ...template.baseConfig } as Record<string, unknown>;

    const [agent] = await db
      .insert(agents)
      .values({
        ...config,
        ...overrides,
        companyId: template.companyId,
        name: (overrides?.name as string) ?? template.name + " (copy)",
        role: (overrides?.role as string) ?? (config.role as string) ?? "general",
      })
      .returning();

    return agent;
  }

  return { list, getById, create, update, remove, instantiate };
}
