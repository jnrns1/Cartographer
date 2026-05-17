/** Pure migration domain logic. No Forge imports, fully unit-testable. */
export { scanFile, _resetEngineCache } from "./regexEngine";
export {
  estimateEffort,
  isLegacyPath,
  pathHasTests,
  type FileEffortContext,
} from "./effort";
export { phaseFor, PHASE_NAME } from "./phasing";
export { buildPlan, type PlanInput } from "./plan";
export { synthesize, type SynthesizeInput } from "./synthesize";
export {
  stableId,
  candidateEntityId,
  workItemEntityId,
  displayId,
} from "./ids";
export {
  planChunks,
  eventBatches,
  MAX_CHUNK_FILES,
  MAX_EVENTS_PER_PUSH,
  type ChunkPlan,
  type ChunkSpec,
} from "./chunkPlan";
