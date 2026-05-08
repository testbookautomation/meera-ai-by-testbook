import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTestLinkForDevice } from "@/utils/testLinks";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/ssc-cgl-tests")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: SscCglTestsPage,
});

function SscCglTestsPage() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tests, setTests] = useState<{ id: string; title: string; link: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ssc-cgl-tests")
      .then((r) => r.json())
      .then((p) => {
        if (p.success && Array.isArray(p.data)) setTests(p.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          onClick={() => navigate({ to: "/mentor-chat", search: { userid } })}
          className="mb-4 flex items-center gap-1.5 text-[13px] font-semibold text-[#2563eb]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Meera
        </button>

        <h1 className="mb-1 text-[18px] font-black text-[#111f45]">SSC CGL Test Series</h1>
        <p className="mb-5 text-[13px] font-semibold text-[#475569]">
          All available tests fetched from Testbook LMS
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" />
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-2xl border border-blue-100 bg-white p-6 text-center">
            <p className="text-[14px] font-semibold text-[#475569]">No tests found. Please try again later.</p>
            <a
              href="https://link.testbook.com/Meera"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] px-5 py-2.5 text-[13px] font-black text-white"
            >
              Browse on Testbook <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {tests.map((test) => (
              <a
                key={test.id}
                href={getTestLinkForDevice(test, isMobile)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3 transition-all hover:border-[#2563eb]/40 hover:bg-blue-50 active:scale-[0.98]"
              >
                <p className="flex-1 truncate text-[13px] font-black text-[#111f45]">{test.title}</p>
                <div className="ml-3 flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] px-3 py-1.5 text-[11px] font-black text-white">
                  Start <ArrowRight className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
