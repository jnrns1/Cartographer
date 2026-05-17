import { useProductContext, Box, Heading, Text, Spinner } from "@forge/react";
import { ProjectPage } from "./pages/ProjectPage";
import { AdminPage } from "./pages/AdminPage";
import { SpacePage } from "./pages/SpacePage";

/**
 * One bundle serves all three module views. The surface is resolved from
 * product context (brief 3.4): the Jira project page, the Jira admin page,
 * and the Confluence space page route from the same App.
 */
export const App = () => {
  const context = useProductContext();
  if (!context) return <Spinner label="Loading" />;

  const moduleKey = context.moduleKey ?? "";
  const ext = context.extension as
    | { project?: { id?: string }; space?: { key?: string } }
    | undefined;

  if (moduleKey === "cartographer-admin-page") {
    return <AdminPage />;
  }
  if (moduleKey === "cartographer-space-page") {
    return <SpacePage spaceKey={ext?.space?.key ?? ""} />;
  }
  if (moduleKey === "cartographer-project-page") {
    return <ProjectPage projectId={ext?.project?.id ?? "unknown"} />;
  }
  return (
    <Box>
      <Heading size="medium">Cartographer</Heading>
      <Text>Open Cartographer from a Jira project or Confluence space.</Text>
    </Box>
  );
};
