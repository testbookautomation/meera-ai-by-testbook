import { createFileRoute } from "@tanstack/react-router";
import { DemoFlowPage } from "@/components/DemoFlow";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/paywall")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: PaywallPage,
});

function PaywallPage() {
  const { userid } = Route.useSearch();
  return <DemoFlowPage screen={6} userid={userid} />;
}
