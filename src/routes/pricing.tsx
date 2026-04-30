import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, Shield, ArrowLeft, Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { openRazorpayCheckout } from "@/services/razorpay";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: PricingPage,
});

function PricingPage() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("currentUserData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.isPro) {
          setIsPro(true);
        }
      } catch (e) {}
    }
  }, []);

  const handlePayment = async () => {
    const options = {
      key: "rzp_test_SgUQKnFFQEK0Xh",
      amount: "2000",
      currency: "INR",
      name: "ExamDost Smart Analysis",
      description: "Unlock Unlimited AI Mentor",
      image: "https://cdn.testbook.com/1761304426269-testbook-white.png/1761304427.png",
      handler: function () {
        const stored = localStorage.getItem("currentUserData");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.isPro = true;
          localStorage.setItem("currentUserData", JSON.stringify(parsed));
        } else {
          localStorage.setItem("currentUserData", JSON.stringify({ isPro: true }));
        }
        
        navigate({ to: "/payment-success", search: { userid } });
      },
      prefill: {
        name: "Test Aspirant",
        email: "aspirant@testbook.com",
        contact: "9999999999",
      },
      theme: {
        color: "#6366f1",
      },
    };

    try {
      await openRazorpayCheckout(options);
    } catch (error: any) {
      alert(error.message || "Razorpay SDK failed to load. Are you online?");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-sans antialiased">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-xl px-4 py-3 shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate({ to: "/mentor-chat", search: { userid } })}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-primary grid place-items-center shadow-sm">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">Exam Dost Pro</h1>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">🔒 Secure</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-6">
        <div className="bg-white rounded-[2rem] sm:rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-10 duration-500 relative overflow-hidden">
          
          {/* Background effect */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-[60px]"></div>

          <div className="text-center mb-6 relative z-10 pt-2">
            {!isPro && <span className="inline-block bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-indigo-100 mb-4">🚀 Limited Offer</span>}
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary grid place-items-center shadow-lg shadow-primary/20 mx-auto mb-4">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{isPro ? "You're a Pro Member!" : "Level Up Your Prep"}</h2>
            <p className="text-[13px] sm:text-[15px] text-slate-500 mt-1.5 font-medium leading-snug">
              {isPro ? "You already have unlimited access to all AI Mentor features." : "Unlimited AI mentorship, strategy & analytics."}
            </p>
          </div>

          <div className="space-y-3 mb-6 relative z-10">
            {[
              "Unlimited AI Chat & Strategy", 
              "Daily Customized Action Plans", 
              "Unlock All Topic Tests & Analytics", 
              "Priority Top-Tier Support"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 bg-slate-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 transition-colors">
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-success/20 grid place-items-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-success" />
                </div>
                <span className="font-bold text-[13px] sm:text-[14px] text-slate-800 leading-tight">{item}</span>
              </div>
            ))}
          </div>

          {!isPro ? (
            <>
              <div className="bg-primary/5 border-2 border-primary rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between shadow-sm relative z-10 transform hover:scale-[1.02] transition-transform">
                <div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary mb-1">Lifetime Pro Access</div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">₹20 <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">/ one-time</span></div>
                </div>
                <span className="bg-success text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full uppercase shadow-sm">Save 90%</span>
              </div>

              <button
                onClick={handlePayment}
                className="w-full py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500 to-primary text-white font-black shadow-xl shadow-primary/25 active:scale-[0.98] hover:shadow-primary/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 text-base sm:text-lg relative z-10"
              >
                <Shield className="h-4 w-4" /> Pay ₹20 &amp; Unlock Now <ArrowRight className="h-4 w-4" />
              </button>

            </>
          ) : (
            <button
              onClick={() => navigate({ to: "/mentor-chat", search: { userid } })}
              className="w-full py-4 rounded-xl sm:rounded-2xl bg-slate-800 text-white font-black shadow-lg shadow-slate-800/20 active:scale-[0.98] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 text-base sm:text-lg relative z-10 mt-6"
            >
              Return to AI Mentor <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
