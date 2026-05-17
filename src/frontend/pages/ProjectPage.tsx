import { useEffect, useState } from "react";
import {
  Box,
  Button,
  DynamicTable,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  Textfield,
} from "@forge/react";
import type {
  MigrationPlan,
  ProjectConfig,
  ScanSummary,
  WorkItem,
} from "../../types";
import type { WorkItemFacet } from "../../lib/entities";
import { api } from "../lib/api";
import {
  PLAN_COLUMNS,
  WORK_ITEM_COLUMNS,
  planRows,
  recentScanRows,
  statusLozenge,
  summarize,
  toTableRows,
} from "../lib/viewModel";

const head = (cols: string[]) => ({
  cells: cols.map((c) => ({ key: c.toLowerCase(), content: c })),
});

/** Jira project page. Thin shell; all shaping is in ../lib/viewModel. */
export const ProjectPage = ({ projectId }: { projectId: string }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [config, setConfig] = useState<ProjectConfig | null>(null);

  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [starting, setStarting] = useState(false);

  const [activeScan, setActiveScan] = useState<string | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [facet, setFacet] = useState<WorkItemFacet>({ type: "all" });
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [teamSize, setTeamSize] = useState("3");
  const [sprintWeeks, setSprintWeeks] = useState("2");
  const [spaceKey, setSpaceKey] = useState("");

  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const runExport = async (
    format: "json" | "markdown" | "csv" | "gh-script",
  ) => {
    if (!activeScan) return;
    const req = await api.requestExport(activeScan, format);
    if (!req.ok) return setError(req.message);
    const got = await api.getExport(req.artifactId);
    if (got.ok) setExportUrl(got.url);
    else setError(got.message);
  };

  const buildPlanView = async () => {
    if (!activeScan) return;
    const res = await api.getPlan(
      activeScan,
      Number(teamSize) || 3,
      Number(sprintWeeks) || 2,
    );
    if (res.ok) setPlan(res.plan);
    else setError(res.message);
  };

  useEffect(() => {
    void (async () => {
      const res = await api.getProjectState(projectId);
      if (res.ok) {
        setScans(res.recentScans);
        setConfig(res.projectConfig);
      } else {
        setError(res.message);
      }
      setLoading(false);
    })();
  }, [projectId]);

  const startGitHub = async () => {
    setStarting(true);
    const res = await api.startScan(projectId, {
      kind: "github",
      repo,
      tokenRef: `tok:${projectId}:gh`,
    });
    if (res.ok) setActiveScan(res.scanId);
    else setError(res.message);
    setStarting(false);
  };

  const loadItems = async (f: WorkItemFacet, next?: string) => {
    if (!activeScan) return;
    const res = await api.getWorkItems(activeScan, f, next, 50);
    if (res.ok) {
      setItems(next ? [...items, ...res.items] : res.items);
      setCursor(res.nextCursor);
    } else {
      setError(res.message);
    }
  };

  if (loading) return <Spinner label="Loading Cartographer" />;

  const cards = summarize(items);

  return (
    <Box>
      <Heading size="large">Cartographer</Heading>
      {error ? (
        <SectionMessage appearance="error" title="Something went wrong">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      <Tabs id="cartographer-tabs">
        <TabList>
          <Tab>Dashboard</Tab>
          <Tab>New scan</Tab>
          <Tab>Work items</Tab>
          <Tab>Plan</Tab>
          <Tab>Settings</Tab>
        </TabList>

        <TabPanel>
          <Stack space="space.200">
            <Inline space="space.200">
              <Text>
                Work items: <Text>{String(cards.totalWorkItems)}</Text>
              </Text>
              <Text>Migration blockers: {String(cards.blocksMigration)}</Text>
              <Text>Estimated hours: {String(cards.estimatedHours)}</Text>
            </Inline>
            {scans.length === 0 ? (
              <SectionMessage title="No scans yet">
                <Text>
                  Open the New scan tab to scan a ColdFusion codebase.
                </Text>
              </SectionMessage>
            ) : (
              <DynamicTable
                head={head(["Scan", "Status", "Items", "Source", "When"])}
                rows={recentScanRows(scans)}
              />
            )}
          </Stack>
        </TabPanel>

        <TabPanel>
          <Stack space="space.200">
            <Text>Scan a GitHub repository (read-only, personal token).</Text>
            <Textfield
              name="repo"
              placeholder="owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <Textfield
              name="token"
              placeholder="personal access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button
              appearance="primary"
              isDisabled={starting || repo.length === 0}
              onClick={() => void startGitHub()}
            >
              Start scan
            </Button>
            <SectionMessage title="Zip and Bitbucket">
              <Text>
                Zip upload uses the Object Store presign flow in objectstore
                mode. Bitbucket uses a repository access token. Both are wired
                in the resolver API.
              </Text>
            </SectionMessage>
          </Stack>
        </TabPanel>

        <TabPanel>
          <Stack space="space.200">
            {activeScan ? (
              <>
                <Inline space="space.100">
                  <Select
                    appearance="default"
                    options={[
                      { label: "All", value: "all" },
                      { label: "Phase 1", value: "phase:1" },
                      { label: "Security", value: "category:security" },
                      { label: "Critical", value: "severity:critical" },
                    ]}
                    onChange={(opt) => {
                      const v = (opt as { value: string }).value;
                      const [p, val] = v.split(":");
                      const f: WorkItemFacet =
                        p === "phase"
                          ? { type: "phase", value: Number(val) }
                          : p === "category"
                            ? { type: "category", value: String(val) }
                            : p === "severity"
                              ? { type: "severity", value: String(val) }
                              : { type: "all" };
                      setFacet(f);
                      void loadItems(f);
                    }}
                  />
                  <Button onClick={() => void loadItems(facet)}>Refresh</Button>
                </Inline>
                <DynamicTable
                  head={head(WORK_ITEM_COLUMNS)}
                  rows={toTableRows(items)}
                />
                {cursor ? (
                  <Button onClick={() => void loadItems(facet, cursor)}>
                    Load more
                  </Button>
                ) : null}
                <Inline space="space.100">
                  <Text>Export:</Text>
                  <Button onClick={() => void runExport("json")}>JSON</Button>
                  <Button onClick={() => void runExport("markdown")}>
                    Markdown
                  </Button>
                  <Button onClick={() => void runExport("csv")}>CSV</Button>
                  <Button onClick={() => void runExport("gh-script")}>
                    GitHub script
                  </Button>
                </Inline>
                {exportUrl ? (
                  <SectionMessage title="Export ready">
                    <Text>Download: {exportUrl}</Text>
                  </SectionMessage>
                ) : null}
              </>
            ) : (
              <SectionMessage title="Run a scan first">
                <Text>Start a scan to see work items here.</Text>
              </SectionMessage>
            )}
          </Stack>
        </TabPanel>

        <TabPanel>
          <Stack space="space.200">
            {activeScan ? (
              <>
                <Inline space="space.100">
                  <Textfield
                    name="team"
                    placeholder="team size"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                  />
                  <Textfield
                    name="sprint"
                    placeholder="sprint weeks"
                    value={sprintWeeks}
                    onChange={(e) => setSprintWeeks(e.target.value)}
                  />
                  <Button
                    appearance="primary"
                    onClick={() => void buildPlanView()}
                  >
                    Build plan
                  </Button>
                </Inline>
                {plan ? (
                  <Stack space="space.200">
                    <Text>{plan.executiveSummary}</Text>
                    <DynamicTable
                      head={head(PLAN_COLUMNS)}
                      rows={planRows(plan)}
                    />
                    <Inline space="space.100">
                      <Textfield
                        name="space"
                        placeholder="Confluence space key"
                        value={spaceKey}
                        onChange={(e) => setSpaceKey(e.target.value)}
                      />
                      <Button
                        isDisabled={spaceKey.length === 0}
                        onClick={() =>
                          void api
                            .publishToConfluence(activeScan, spaceKey)
                            .then((r) => {
                              if (!r.ok) setError(r.message);
                            })
                        }
                      >
                        Publish to Confluence
                      </Button>
                    </Inline>
                  </Stack>
                ) : (
                  <Text>Set team size and sprint length, then build.</Text>
                )}
              </>
            ) : (
              <SectionMessage title="Run a scan first">
                <Text>The phased plan opens once a scan completes.</Text>
              </SectionMessage>
            )}
          </Stack>
        </TabPanel>

        <TabPanel>
          <Stack space="space.200">
            <Text>
              Disabled rules for this project:{" "}
              {config?.disabledRuleIds.join(", ") || "none"}
            </Text>
            <Lozenge appearance={statusLozenge("complete").appearance}>
              Settings persisted per project
            </Lozenge>
          </Stack>
        </TabPanel>
      </Tabs>
    </Box>
  );
};
