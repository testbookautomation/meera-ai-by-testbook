import { createFileRoute } from "@tanstack/react-router";
import { DemoFlowPage } from "@/components/DemoFlow";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/smart-analysis-popup")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: Array.isArray(search.userid)
      ? String(search.userid[0] ?? "")
      : search.userid != null
        ? String(search.userid)
        : undefined,
  }),
  component: SmartAnalysisPopupPage,
});

function SmartAnalysisPopupPage() {
  const { userid } = Route.useSearch();
  return <DemoFlowPage screen={3} userid={userid} liveOnly={true} />;
}
