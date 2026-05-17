/**
 * Static cross-rule dependency graph (brief 9.4). Kept deliberately small and
 * meaningful: a defect must be fixed before the related modernization on the
 * same file is worth doing. The synthesizer turns these rule-level edges into
 * work-item-level blocks/blockedBy links scoped to the same scan and file.
 */
export interface RuleDependency {
  blocks?: string[];
  blockedBy?: string[];
}

export const RULE_DEPENDENCIES: Record<string, RuleDependency> = {
  // Fix SQL injection before reworking the same query into Quick ORM.
  "CFML-SEC-001": { blocks: ["CFML-MOD-001"] },
  "CFML-MOD-001": { blockedBy: ["CFML-SEC-001"] },
  // Correct unscoped shared state before re-homing it off the server scope.
  "CFML-SEC-007": { blocks: ["CFML-ARCH-004"] },
  "CFML-ARCH-004": { blockedBy: ["CFML-SEC-007"] },
  // Replace the AJAX proxy before swapping its polling for SocketBox.
  "CFML-UI-004": { blocks: ["CFML-MOD-004"] },
  "CFML-MOD-004": { blockedBy: ["CFML-UI-004"] },
};
