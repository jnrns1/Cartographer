import type { ColdBox8Pattern } from "../types";

/**
 * Modern ColdBox 8.1 patterns referenced by modernization and AI-readiness
 * rules. ColdBox 8.1.0 and BoxLang 1.13.0 verified current 2026-05-17.
 */
export const COLDBOX8_PATTERNS: ColdBox8Pattern[] = [
  {
    name: "Virtual-thread executor",
    whenToApply:
      "A synchronous loop performs independent blocking work (HTTP, file, query) per iteration and would benefit from parallel execution.",
    codeShape:
      "executors.newVirtualThreadExecutor().submit(() => { ... }) or asyncManager.allApply(items, (item) => ...)",
    docUrl:
      "https://coldbox.ortusbooks.com/digging-deeper/promises-async-programming/executors",
  },
  {
    name: "AI routing (toAi)",
    whenToApply:
      "A service-shaped handler should be reachable by an AI client as a typed REST surface.",
    codeShape: "router.route('/ai').toAi(); // ColdBox 8.1 AI routing",
    docUrl:
      "https://www.ortussolutions.com/blog/coldbox-810-released-ai-routing-mcp-and-boxlang-first-power",
  },
  {
    name: "MCP exposure (toMCP / cbMCP)",
    whenToApply:
      "A cohesive service CFC should be exposed to AI agents as Model Context Protocol tools.",
    codeShape: "router.route('/mcp').toMCP(); install cbmcp; annotate service methods",
    docUrl:
      "https://www.ortussolutions.com/blog/introducing-cbmcp-your-coldbox-app-live-to-every-ai-agent",
  },
  {
    name: "CBWire reactive component",
    whenToApply:
      "A legacy AJAX UI tag (cfgrid, cflayout, cfwindow) needs a server-rendered reactive replacement without a separate JS framework.",
    codeShape: "component extends='cbwire.models.Component' { data = {...}; function mount(){} }",
    docUrl: "https://cbwire.ortusbooks.com/",
  },
  {
    name: "Quick ORM model",
    whenToApply:
      "Hand-built cfquery CRUD against a table should become a parameterized ActiveRecord model.",
    codeShape: "component extends='quick.models.BaseEntity' { } // User.where('active',1).get()",
    docUrl: "https://quick.ortusbooks.com/",
  },
  {
    name: "Hyper HTTP client",
    whenToApply:
      "Raw cfhttp calls to a third-party API should become a reusable, testable client.",
    codeShape: "hyper.newRequest('https://api...').withHeaders({}).post().json()",
    docUrl: "https://forgebox.io/view/hyper",
  },
  {
    name: "Scheduled and async tasks",
    whenToApply:
      "A request-scoped long task or a cron-like job should move off the request thread.",
    codeShape: "asyncManager.newSchedule().task('cleanup').call(() => ...).every(1,'day')",
    docUrl:
      "https://coldbox.ortusbooks.com/digging-deeper/promises-async-programming/executors",
  },
];
