import { createFileRoute } from "@tanstack/react-router";
import { DemoFlowPage } from "@/components/DemoFlow";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/plan")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: PlanPage,
});

function PlanPage() {
  const { userid } = Route.useSearch();
  return <DemoFlowPage screen={8} userid={userid} />;
}
