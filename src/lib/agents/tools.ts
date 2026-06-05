import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { generateAIResponse } from "@/lib/ai/provider"
import { buildExecutiveSummaryPrompt } from "@/lib/ai/prompts/executive-summary"
import type { Finding } from "@/types"

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

export function buildAgentTools(engagementId: string, userId: string) {
  return {
    get_engagement_context: tool({
      description:
        "Get current engagement details: name, client, status, scope, dates, and finding/observation counts. Call this first to orient yourself.",
      inputSchema: z.object({}),
      execute: async () => {
        const engagement = await prisma.engagement.findFirst({
          where: { id: engagementId, userId },
          include: { _count: { select: { findings: true, observations: true } } },
        })
        if (!engagement) return { error: "Engagement not found" }
        return {
          id: engagement.id,
          name: engagement.name,
          clientName: engagement.clientName,
          clientBrief: engagement.clientBrief ?? null,
          scope: engagement.scope ?? null,
          status: engagement.status,
          startDate: engagement.startDate.toISOString(),
          endDate: engagement.endDate?.toISOString() ?? null,
          findingCount: engagement._count.findings,
          observationCount: engagement._count.observations,
        }
      },
    }),

    list_observations: tool({
      description:
        "List observations for the engagement. Always call this before answering questions about observations.",
      inputSchema: z.object({
        status: z
          .enum(["raw", "promoted", "archived"])
          .optional()
          .describe("Filter by status. Omit to get all."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max observations to return."),
      }),
      execute: async ({ status, limit }) => {
        const owned = await prisma.engagement.findFirst({ where: { id: engagementId, userId } })
        if (!owned) return { error: 'Engagement not found' }
        const observations = await prisma.observation.findMany({
          where: { engagementId, ...(status ? { status } : {}) },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
        return observations.map((o) => ({
          id: o.id,
          content: o.content,
          source: o.source,
          host: o.host ?? null,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        }))
      },
    }),

    create_observation: tool({
      description: "Log a new raw observation to the engagement.",
      inputSchema: z.object({
        content: z.string().min(1).max(10000).describe("The observation content."),
        host: z.string().max(500).optional().describe("Target host or IP, if applicable."),
        source: z
          .enum(["manual", "burp", "nmap", "nuclei", "nessus"])
          .default("manual")
          .describe("How this was captured."),
      }),
      execute: async ({ content, host, source }) => {
        const owned = await prisma.engagement.findFirst({ where: { id: engagementId, userId } })
        if (!owned) return { error: 'Engagement not found' }
        const observation = await prisma.observation.create({
          data: { content, host, source, engagementId, status: "raw" },
        })
        return {
          id: observation.id,
          content: observation.content,
          host: observation.host ?? null,
          status: observation.status,
          createdAt: observation.createdAt.toISOString(),
        }
      },
    }),

    list_findings: tool({
      description:
        "List confirmed findings for the engagement, sorted by severity. Always call this before answering questions about findings.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ limit }) => {
        const owned = await prisma.engagement.findFirst({ where: { id: engagementId, userId } })
        if (!owned) return { error: 'Engagement not found' }
        const findings = await prisma.finding.findMany({
          where: { engagementId },
        })
        findings.sort(
          (a, b) => (SEVERITY_RANK[a.severity] ?? 5) - (SEVERITY_RANK[b.severity] ?? 5)
        )
        const limited = findings.slice(0, limit)
        return limited.map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          host: f.host ?? null,
          port: f.port ?? null,
          cvss: f.cvss ?? null,
          cveIds: f.cveIds ?? null,
          description: f.description.slice(0, 400),
          evidence: f.evidence ? f.evidence.slice(0, 200) : null,
          remediationNote: f.remediationNote ? f.remediationNote.slice(0, 200) : null,
          source: f.source,
          createdAt: f.createdAt.toISOString(),
        }))
      },
    }),

    create_finding: tool({
      description: "Create a new confirmed finding in the engagement.",
      inputSchema: z.object({
        title: z.string().min(1).max(500),
        description: z.string().min(1),
        severity: z.enum(["critical", "high", "medium", "low", "info"]),
        host: z.string().max(500).optional(),
        port: z.number().int().min(1).max(65535).optional(),
        evidence: z.string().max(5000).optional(),
        remediationNote: z.string().max(5000).optional(),
        cveIds: z
          .string()
          .max(1000)
          .optional()
          .describe("Comma-separated CVE IDs, e.g. CVE-2021-44228"),
        cvss: z.number().min(0).max(10).optional(),
      }),
      execute: async ({ title, description, severity, host, port, evidence, remediationNote, cveIds, cvss }) => {
        const owned = await prisma.engagement.findFirst({ where: { id: engagementId, userId } })
        if (!owned) return { error: 'Engagement not found' }
        const finding = await prisma.finding.create({
          data: {
            title,
            description,
            severity,
            host,
            port,
            evidence,
            remediationNote,
            cveIds,
            cvss,
            engagementId,
            source: "manual",
          },
        })
        return {
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
          host: finding.host ?? null,
        }
      },
    }),

    promote_observation: tool({
      description:
        "Promote one or more raw observations into a confirmed finding and mark them as promoted.",
      inputSchema: z.object({
        observationIds: z
          .array(z.string())
          .min(1)
          .describe("IDs of observations to promote."),
        title: z.string().min(1).max(500),
        description: z.string().min(1),
        severity: z.enum(["critical", "high", "medium", "low", "info"]),
        host: z.string().max(500).optional(),
        remediationNote: z.string().max(5000).optional(),
        cveIds: z.string().max(1000).optional(),
      }),
      execute: async ({ observationIds, title, description, severity, host, remediationNote, cveIds }) => {
        const owned = await prisma.engagement.findFirst({ where: { id: engagementId, userId } })
        if (!owned) return { error: 'Engagement not found' }
        const obs = await prisma.observation.findMany({
          where: { id: { in: observationIds }, engagementId },
          select: { id: true },
        })
        if (obs.length === 0)
          return { error: "No matching observations found in this engagement" }

        const [finding] = await prisma.$transaction(async (tx) => {
          const createdFinding = await tx.finding.create({
            data: {
              title,
              description,
              severity,
              host,
              remediationNote,
              cveIds,
              engagementId,
              source: "manual",
              observations: { connect: obs.map((o) => ({ id: o.id })) },
            },
          })
          await tx.observation.updateMany({
            where: { id: { in: obs.map((o) => o.id) } },
            data: { status: "promoted", findingId: createdFinding.id },
          })
          return [createdFinding]
        })
        return {
          finding: { id: finding.id, title: finding.title, severity: finding.severity },
          promotedCount: obs.length,
        }
      },
    }),

    draft_executive_summary: tool({
      description:
        "Generate an AI executive summary based on all current findings. Returns draft prose ready for the report.",
      inputSchema: z.object({}),
      execute: async () => {
        const engagement = await prisma.engagement.findFirst({
          where: { id: engagementId, userId },
          include: {
            findings: true,
            user: { select: { houseStyle: true } },
          },
        })
        if (!engagement) return { error: "Engagement not found" }
        if (engagement.findings.length === 0)
          return { error: "No findings yet — add findings before drafting a summary" }

        const rawDays = engagement.endDate
          ? Math.ceil(
              (engagement.endDate.getTime() - engagement.startDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null

        const { system, user } = buildExecutiveSummaryPrompt({
          clientName: engagement.clientName,
          clientBrief: engagement.clientBrief ?? "No brief provided.",
          findings: engagement.findings as Finding[],
          findingChain: [],
          houseStyle: engagement.user.houseStyle ?? "",
          engagementDuration:
            rawDays && rawDays > 0 ? `${rawDays} days` : "Duration not specified",
        })

        const text = await generateAIResponse(user, system)
        return { summary: text }
      },
    }),
  }
}
