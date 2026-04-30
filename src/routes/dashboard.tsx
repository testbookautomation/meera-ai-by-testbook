import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

type DashboardSearchParams = {
  userid?: string;
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const effectiveUid = userid || sessionStorage.getItem("current_userid") || "demo_user";
    sessionStorage.setItem("current_userid", effectiveUid);
    navigate({ to: "/mentor-chat", search: { userid: effectiveUid } as any, replace: true });
  }, [navigate, userid]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-slate-500">
      Redirecting to mentor chat...
    </div>
  );
}
