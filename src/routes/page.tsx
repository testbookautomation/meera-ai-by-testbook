import { createFileRoute } from "@tanstack/react-router";
import { User, AlertCircle } from "lucide-react";

type PageSearchParams = {
  userid?: string;
};

export const Route = createFileRoute("/page")({
  component: UserPage,
  validateSearch: (search: Record<string, unknown>): PageSearchParams => {
    return {
      userid: search.userid as string | undefined,
    };
  },
});

function UserPage() {
  // Extract the userid from the URL search parameters (?userid=...)
  const { userid } = Route.useSearch();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 p-3 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-5 text-center shadow-xl animate-in fade-in zoom-in-95 duration-500 sm:rounded-3xl sm:p-8">
        
        {userid ? (
          <>
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-[image:var(--gradient-primary)] shadow-lg shadow-primary/20 sm:h-24 sm:w-24">
              <User className="h-9 w-9 text-white sm:h-10 sm:w-10" />
            </div>
            <h1 className="mb-2 text-2xl font-extrabold text-foreground sm:text-3xl">User Profile</h1>
            <p className="mb-5 text-sm text-muted-foreground sm:mb-6 sm:text-base">Successfully captured User ID from the URL!</p>
            
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 inline-block shadow-inner">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Captured User ID</span>
              <span className="break-all font-mono text-xl font-bold text-primary sm:text-2xl">{userid}</span>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-destructive/10 sm:h-24 sm:w-24">
              <AlertCircle className="h-9 w-9 text-destructive sm:h-10 sm:w-10" />
            </div>
            <h1 className="mb-2 text-2xl font-extrabold text-foreground sm:text-3xl">Missing User ID</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Please add <code className="bg-slate-100 text-destructive px-2 py-1 rounded font-mono">?userid=123</code> to the URL to view this page.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
