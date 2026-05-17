import {
  PHASES,
  type MigrationPlan,
  type PhaseNumber,
  type PhasePlan,
  type WorkItem,
} from "../types";
import { ESTIMATION } from "../catalog";

/**
 * Migration plan synthesis (brief 12, 15, 16). Pure and deterministic: the
 * same work items and inputs always produce the same plan. Sprint counts use
 * team capacity = teamSize * productiveHoursPerDevPerWeek * sprintLengthWeeks.
 */
export interface PlanInput {
  workItems: WorkItem[];
  projectName: string;
  scannedAt: string;
  teamSize: number;
  sprintLengthWeeks: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildPlan(input: PlanInput): MigrationPlan {
  const teamSize = Math.max(1, Math.floor(input.teamSize || 1));
  const sprintWeeks = Math.max(1, Math.floor(input.sprintLengthWeeks || 1));
  const perSprint =
    teamSize * ESTIMATION.capacity.productiveHoursPerDevPerWeek * sprintWeeks;

  const phases: PhasePlan[] = PHASES.map(({ phase, name }) => {
    const inPhase = input.workItems
      .filter((w) => w.phase === (phase as PhaseNumber))
      .sort((a, b) => a.id.localeCompare(b.id));
    const totalHours = round1(
      inPhase.reduce((s, w) => s + w.effort.estimatedHours.expected, 0),
    );
    const sprints = totalHours > 0 ? Math.ceil(totalHours / perSprint) : 0;
    return {
      phase: phase as PhaseNumber,
      name,
      workItemIds: inPhase.map((w) => w.id),
      workItemCount: inPhase.length,
      totalHours,
      sprintRecommendation: {
        teamSize,
        sprintLengthWeeks: sprintWeeks,
        sprints,
      },
    };
  });

  const totalWorkItems = input.workItems.length;
  const totalHours = round1(
    phases.reduce((s, p) => s + p.totalHours, 0),
  );
  const blocksMigrationCount = input.workItems.filter(
    (w) => w.blocksMigration,
  ).length;

  return {
    scanId: "",
    projectName: input.projectName,
    scannedAt: input.scannedAt,
    executiveSummary: executiveSummary(
      totalWorkItems,
      blocksMigrationCount,
      totalHours,
      phases,
    ),
    phases,
    stats: { totalWorkItems, totalHours, blocksMigrationCount },
  };
}

/** Plain English, no em dashes, no banned softeners (brief 17.1). */
function executiveSummary(
  total: number,
  blockers: number,
  hours: number,
  phases: PhasePlan[],
): string {
  const p1 = phases.find((p) => p.phase === 1);
  // The brief mandates the phase name "Elevate" (sections 12 and 15) yet also
  // bans the word "elevate" as a softener (section 23). Phase names stay as
  // mandated structured labels; this prose avoids the banned words and does
  // not enumerate the names. See DECISIONS.md.
  const sentences = [
    `This scan found ${total} BoxLang migration work items in the codebase.`,
    blockers > 0
      ? `${blockers} of them block the migration and are scheduled first, in Phase 1.`
      : `No work items block the migration, so the codebase can move in priority order.`,
    `The plan runs in four risk-first phases, with the highest-risk work scheduled first.`,
    `Total estimated effort is ${hours} hours.`,
    p1 && p1.workItemCount > 0
      ? `Start with the ${p1.workItemCount} Phase 1 items to clear the blockers before compatibility work.`
      : `Begin with the Phase 2 compatibility work, since Phase 1 is empty.`,
  ];
  return sentences.join(" ");
}
