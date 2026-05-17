import { useEffect, useState } from "react";
import {
  Box,
  Button,
  DynamicTable,
  Heading,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Toggle,
} from "@forge/react";
import { api } from "../lib/api";

/**
 * Jira admin page (brief 7.2). Site-level: app health, the read-only rule
 * catalog, telemetry opt-in (off by default), and ingest mode.
 */
export const AdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    version: string;
    runtime: string;
    catalogVersion: string;
    ruleCount: number;
  } | null>(null);
  const [telemetry, setTelemetry] = useState(false);
  const [rules, setRules] = useState<
    Array<{ id: string; title: string; category: string }>
  >([]);

  useEffect(() => {
    void (async () => {
      const [h, c, cat] = await Promise.all([
        api.getAppHealth(),
        api.getSiteConfig(),
        api.getRuleCatalog(),
      ]);
      if (h.ok) setHealth(h);
      if (c.ok) setTelemetry(c.config.telemetryOptIn);
      if (cat.ok) setRules(cat.rules);
      if (!h.ok) setError(h.message);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading settings" />;

  return (
    <Box>
      <Heading size="large">Cartographer settings</Heading>
      {error ? (
        <SectionMessage appearance="error" title="Error">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      <Stack space="space.200">
        <Text>
          Version {health?.version}, runtime {health?.runtime}, rule catalog{" "}
          {health?.catalogVersion} ({health?.ruleCount} rules).
        </Text>
        <Inline space="space.100" alignBlock="center">
          <Toggle
            id="telemetry"
            isChecked={telemetry}
            onChange={(e) => {
              const next = e.target.checked ?? false;
              setTelemetry(next);
              void api.updateSiteConfig({ telemetryOptIn: next });
            }}
          />
          <Text>Send anonymized scan counts to the publisher</Text>
        </Inline>
        <Button
          onClick={() => void api.updateSiteConfig({ telemetryOptIn: telemetry })}
        >
          Save settings
        </Button>
        <Heading size="medium">Rule catalog</Heading>
        <DynamicTable
          head={{
            cells: [
              { key: "id", content: "Rule" },
              { key: "title", content: "Title" },
              { key: "category", content: "Category" },
            ],
          }}
          rows={rules.slice(0, 50).map((r) => ({
            key: r.id,
            cells: [
              { key: "id", content: r.id },
              { key: "title", content: r.title },
              { key: "category", content: r.category },
            ],
          }))}
        />
      </Stack>
    </Box>
  );
};
