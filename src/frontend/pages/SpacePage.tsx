import { useEffect, useState } from "react";
import {
  Box,
  DynamicTable,
  Heading,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import type { MigrationPlan } from "../../types";
import { api } from "../lib/api";
import { PLAN_COLUMNS, planRows } from "../lib/viewModel";

/**
 * Confluence space page (brief 7.3): read-only viewer for the most recently
 * published migration plan in this space.
 */
export const SpacePage = ({ spaceKey }: { spaceKey: string }) => {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api.getPlanForSpace(spaceKey);
      if (res.ok) setPlan(res.plan);
      else setError(res.message);
      setLoading(false);
    })();
  }, [spaceKey]);

  if (loading) return <Spinner label="Loading plan" />;

  if (!plan) {
    return (
      <Box>
        <Heading size="large">Cartographer migration plan</Heading>
        <SectionMessage title="No plan yet">
          <Text>
            {error ??
              "Publish a plan from the Cartographer Jira project page first."}
          </Text>
        </SectionMessage>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="large">
        BoxLang migration plan: {plan.projectName}
      </Heading>
      <Stack space="space.200">
        <Text>Scanned {plan.scannedAt.slice(0, 10)}</Text>
        <Text>{plan.executiveSummary}</Text>
        <DynamicTable
          head={{
            cells: PLAN_COLUMNS.map((c) => ({
              key: c.toLowerCase(),
              content: c,
            })),
          }}
          rows={planRows(plan)}
        />
      </Stack>
    </Box>
  );
};
