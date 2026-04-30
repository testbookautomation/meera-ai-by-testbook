import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Bot,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Lightbulb,
  Target,
  ArrowRight
} from "lucide-react";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: Array.isArray(search.userid)
      ? String(search.userid[0] ?? "")
      : search.userid != null
        ? String(search.userid)
        : undefined,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();

  const handleStartChat = () => {
    navigate({ to: "/mentor-chat", search: { userid } as any });
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center overflow-hidden bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f2ff_45%,#eef0ff_100%)]">
      {/* Faint background icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none text-[#243b80] opacity-[0.04]">
        <MessageSquare className="absolute top-[15%] left-[10%] w-24 h-24 rotate-[-15deg]" />
        <GraduationCap className="absolute top-[20%] right-[10%] w-32 h-32 rotate-[15deg]" />
        <BookOpen className="absolute bottom-[30%] left-[10%] w-28 h-28 rotate-[-10deg]" />
        <Lightbulb className="absolute bottom-[25%] right-[10%] w-20 h-20 rotate-[10deg]" />
      </div>

      <div className="relative z-10 flex h-[calc(100dvh-6.6rem)] w-full max-w-md flex-col justify-between overflow-hidden px-5 pb-2 pt-[max(0.7rem,env(safe-area-inset-top))]">
        
        {/* Header Text */}
        <div className="text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="mb-0.5 text-[clamp(15px,2.2dvh,19px)] font-bold tracking-wide text-[#26324d]">Meet</h2>
          <div className="flex items-center justify-center">
            <div className="relative inline-block">
              <h1 className="text-[clamp(38px,5.9dvh,48px)] font-black tracking-tight leading-none text-[#111f45]">
                MEERA
              </h1>
              <Sparkles className="absolute -right-6 -top-1 h-5 w-5 text-[#2563eb]" />
            </div>
          </div>
          <p className="mx-auto mt-[clamp(0.45rem,1.4dvh,1rem)] max-w-[280px] text-[clamp(12px,1.75dvh,14px)] font-semibold leading-snug text-[#33415f]">
            Your <span className="px-0.5 text-[#2563eb]"><Sparkles className="inline h-3.5 w-3.5 -mt-0.5" /> Smart AI</span> Assistant<br/>for Every Step of Your Preparation.
          </p>
          
          <div className="mt-[clamp(0.55rem,1.5dvh,1.25rem)] flex items-center justify-center opacity-40">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#2563eb]" />
            <div className="mx-2 h-1.5 w-1.5 rotate-45 bg-[#14b8a6]" />
            <div className="h-px w-16 bg-gradient-to-r from-[#2563eb] to-transparent" />
          </div>
        </div>

        {/* Center Avatar Area */}
        <div className="relative mx-auto my-[clamp(0.25rem,0.9dvh,0.75rem)] flex h-[clamp(225px,37dvh,310px)] w-[clamp(225px,37dvh,310px)] items-center justify-center animate-in zoom-in-95 duration-500 delay-150">
          {/* Outer faint circle */}
          <div className="absolute inset-0 rounded-full border border-[#7aa7ff]/25 bg-[linear-gradient(145deg,rgba(255,255,255,0.5),rgba(214,230,255,0.28))] shadow-[inset_0_0_55px_rgba(37,99,235,0.12),0_18px_45px_-30px_rgba(17,31,69,0.7)]" />
          
          {/* Avatar image */}
          <div className="relative z-10 flex h-full w-full items-end justify-center overflow-hidden rounded-full pt-4">
            <img 
              src="https://cdn.testbook.com/1777459230137-Untitled_design__6_-removebg-preview.png/1777459233.png" 
              alt="Meera AI" 
              className="h-full scale-[1.16] object-contain object-bottom drop-shadow-2xl"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden absolute inset-0 flex items-center justify-center bg-[#0a1b3f] text-white rounded-full">
              <Bot className="w-24 h-24 opacity-80" />
            </div>
          </div>

          {/* Speech bubble */}
          <div className="absolute -right-2 top-[20%] z-20 animate-bounce rounded-2xl rounded-bl-sm border border-white/80 bg-white/90 px-4 py-2.5 shadow-xl shadow-blue-900/10 backdrop-blur [animation-duration:3s]">
            <p className="text-[12px] font-bold leading-tight text-[#53617c]">Hi! I'm</p>
            <div className="flex items-center">
              <span className="text-[15px] font-black text-[#111f45]">MEERA</span>
            </div>
          </div>
        </div>

        {/* Features Flex Row */}
        <div className="flex w-full items-start justify-between gap-2 px-1 animate-in slide-in-from-bottom-8 duration-500 delay-300">
          {[
            { icon: MessageSquare, title: "Instant", subtitle: "Answers", desc: "Get quick and accurate solutions", accent: "bg-[#2563eb] shadow-blue-600/20" },
            { icon: BookOpen, title: "Smart", subtitle: "Learning", desc: "Concepts made easy for you", accent: "bg-[#14b8a6] shadow-teal-600/20" },
            { icon: Target, title: "Exam", subtitle: "Focused", desc: "Stay on track with personalized help", accent: "bg-[#4f46e5] shadow-indigo-600/20" },
            { icon: Lightbulb, title: "Learn", subtitle: "Better", desc: "Understand more. Remember longer.", accent: "bg-[#f59e0b] shadow-amber-600/20" },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center flex-1">
              <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full shadow-md ${f.accent}`}>
                <f.icon className="w-5 h-5 text-white fill-white/20" />
              </div>
              <h3 className="text-[12px] font-bold leading-tight text-[#22304d]">{f.title}</h3>
              <h3 className="mb-1.5 text-[12px] font-bold leading-tight text-[#22304d]">{f.subtitle}</h3>
              <p className="mx-auto max-w-[60px] text-[9px] leading-tight text-[#6a7893]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer Logo */}
        <div className="flex justify-center animate-in fade-in duration-500 delay-500">
          <img src="https://cdn.testbook.com/1755173671769-testbook-logo.png/1755173673.png" alt="Testbook" className="h-8 opacity-95 drop-shadow-sm" />
        </div>
      </div>
      
      {/* Fixed CTA Button */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#eef0ff] via-[#eef0ff]/90 to-transparent px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 animate-in slide-in-from-bottom-full duration-500 delay-500">
        <button
          onClick={handleStartChat}
          className="cta-shine mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#4f46e5] py-4 text-[17px] font-black text-white shadow-xl shadow-blue-700/25 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          Talk to Meera <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
