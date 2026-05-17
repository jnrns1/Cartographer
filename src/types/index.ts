/**
 * Canonical type contracts for Cartographer for Atlassian.
 *
 * Every consumer (rule engine, synthesizer, Jira issue creator, Confluence
 * publisher, exporters, resolvers, UI) renders from these shapes. The rule
 * schema mirrors BUILD_BRIEF.md section 6.1 and the work item schema mirrors
 * section 14, with storage-entity shapes added per DECISIONS.md (Custom Entity
 * Store replaces the brief's single-key arrays).
 */

export const CATEGORIES = [
  "security",
  "legacy-ui",
  "deprecated",
  "compat-adobe",
  "compat-lucee",
  "architecture",
  "modernization",
  "ai-readiness",
  "tests",
  "config",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type JiraIssueType = "Bug" | "Story";

export type FixComplexity = "low" | "medium" | "high";

export type DetectStrategy = "regex" | "regex-then-validate";

/** The four migration phases, risk-first (brief section 15). */
export const PHASES = [
  { phase: 1, name: "Stabilize" },
  { phase: 2, name: "Compatibility" },
  { phase: 3, name: "Modernize" },
  { phase: 4, name: "Elevate" },
] as const;
export type PhaseNumber = 1 | 2 | 3 | 4;
export type PhaseName = (typeof PHASES)[number]["name"];

export interface EffortRange {
  low: number;
  expected: number;
  high: number;
}

export interface DocReference {
  /** Key into the Ortus docs index. */
  key: string;
  /** Display title; resolved at synthesis time when omitted. */
  title?: string;
}

export interface RuleDetect {
  strategy: DetectStrategy;
  /** Recall-favoring pre-filter. Must be a valid RegExp source. */
  preFilterPattern: string;
  /** Optional confirmation: a match here inside a pre-filter hit keeps it. */
  antiPattern?: string;
  /** Optional exclusion: a match here inside a pre-filter hit drops it. */
  exclusion?: string;
  /** Optional case-insensitive flag (CFML tags are case-insensitive). */
  ignoreCase?: boolean;
}

export interface Rule {
  id: string;
  title: string;
  category: Category;
  subcategory: string;
  severity: Severity;
  /** File extensions (without dot) this rule applies to. */
  appliesTo: string[];
  detect: RuleDetect;
  rationale: string;
  /** Template string; {{file}}, {{occurrences}} substituted at synthesis. */
  recommendation: string;
  references: DocReference[];
  /** ForgeBox slugs or BoxLang features that resolve this rule. */
  ortusModules: string[];
  estimatedEffortHours: EffortRange;
  fixComplexity: FixComplexity;
  blocksMigration: boolean;
  confidence: Confidence;
  jiraIssueType: JiraIssueType;
  /** Work item ids of rules this one blocks, by ruleId (static graph). */
  blocks?: string[];
  blockedBy?: string[];
}

export interface RuleCatalog {
  schemaVersion: string;
  rules: Rule[];
}

export interface BoxLangModule {
  slug: string;
  name: string;
  category: string;
  purpose: string;
  replaces: string[];
  boxlangMinVersion: string;
  docsUrl: string;
  forgeboxUrl: string;
}

export interface ColdBox8Pattern {
  name: string;
  whenToApply: string;
  codeShape: string;
  docUrl: string;
}

/** Flat key to URL lookup. One file to fix when an Ortus URL changes. */
export type OrtusDocsIndex = Record<string, string>;

export interface EstimationHeuristics {
  baseHoursPerOccurrence: Record<Category, number>;
  maxRollupPerFile: Record<Category, number>;
  multipliers: {
    fileSizeOver500Loc: number;
    fileSizeOver1500Loc: number;
    fileTouchedBy5PlusRules: number;
    fileHasTests: number;
    fileInLegacyPath: number;
  };
  capacity: {
    productiveHoursPerDevPerWeek: number;
  };
}

export type TShirt = "XS" | "S" | "M" | "L" | "XL";

export interface Effort {
  tshirt: TShirt;
  storyPoints: number;
  estimatedHours: EffortRange;
  /** Human-readable record of every multiplier applied. */
  notes: string;
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

/** One raw regex hit before dedup and rollup. */
export interface CandidateMatch {
  ruleId: string;
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface WorkItem {
  id: string;
  title: string;
  category: Category;
  subcategory: string;
  severity: Severity;
  priority: Priority;
  ruleId: string;
  confidence: Confidence;
  jiraIssueType: JiraIssueType;
  effort: Effort;
  location: CodeLocation;
  occurrences: number;
  rationale: string;
  recommendation: string;
  references: DocReference[];
  ortusModules: string[];
  blocksMigration: boolean;
  blocks: string[];
  blockedBy: string[];
  phase: PhaseNumber;
  tags: string[];
  jiraIssueKey: string | null;
  confluencePageId: string | null;
  detectedAt: string;
}

export type ScanSourceKind = "zip" | "github" | "bitbucket";

export type ScanSource =
  | { kind: "zip"; objectKey?: string }
  | { kind: "github"; repo: string; ref?: string; tokenRef: string }
  | {
      kind: "bitbucket";
      workspace: string;
      repoSlug: string;
      ref?: string;
      tokenRef: string;
    };

export const SCAN_STATUSES = [
  "queued",
  "scanning",
  "synthesizing",
  "complete",
  "failed",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export interface ScanOptions {
  /** Categories to include; empty means all. */
  includeCategories: Category[];
  ignorePatterns: string[];
}

export interface ScanMeta {
  scanId: string;
  projectId: string;
  status: ScanStatus;
  sourceKind: ScanSourceKind;
  objectKey?: string;
  totalFiles: number;
  processedFiles: number;
  candidateCount: number;
  workItemCount: number;
  chunkTotal: number;
  chunkDone: number;
  createdAt: number;
  finishedAt?: number;
  error?: string;
}

export interface ScanProgress {
  status: ScanStatus;
  percentComplete: number;
  currentStep: string;
  chunkDone: number;
  chunkTotal: number;
  etaSeconds?: number;
}

export interface ScanSummary {
  scanId: string;
  status: ScanStatus;
  createdAt: number;
  finishedAt?: number;
  workItemCount: number;
  sourceKind: ScanSourceKind;
}

export interface SprintRecommendation {
  teamSize: number;
  sprintLengthWeeks: number;
  sprints: number;
}

export interface PhasePlan {
  phase: PhaseNumber;
  name: PhaseName;
  workItemIds: string[];
  workItemCount: number;
  totalHours: number;
  sprintRecommendation: SprintRecommendation;
}

export interface PlanStats {
  totalWorkItems: number;
  totalHours: number;
  blocksMigrationCount: number;
}

export interface MigrationPlan {
  scanId: string;
  projectName: string;
  scannedAt: string;
  executiveSummary: string;
  phases: PhasePlan[];
  stats: PlanStats;
}

export interface AppConfig {
  telemetryOptIn: boolean;
  /** objectstore (dev/staging) or chunked (production until Object Store GA). */
  ingestMode: "objectstore" | "chunked";
  ruleCatalogVersion: string;
}

export interface ProjectConfig {
  projectId: string;
  disabledRuleIds: string[];
}

export type ExportFormat = "json" | "markdown" | "csv" | "gh-script";

export interface ExportArtifact {
  artifactId: string;
  scanId: string;
  format: ExportFormat;
  objectKey: string;
  sizeBytes: number;
  createdAt: number;
}

/** A file presented to the rule engine by a SourceAdapter. */
export interface FileRef {
  /** Repo-relative path with forward slashes. */
  path: string;
  /** Extension without the dot, lowercased. */
  ext: string;
}

export interface SourceMetadata {
  kind: ScanSourceKind;
  label: string;
  fileCount?: number;
}

export interface SourceAdapter {
  listFiles(opts: { ignorePatterns: string[] }): AsyncIterable<FileRef>;
  readFile(ref: FileRef): Promise<string>;
  getMetadata(): SourceMetadata;
}

export type ScanPhase =
  | "bootstrap"
  | "chunk"
  | "enqueue-more"
  | "synthesize";

/** Async event payload. Carries ids only; file lists live in storage. */
export interface ScanEvent {
  scanId: string;
  phase: ScanPhase;
  chunkIndex?: number;
  fromBatch?: number;
}

/** Structured resolver error. Resolvers never throw raw. */
export interface ResolverError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid-input"
    | "not-found"
    | "conflict"
    | "internal";
  message: string;
}

export type ResolverResult<T> = ({ ok: true } & T) | ResolverError;
