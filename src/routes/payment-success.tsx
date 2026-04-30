import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { BookOpen, CheckCircle2, GraduationCap, Lightbulb, MessageCircle } from "lucide-react";
import { fetchLmsAnalysis } from "@/services/lmsApi";

type SearchParams = { userid?: string };

const MEERA_AVATAR_URL = "https://cdn.testbook.com/1777459230137-Untitled_design__6_-removebg-preview.png/1777459233.png";

export const Route = createFileRoute("/payment-success")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [showRedirect, setShowRedirect] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Fetch real user data
  useEffect(() => {
    const effectiveUid = userid || sessionStorage.getItem("current_userid") || "demo_user";
    sessionStorage.setItem("current_userid", effectiveUid);

    fetchLmsAnalysis(effectiveUid)
      .then((data) => {
        setUserData(data);
        // Mark user as pro in localStorage
        const stored = localStorage.getItem("currentUserData");
        let parsed = data;
        if (stored) {
          try {
            const cached = JSON.parse(stored);
            if (cached?.user?.userid === effectiveUid) {
              parsed = cached;
            }
          } catch {
            localStorage.removeItem("currentUserData");
          }
        }
        parsed.isPro = true;
        parsed.user = parsed.user || {};
        parsed.user.userid = effectiveUid;
        localStorage.setItem("currentUserData", JSON.stringify(parsed));
      })
      .catch(() => {});
  }, [userid]);

  const userName = userData?.user?.name?.split(" ")[0] || "Aspirant";

  const triggerRedirect = () => {
    setShowRedirect(true);
    setTimeout(() => {
      const uid = userid || sessionStorage.getItem("current_userid") || "demo_user";
      navigate({ to: "/mentor-chat", search: { userid: uid } });
    }, 2600);
  };

  // Slide-to-unlock logic
  const handleSlideStart = (clientX: number) => {
    if (unlocked) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const thumbW = 56;
    const maxX = rect.width - thumbW - 8;

    const move = (x: number) => {
      const nx = Math.min(Math.max(0, x - rect.left - thumbW / 2), maxX);
      setSlideX(nx);
      if (nx >= maxX * 0.88) {
        setUnlocked(true);
        setSlideX(maxX);
        cleanup();
        setTimeout(triggerRedirect, 400);
      }
    };
    const up = () => { if (!unlocked) setSlideX(0); cleanup(); };
    const mm = (e: MouseEvent) => move(e.clientX);
    const tm = (e: TouchEvent) => move(e.touches[0].clientX);
    const cleanup = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tm);
    window.addEventListener("touchend", up);
  };

  const trackW = trackRef.current?.offsetWidth || 320;
  const maxX = trackW - 56 - 8;
  const progress = maxX > 0 ? slideX / maxX : 0;

  // Confetti
  const confetti = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: `${(i / 36) * 100}%`,
    delay: `${(Math.sin(i) * 0.5 + 0.5) * 2}s`,
    duration: `${2.5 + (Math.cos(i) * 0.5 + 0.5) * 2}s`,
    color: ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"][i % 6],
    size: `${7 + (i % 5)}px`,
  }));

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-8 text-center font-sans">
      <style>{`
        @keyframes fall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
        @keyframes successPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 24px rgba(16,185,129,0)} }
        @keyframes shimmerText { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes lockShake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-12deg)} 60%{transform:rotate(10deg)} }
        @keyframes redirectProgress { 0%{width:0%} 100%{width:100%} }
        @keyframes redirectFadeIn { 0%{opacity:0;transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
        @keyframes spinOrbit { 0%{transform:rotate(0deg) translateX(44px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(44px) rotate(-360deg)} }
        .shimmer-txt { background:linear-gradient(90deg,#10b981,#6366f1,#10b981);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmerText 3s linear infinite; }
        .success-ring { animation:successPulse 2s ease-out infinite; }
        .lock-shake { animation:lockShake 0.5s ease-in-out; }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-300/10 blur-[80px] pointer-events-none" />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((p) => (
          <div
            key={p.id}
            className="absolute top-0"
            style={{
              left: p.left, width: p.size, height: p.size,
              backgroundColor: p.color,
              borderRadius: p.id % 3 === 0 ? "50%" : "2px",
              animation: `fall ${p.duration} ${p.delay} linear infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto">
        {/* Success Icon */}
        <div className="relative mx-auto mb-6 h-28 w-28 animate-in zoom-in-50 duration-500">
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <div
            className="relative h-28 w-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center success-ring"
            style={{ boxShadow: "0 0 40px rgba(16,185,129,0.4)" }}
          >
            <CheckCircle2 className="h-14 w-14 text-white drop-shadow" strokeWidth={2.5} />
          </div>
        </div>

        {/* Heading */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "100ms" }}>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-2">🎉 Congratulations</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            Your Payment Was<br />
            <span className="shimmer-txt">Successful!</span>
          </h1>
          <p className="text-base font-bold text-slate-500">
            Welcome aboard, <span className="text-primary font-black">{userName}</span>! 🚀
          </p>
        </div>

        {/* Unlocked Features */}
        <div
          className="animate-in fade-in slide-in-from-bottom-6 duration-700 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-100 shadow-xl p-5 mb-6 mt-6 space-y-3"
          style={{ animationDelay: "200ms" }}
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">✨ Unlocked For You</p>
          {[
            { icon: "🤖", text: "Unlimited AI Mentor Chats" },
            { icon: "📅", text: "7-Day Personalized Study Plan" },
            { icon: "📊", text: "Full Mock Test Analysis" },
            { icon: "🎯", text: "Weak Topic Drill Recommendations" },
          ].map((item, i) => (
            <div
              key={item.text}
              className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500"
              style={{ animationDelay: `${300 + i * 80}ms` }}
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 grid place-items-center shrink-0">
                <span className="text-base">{item.icon}</span>
              </div>
              <span className="text-sm font-bold text-slate-800 text-left flex-1">{item.text}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
          ))}
        </div>

        {/* Slide to unlock CTA */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: "500ms" }}>
          <div
            ref={trackRef}
            className={`relative h-16 w-full rounded-2xl overflow-hidden select-none shadow-xl transition-colors duration-500 ${
              unlocked ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-primary"
            }`}
            style={{ boxShadow: unlocked ? "0 8px 30px rgba(16,185,129,0.4)" : "0 8px 30px rgba(99,102,241,0.3)" }}
          >
            <div className="absolute inset-y-0 left-0 bg-white/15 rounded-2xl transition-none" style={{ width: `${progress * 100}%` }} />

            <div className={`absolute inset-0 flex items-center justify-center gap-2 pointer-events-none transition-opacity duration-200 ${slideX > 40 || unlocked ? "opacity-0" : "opacity-100"}`}>
              <span className="text-white/90 font-black text-sm tracking-wide">Slide to Unlock My Plan</span>
              <span className="text-white/60 text-sm animate-pulse">›</span>
            </div>
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${unlocked ? "opacity-100" : "opacity-0"}`}>
              <span className="text-white font-black text-sm">🔓 Unlocked! Redirecting...</span>
            </div>

            {/* Draggable thumb */}
            <div
              className={`absolute top-1 h-14 w-14 rounded-xl bg-white shadow-lg grid place-items-center cursor-grab active:cursor-grabbing ${unlocked ? "lock-shake" : ""}`}
              style={{ left: `${4 + slideX}px`, transition: slideX === 0 && !unlocked ? "left 0.3s ease" : "none" }}
              onMouseDown={(e) => { e.preventDefault(); handleSlideStart(e.clientX); }}
              onTouchStart={(e) => handleSlideStart(e.touches[0].clientX)}
            >
              {unlocked ? (
                <svg className="h-6 w-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wider text-center">
            Or{" "}
            <button onClick={triggerRedirect} className="text-primary underline underline-offset-2">
              tap here
            </button>{" "}
            to continue
          </p>
        </div>
      </div>

      {/* Redirect Overlay */}
      {showRedirect && (
        <div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden px-6"
          style={{ background: "radial-gradient(circle at 50% 36%, #d8ecff 0%, #c9e4ff 34%, #eaf5ff 78%, #d7eaff 100%)" }}
        >
          <div className="relative flex w-full max-w-sm flex-col items-center">
            <div className="relative grid h-[22rem] w-full place-items-center">
              <MessageCircle className="absolute left-5 top-9 h-11 w-11 rotate-[-8deg] text-white/75" strokeWidth={1.6} />
              <GraduationCap className="absolute right-4 top-10 h-14 w-14 rotate-[16deg] text-white/75" strokeWidth={1.6} />
              <BookOpen className="absolute bottom-14 left-1 h-14 w-14 rotate-[-16deg] text-white/75" strokeWidth={1.6} />
              <Lightbulb className="absolute bottom-10 right-3 h-14 w-14 rotate-[10deg] text-white/75" strokeWidth={1.6} />
              <span className="absolute left-7 top-24 h-4 w-4 rotate-45 rounded-[4px] bg-white/75" />
              <span className="absolute right-8 bottom-24 h-4 w-4 rotate-45 rounded-[4px] bg-white/85" />

              <div className="absolute h-[19rem] w-[19rem] rounded-full border border-white/45" />
              <div className="absolute h-[17.5rem] w-[17.5rem] rounded-full border border-white/45" />
              <div className="absolute h-[16rem] w-[16rem] rounded-full border border-white/50" />
              <div className="absolute h-[14.5rem] w-[14.5rem] rounded-full border border-white/65 bg-white/10 shadow-[inset_0_0_60px_rgba(255,255,255,0.18),0_30px_70px_-42px_rgba(20,79,150,0.7)]" />

              <div className="relative grid h-[18rem] w-[18rem] place-items-end overflow-hidden rounded-full">
                <img
                  src={MEERA_AVATAR_URL}
                  alt="Meera AI"
                  className="h-full w-full scale-[1.1] object-contain object-bottom drop-shadow-2xl"
                />
              </div>
            </div>

            <div className="-mt-2 text-center">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.34em] text-[#0a7cff]">Taking you to</p>
              <h2 className="text-4xl font-black tracking-tight text-[#071432]">Meera AI</h2>
              <p className="mt-3 text-base font-bold text-[#0077ff]">Your Meera AI Mentor is ready</p>
            </div>

            <div className="mt-7 h-1.5 w-60 overflow-hidden rounded-full bg-white/80 shadow-[0_3px_14px_rgba(38,132,255,0.18)]">
              <div className="h-full rounded-full bg-[#0a7cff]" style={{ animation: "redirectProgress 2.4s cubic-bezier(0.4,0,0.2,1) forwards" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
