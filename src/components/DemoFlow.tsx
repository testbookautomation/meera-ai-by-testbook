import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, ArrowLeft, CheckCircle2, X, Zap, Target, Clock, Sparkles,
  TrendingUp, BookOpen, FileText, Brain, MessageCircle, Send, Lock,
  Bot, Calendar, ChevronRight, ChevronDown, ChevronUp, Star, Trophy, PenLine, Rocket, GraduationCap,
  AlertTriangle, Crosshair, Menu, Lightbulb, Mic, User, History, Settings, LogOut, ChevronLeft, BarChart3
} from "lucide-react";
import aiMascot from "@/assets/ai-mascot.png";
import { trackEvent } from "../utils/tracking";
import { fetchLmsAnalysis } from "@/services/lmsApi";
import { requestJson } from "@/services/http";

const MEERA_AVATAR_URL = "https://cdn.testbook.com/1777459230137-Untitled_design__6_-removebg-preview.png/1777459233.png";

export type ScreenId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function normalizeUserId(value: unknown): string | null {
  if (Array.isArray(value)) {
    return normalizeUserId(value[0]);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/["\\]/g, "").trim();
    return cleaned || null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null) {
    return null;
  }
  const cleaned = String(value).replace(/["\\]/g, "").trim();
  return cleaned || null;
}

/* ---------- Sidebar Component ---------- */

function Sidebar({ isOpen, onClose, userData }: { isOpen: boolean; onClose: () => void; userData: any }) {
  const history = [
    { id: 1, title: "Algebra Weaknesses", date: "Today" },
    { id: 2, title: "Geometry Improvement", date: "Yesterday" },
    { id: 3, title: "Time & Work Tips", date: "2 days ago" },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed inset-y-0 left-0 z-[120] w-72 bg-white shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-slate-900 tracking-tight">ExamDost AI</span>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ChevronLeft className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center border border-emerald-200 shadow-sm">
                <User className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-none">
                  {userData?.user?.name || "Aspirant"}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                  {userData?.isPro ? "PRO MEMBER" : "FREE PLAN"}
                </p>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Chat History</p>
            <div className="space-y-1">
              {history.map((item) => (
                <button key={item.id} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left group">
                  <History className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{item.title}</p>
                    <p className="text-[10px] font-medium text-slate-400">{item.date}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 mt-8">Study Hub</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                <Target className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">My Reports</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Study Plan</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/30">
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors text-left">
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-bold">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- Navbar Component ---------- */

export function Navbar({ onMenuClick, userData }: { onMenuClick?: () => void; userData?: any }) {
  const navigate = useNavigate();
  const showMenuButton = Boolean(onMenuClick);

  return (
    <nav className="sticky top-0 z-[100] w-full border-b border-border bg-white/95 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3 md:h-16">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {showMenuButton && (
              <button
                onClick={onMenuClick}
                aria-label="Open menu"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted focus:outline-none transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="flex min-w-0 flex-shrink-0 cursor-pointer items-center gap-2" onClick={() => navigate({ to: "/" })}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="truncate text-base font-black tracking-tight text-slate-900 sm:text-xl">ExamDost AI</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-5 md:flex">
              <button onClick={() => navigate({ to: "/pricing", search: { userid: "demo_user" } })} className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Pricing</button>
              <a href="#features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">How it works</a>
            </div>

            {userData?.user ? (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1 sm:px-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {userData.user.name.charAt(0)}
                </div>
                <span className="hidden pr-2 text-xs font-bold text-slate-700 sm:inline">{userData.user.name.split(' ')[0]}</span>
              </div>
            ) : (
              <button
                onClick={() => navigate({ to: "/", search: { userid: "demo_user" } })}
                className="rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0 sm:px-6 sm:text-sm"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ---------- Screens ---------- */

function Screen1({ onNext, userData, loading }: { onNext: () => void; userData: any; loading: boolean }) {
  const name = userData?.user?.name?.split(' ')[0] || 'Aspirant';
  const analysis = userData?.latestAnalysis;

  return (
    <div className="relative flex min-h-[calc(100dvh-3.25rem)] w-full flex-col overflow-hidden">
      <style>{`
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatUp { 0%{transform:translateY(0)} 50%{transform:translateY(-8px)} 100%{transform:translateY(0)} }
        .grad-bg { background:linear-gradient(135deg,#1e1b4b,#312e81,#4338ca,#3730a3); background-size:300% 300%; animation:gradShift 8s ease infinite; }
        .float-anim { animation:floatUp 3s ease-in-out infinite; }
      `}</style>

      {/* Dark gradient hero */}
      <div className="grad-bg relative flex flex-col items-center justify-center px-4 pt-12 pb-16 text-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.3),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.15),transparent_50%)] pointer-events-none" />

        {/* Animated checkmark */}
        <div className="relative mb-5 float-anim">
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-2xl shadow-emerald-500/40">
            <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {loading ? (
          <div className="w-full max-w-xs">
            <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-3">Syncing Testbook LMS...</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-emerald-300 text-[11px] font-black uppercase tracking-[0.3em] mb-2">✅ Test Completed</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-1">
              Great job, <span className="text-emerald-300">{name}</span>!
            </h1>
            <p className="text-white/50 text-sm font-medium mt-2 max-w-xs">
              Your AI analysis is sealed & ready to reveal.
            </p>
          </>
        )}
      </div>

      {/* Cards — overlap the hero */}
      <div className="relative z-10 -mt-8 px-4 pb-8 flex flex-col items-center gap-4 max-w-lg mx-auto w-full">

        {/* Analysis complete card */}
        <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 bg-emerald-50 border-b border-emerald-100 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-700">Analysis Complete</span>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Latest Mock Test</p>
            <p className="text-base font-black text-slate-900 leading-snug">
              {analysis?.testName || 'Your Latest Attempt'}
            </p>
            {/* Blurred locked metrics — build curiosity */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['Score', 'Rank', 'Accuracy'].map((label) => (
                <div key={label} className="relative bg-slate-50 border border-slate-100 rounded-xl p-3 text-center overflow-hidden">
                  <div className="text-lg font-black text-slate-300 blur-[5px] select-none">??</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] font-bold text-slate-400 mt-3">🔒 Tap below to unlock your results</p>
          </div>
        </div>

        {/* Curiosity teaser */}
        <div className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
          <p className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-3">🧠 Your AI Mentor found…</p>
          <ul className="space-y-2">
            {['Exact weak topics draining your marks', 'Your rank vs 15,000+ students', 'A personalised 7-day score boost plan'].map((hint) => (
              <li key={hint} className="flex items-center gap-2.5 text-sm font-bold text-indigo-900">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {hint}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="w-full animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
          <button
            onClick={onNext}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-primary py-4 text-base font-black text-white shadow-xl shadow-primary/25 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5 text-amber-300" />
            Reveal My Analysis
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <p className="text-center text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wider">
            Powered by ExamDost AI · Testbook
          </p>
        </div>
      </div>
    </div>
  );
}

function Screen2({ onNext, userData, loading }: { onNext: () => void; userData: any; loading: boolean }) {


  const [expandedTests, setExpandedTests] = useState<Record<number, boolean>>({});
  const toggleTest = (id: number) => setExpandedTests(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading && !userData) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const analysis = userData?.latestAnalysis || {
    testName: "Test Analysis",
    attemptDate: new Date().toISOString(),
    accuracy: 24, score: 12.0, totalMarks: 50, rank: 4521, totalStudents: 15000,
    weakTopics: [{ name: "Algebra" }, { name: "Trigonometry Basics" }, { name: "Data Interpretation" }]
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:p-6 md:p-10">
      <div className="relative z-10 mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-center sm:justify-between md:mb-9">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 shadow-lg md:h-12 md:w-12">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl md:text-3xl">{analysis.testName}</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-1 hidden sm:block">Detailed Performance Report</p>
          </div>
        </div>
        <span className="self-start whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm sm:self-auto sm:px-4 sm:py-2 sm:text-sm">
          {new Date(analysis.attemptDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8">
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 md:p-7">
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Score</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground sm:text-sm">{analysis.accuracy}% Accuracy</span>
            </div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="text-4xl font-extrabold sm:text-5xl md:text-6xl">{analysis.score}<span className="text-xl font-semibold text-muted-foreground sm:text-2xl">/{analysis.totalMarks}</span></div>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[image:var(--gradient-primary)] rounded-full transition-all duration-1000" style={{ width: `${(analysis.score / analysis.totalMarks) * 100}%` }} />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mt-3">You scored higher than {analysis.totalStudents ? (100 - (analysis.rank / analysis.totalStudents) * 100).toFixed(1) : 48}% students.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex flex-col justify-center rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm mb-2"><Trophy className="h-4 w-4 text-warning" /> Rank</div>
              <div className="text-2xl sm:text-3xl font-extrabold">{analysis.rank.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">out of {analysis.totalStudents.toLocaleString()}</div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm mb-2"><Clock className="h-4 w-4 text-primary" /> Time Taken</div>
              <div className="text-2xl sm:text-3xl font-extrabold">42<span className="text-base text-muted-foreground">m</span> 15<span className="text-base text-muted-foreground">s</span></div>
              <div className="text-xs text-destructive mt-1">Avg: 38m</div>
            </div>
          </div>
        </div>
        <div className="space-y-4 md:space-y-6">
          <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-2xl border border-border bg-slate-900 p-5 text-white shadow-lg md:p-7">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <AlertTriangle className="w-48 h-48" />
            </div>
            <h3 className="relative z-10 mb-4 flex items-center gap-3 text-lg font-extrabold md:text-2xl">
              <span className="h-8 w-8 rounded-full bg-destructive/20 text-destructive grid place-items-center">⚠️</span> Identified Weak Topics
            </h3>
            <div className="space-y-4 relative z-10">
              {analysis.weakTopics.map((topic: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/5">
                  <span className="font-semibold text-sm sm:text-base">{topic.name || topic}</span>
                  <span className="text-xs font-bold bg-white/20 px-2 sm:px-3 py-1.5 rounded-full">High Priority</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-xl md:mt-10">
        <button onClick={onNext} className="w-full rounded-xl bg-[image:var(--gradient-primary)] px-6 py-3.5 text-base font-extrabold text-white shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.02] md:py-4 md:text-xl">
          See My Smart Analysis ✨
        </button>
      </div>
    </div>
  );
}

function Screen3({ onUnlock, userData, loading }: { onUnlock: () => void; onLater: () => void; userData: any; loading: boolean; userid: string | null }) {

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden animate-pulse">
        <div className="shrink-0 bg-gradient-to-br from-slate-800 to-indigo-900 px-4 pt-8 pb-6 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 rounded-full bg-white/10" />
            <div className="h-6 w-28 rounded-full bg-white/10" />
          </div>
          <div className="h-3 w-36 rounded-full bg-white/10 mt-1" />
          <div className="h-12 w-32 rounded-lg bg-white/10" />
          <div className="h-2 w-full rounded-full bg-white/10" />
          <div className="flex gap-2">
            <div className="h-7 w-24 rounded-full bg-white/10" />
            <div className="h-7 w-20 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="flex-1 bg-slate-50 px-4 pt-3 space-y-3 overflow-hidden">
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="h-44 rounded-2xl bg-slate-200" />
          <div className="h-16 rounded-2xl bg-indigo-100" />
        </div>
        <div className="shrink-0 h-20 bg-white border-t border-slate-100 px-4 py-3">
          <div className="h-12 w-full rounded-2xl bg-emerald-100" />
        </div>
      </div>
    );
  }

  const analysis = userData?.latestAnalysis;
  const rawScore = Number(analysis?.score ?? 0);
  const currentScore = Number(analysis?.displayScore ?? Math.max(0, rawScore));
  const totalMarks = Number(analysis?.totalMarks ?? 150);
  const targetScore = Number(analysis?.targetScore ?? (currentScore + 10));
  const scoreDiff = Number(analysis?.scoreDiff ?? Math.max(5, targetScore - currentScore));
  const aiInsight = analysis?.aiInsight || null;
  const topics: { name?: string; topic?: string; score: number; target?: number }[] = analysis?.weakTopics || [];
  const getTopicLabel = (topic: any) => topic?.name || topic?.topic || "";
  const allWeakTopics = [...topics].filter(t => getTopicLabel(t)).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const testName = analysis?.testName || "Your Latest Mock";
  const rank = analysis?.rank;
  const totalStudents = analysis?.totalStudents;
  const accuracy = analysis?.accuracy || 0;
  const attemptedQuestions = analysis?.attemptedQuestions ?? null;
  const correctQuestions = analysis?.correctQuestions ?? null;
  const incorrectQuestions = analysis?.incorrectQuestions ?? null;
  const skippedQuestions = analysis?.skippedQuestions ?? null;
  const percentile = analysis?.percentile != null ? Number(analysis.percentile) : null;
  const timeTakenSeconds = analysis?.timeTakenSeconds ?? null;
  const totalTimeAllottedSeconds = analysis?.totalTimeAllottedSeconds ?? null;
  const totalQuestions = analysis?.totalQuestions ?? null;
  const barPct = totalMarks > 0 ? Math.min(100, (currentScore / totalMarks) * 100) : 0;
  const targetPct = totalMarks > 0 ? Math.min(100, (targetScore / totalMarks) * 100) : 0;
  const timeLabel = typeof timeTakenSeconds === 'number' && timeTakenSeconds > 0
    ? `${Math.floor(timeTakenSeconds / 60)}m ${Math.round(timeTakenSeconds % 60)}s`
    : "--";
  const allottedLabel = typeof totalTimeAllottedSeconds === 'number' && totalTimeAllottedSeconds > 0
    ? `${Math.floor(totalTimeAllottedSeconds / 60)}m`
    : "--";

  const topicColors = [
    { bar: 'from-red-500 to-rose-400',     badge: 'bg-red-50 border-red-100 text-red-600' },
    { bar: 'from-orange-500 to-amber-400', badge: 'bg-orange-50 border-orange-100 text-orange-600' },
    { bar: 'from-amber-400 to-yellow-300', badge: 'bg-amber-50 border-amber-100 text-amber-700' },
    { bar: 'from-yellow-400 to-lime-300',  badge: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
    { bar: 'from-lime-400 to-green-300',   badge: 'bg-lime-50 border-lime-100 text-lime-700' },
  ];

  const userName = userData?.user?.name?.split(' ')[0] || null;

  // Fetch AI insight from the model when the backend hasn't provided one
  const [liveInsight, setLiveInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (aiInsight || insightLoading || !userData) return;
    const topicList = topics.slice(0, 3).map(getTopicLabel).filter(Boolean).join(', ');
    if (!topicList) return;
    setInsightLoading(true);
    requestJson<any>('/api/ai-mentor/chat', {
      method: 'POST',
      body: JSON.stringify({
        userId: userid || 'demo_user',
        message: `Based on this student's test: score ${rawScore}/${totalMarks}, accuracy ${accuracy}%, rank ${rank}, weak topics: ${topicList}. Write ONE sharp coaching insight in max 18 words. Start with "Fixing" and end with "+${scoreDiff} marks".`,
        history: [],
      }),
    })
      .then((res: any) => { setLiveInsight(res?.data?.text?.trim() || null); })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
  }, [userData]);

  const displayInsight = aiInsight || liveInsight;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-slate-50 font-sans">
      <style>{`
        @keyframes barSlide { from { width: 0 } to { width: var(--w) } }
        .bar-anim { animation: barSlide 1.1s cubic-bezier(0.4,0,0.2,1) forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .fade-up { animation: fadeUp 0.4s ease-out both; }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        .cta-shimmer::after { content:''; position:absolute; inset-y:0; left:0; width:40%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent); animation:shimmer 2.2s ease-in-out infinite; }
        @keyframes ctaPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
        .cta-pulse { animation: ctaPulse 2s ease-in-out infinite; }
      `}</style>

      {/* ═══ HERO — shrink-0, never scrolls ═══ */}
      <div className="relative shrink-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 pt-8 pb-5 text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand row */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="https://cdn.testbook.com/1761304426269-testbook-white.png/1761304427.png"
              alt="Testbook"
              className="h-3.5 w-auto opacity-80 shrink-0"
            />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70 truncate">AI Smart Analysis</span>
          </div>
          <div className="shrink-0 flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-2.5 py-1 ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-black text-[11px]">+{scoreDiff} marks possible</span>
          </div>
        </div>

        {/* User greeting */}
        {userName && (
          <p className="relative text-base font-black text-white mb-1">
            Hi, {userName} 👋
          </p>
        )}

        {/* Test name */}
        <p className="relative text-[10px] font-black uppercase tracking-[0.12em] text-white/65 mb-1.5 truncate">{testName}</p>

        {/* Score + bar row */}
        <div className="relative flex items-center gap-4 mb-3">
          {/* Score number */}
          <div className="shrink-0">
            <span
              className="text-5xl font-black tracking-tight leading-none"
              style={{
                background: 'linear-gradient(140deg,#fff 40%,rgba(255,255,255,0.45))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {rawScore < 0 ? rawScore.toFixed(1) : rawScore}
            </span>
            <span className="text-lg text-white/60 font-bold">/{totalMarks}</span>
          </div>

          {/* Right-side labels + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-bold text-white/75 mb-1">
              <span>Your Score</span>
              {rawScore < 0 && (
                <span className="text-amber-400 text-[9px] font-black">Neg. Marking</span>
              )}
            </div>
            <div className="relative h-2 bg-white/15 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-white/10 rounded-full" style={{ width: `${targetPct}%` }} />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full bar-anim"
                style={{ '--w': `${barPct}%` } as any}
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold mt-1 text-white/60">
              <span>Now: {rawScore < 0 ? rawScore.toFixed(1) : rawScore}</span>
              <span className="text-emerald-400/80">Target: {targetScore}</span>
            </div>
          </div>
        </div>

        {/* Stat pills — single row, horizontal scroll if needed */}
        <div className="relative flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap">
          {rank != null && (
            <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
              <Trophy className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-black text-white">
                #{typeof rank === 'number' ? rank.toLocaleString() : rank}
              </span>
              {totalStudents && (
                <span className="text-[9px] text-white/60 font-bold">/{totalStudents.toLocaleString()}</span>
              )}
            </div>
          )}
          <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
            <Crosshair className="h-3 w-3 text-sky-400" />
            <span className="text-[11px] font-black text-white">{accuracy}%</span>
            <span className="text-[9px] text-white/60 font-bold">acc.</span>
          </div>
          {percentile != null && (
            <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
              <TrendingUp className="h-3 w-3 text-violet-400" />
              <span className="text-[11px] font-black text-white">{percentile.toFixed(1)}%ile</span>
            </div>
          )}
          <div className="shrink-0 flex items-center gap-1 bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
            <Clock className="h-3 w-3 text-slate-300" />
            <span className="text-[11px] font-black text-white">{timeLabel}</span>
          </div>
        </div>
      </div>

      {/* ═══ SCROLLABLE CARDS — flex-1 takes remaining height ═══ */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 py-3 fade-up" style={{ animationDelay: '60ms' }}>
          <h3 className="flex items-center gap-1.5 text-xs font-black text-slate-900 mb-2.5">
            <div className="h-5 w-5 rounded-md bg-primary/10 grid place-items-center">
              <BarChart3 className="h-3 w-3 text-primary" />
            </div>
            Quick Stats
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Attempted", value: attemptedQuestions != null ? `${attemptedQuestions}${totalQuestions != null ? `/${totalQuestions}` : ""}` : "—", color: "text-primary",      bg: "bg-primary/5"  },
              { label: "Correct",   value: correctQuestions   != null ? String(correctQuestions)   : "—", color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Incorrect", value: incorrectQuestions != null ? String(incorrectQuestions) : "—", color: "text-rose-500",    bg: "bg-rose-50"    },
              { label: "Skipped",   value: skippedQuestions   != null ? String(skippedQuestions)   : "—", color: "text-amber-600",  bg: "bg-amber-50"   },
              { label: "Time",      value: timeLabel,    color: "text-slate-700", bg: "bg-slate-50" },
              { label: "Limit",     value: allottedLabel, color: "text-slate-500", bg: "bg-slate-50" },
            ].map((m) => (
              <div key={m.label} className={`${m.bg} rounded-xl px-2 py-2 text-center`}>
                <p className={`text-sm font-black ${m.color} leading-none mb-0.5`}>{m.value}</p>
                <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weak Topics */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 py-3 fade-up" style={{ animationDelay: '130ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <div className="h-5 w-5 rounded-md bg-red-50 grid place-items-center">
                <Brain className="h-3 w-3 text-red-500" />
              </div>
              Weak Topics
            </h3>
            <span className="text-[9px] font-black uppercase tracking-wide text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
              Fix First
            </span>
          </div>

          {allWeakTopics.length > 0 ? (
            <div className="space-y-3">
              {allWeakTopics.map((t, i) => {
                const c = topicColors[Math.min(i, topicColors.length - 1)];
                const pct = Math.min(100, Math.max(0, t.score ?? 0));
                return (
                  <div key={`topic-${i}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-4 w-4 rounded border grid place-items-center shrink-0 text-[8px] font-black ${c.badge}`}>
                          {i + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">{getTopicLabel(t)}</span>
                      </div>
                      <span className="shrink-0 text-[10px] font-black text-slate-400 ml-2">{Math.round(pct)}%</span>
                    </div>
                    <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${c.bar} bar-anim`}
                        style={{ '--w': `${pct}%`, animationDelay: `${i * 70}ms` } as any}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-5 text-center">
              <p className="text-xs font-bold text-slate-400">Take a test to see your weak topics.</p>
            </div>
          )}
        </div>

        {/* AI Insight */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-primary px-3 py-3 shadow-md shadow-primary/15 fade-up"
          style={{ animationDelay: '200ms' }}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
          <div className="relative flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-white/20 grid place-items-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-white/80 uppercase tracking-widest mb-1">AI Insight</p>
              {insightLoading ? (
                <div className="space-y-1.5">
                  <div className="h-3 bg-white/20 rounded-full animate-pulse w-full" />
                  <div className="h-3 bg-white/20 rounded-full animate-pulse w-3/4" />
                </div>
              ) : displayInsight ? (
                <p className="text-xs font-bold text-white leading-relaxed">{displayInsight}</p>
              ) : (
                <p className="text-xs font-bold text-white leading-relaxed">
                  Fixing{' '}
                  <span className="font-black text-emerald-300">{getTopicLabel(topics[0])}</span>
                  {topics[1] ? (
                    <> &amp; <span className="font-black text-emerald-300">{getTopicLabel(topics[1])}</span></>
                  ) : null}{' '}
                  can boost your score by{' '}
                  <span className="font-black text-emerald-300">+{scoreDiff} marks</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CTA — shrink-0, anchored at bottom, no fixed ═══ */}
      <div className="shrink-0 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] bg-white border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <button
          onClick={onUnlock}
          className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-black text-white cta-shimmer cta-pulse hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <Zap className="h-4 w-4 text-emerald-200 animate-bounce" />
          See How to Fix This
          <ArrowRight className="h-4 w-4 animate-[bounce_1s_ease-in-out_infinite_0.15s]" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}


function Screen4({ lang, setLang, onUnlock, userData }: { lang: "EN" | "हिं"; setLang: (l: "EN" | "हिं") => void; onUnlock: () => void; userData?: any }) {
  const topics = userData?.latestAnalysis?.weakTopics || [
    { name: "Algebra", score: 45 },
    { name: "Geometry", score: 38 },
    { name: "Time & Work", score: 52 }
  ];
  const scoreDiff = userData?.latestAnalysis?.scoreDiff || 10;
  const getTopicLabel = (topic: any) => topic?.name || topic?.topic || "Topic";

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden px-3 pb-8 pt-4 sm:px-6 md:pt-7">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "linear-gradient(oklch(0.50 0.24 268) 2px, transparent 2px), linear-gradient(90deg, oklch(0.50 0.24 268) 2px, transparent 2px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at top, black 40%, transparent 80%)" }} />
      <div className="relative mb-5 flex items-center justify-between gap-3 py-2 md:mb-7">
        <h2 className="flex items-center gap-2 text-base font-bold sm:text-xl"><Sparkles className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /> AI Smart Analysis</h2>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setLang("EN")} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${lang === "EN" ? "bg-primary text-white" : "bg-muted hover:bg-slate-200"}`}>EN</button>
          <button onClick={() => setLang("हिं")} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${lang === "हिं" ? "bg-primary text-white" : "bg-muted hover:bg-slate-200"}`}>हिं</button>
        </div>
      </div>
      <div className="relative mx-auto mb-6 max-w-3xl text-center md:mb-10">
        <h3 className="mb-3 text-2xl font-extrabold leading-tight sm:text-4xl md:text-5xl">Your weak topics are the real bottleneck — <br className="hidden md:block" /><span className="text-primary">fix these first.</span></h3>
        <p className="text-sm text-muted-foreground sm:text-base md:text-xl">This plan is built from your own performance, section by section.</p>
      </div>
      <div className="mx-auto mb-7 grid max-w-4xl gap-3 sm:gap-4 md:mb-10 md:grid-cols-2">
        {[
          { icon: Zap, title: `Improve ${getTopicLabel(topics[0]) || "Algebra"} fast`, sub: `Built from your ${Math.round(topics[0]?.score || 20)}% accuracy` },
          { icon: Target, title: `Fix ${getTopicLabel(topics[1]) || "Geometry"} mistakes`, sub: `Guided drills for your own weak spots` },
          { icon: Clock, title: `Save time on ${getTopicLabel(topics[2]) || "Time & Work"}`, sub: `Focus on the topics where you lost marks` },
          { icon: Brain, title: `+${Math.round(scoreDiff)} Marks in 7 Days`, sub: `Personalized plan targeting only your weak topics` },
        ].map((b, i) => (
          <div key={i} className="relative flex items-start gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md sm:gap-4 sm:p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-lg sm:h-12 sm:w-12"><b.icon className="h-5 w-5 sm:h-6 sm:w-6" /></div>
            <div><p className="mb-1 text-sm font-bold leading-tight sm:text-lg">{b.title}</p><p className="text-sm text-muted-foreground leading-relaxed">{b.sub}</p></div>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-2xl space-y-4 text-center sm:space-y-6">
        <button onClick={onUnlock} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-success)] py-3.5 text-base font-bold text-white shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.02] md:w-auto md:px-12 md:py-4 md:text-lg">
          <Bot className="h-6 w-6" /> Talk to AI Mentor Now
        </button>
      </div>
    </div>
  );
}

function Screen5({ messages, input, setInput, send, chatsLeft, isTyping }: { messages: any[]; input: string; setInput: (v: string) => void; send: (text?: string) => void; chatsLeft: number; isTyping: boolean }) {
  const suggestions = ["मेरे नंबर क्यों कम आ रहे हैं?", "स्कोर कैसे बढ़ाऊं?", "कौन सा टॉपिक पढूं?", "टाइम मैनेजमेंट कैसे सुधारूं?"];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="relative flex h-[calc(100dvh-3.25rem)] w-full flex-col bg-white sm:h-[calc(100dvh-3.5rem)] md:h-[80vh]">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 px-3 py-4 sm:px-5 md:px-8 md:py-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[88%] sm:max-w-[75%] flex flex-col ${m.from === "user" ? "items-end" : "items-start"}`}>
              <div className={`px-4 sm:px-5 py-2.5 sm:py-3.5 text-sm sm:text-base leading-relaxed shadow-sm ${m.from === "user"
                  ? "bg-primary text-white rounded-2xl rounded-br-sm"
                  : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm"
                }`}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-slate-200 shadow-sm flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-primary/40 hover:bg-slate-50 active:scale-95 whitespace-nowrap"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>{s}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask your AI Mentor..."
            className="min-w-0 flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 sm:text-base"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() && !isTyping}
            className="grid h-12 w-12 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 transition-transform active:scale-95 disabled:bg-slate-200"
          >
            <Send className="h-5 w-5 -ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExitIntentPopup({ onClose, onContinue, onLeave }: { onClose: () => void; onContinue: () => void; onLeave: () => void }) {
  const items = [
    { icon: MessageCircle, text: "Unlimited Score Coach mentoring" },
    { icon: Crosshair, text: "Your personalized study plan" },
    { icon: TrendingUp, text: "Daily score predictions & nudges" },
    { icon: BookOpen, text: "Hand-picked tests for weak areas" },
  ];
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4 animate-in fade-in-0 duration-200">
      <div className="w-full max-w-lg max-h-[92vh] rounded-3xl bg-white overflow-hidden shadow-2xl text-left animate-in zoom-in-95 duration-200">
        <div className="relative bg-gradient-to-br from-red-600 to-rose-700 text-white p-6 md:p-8">
          <button onClick={onClose} className="absolute right-4 top-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 grid place-items-center transition"><X className="h-5 w-5" /></button>
          <div className="h-12 w-12 rounded-full bg-white/20 grid place-items-center mb-4"><AlertTriangle className="h-6 w-6 text-white" /></div>
          <h3 className="text-xl md:text-2xl font-black leading-tight mb-2 pr-8">Wait! You're about to miss out on <span className="text-yellow-300 underline decoration-wavy">+12 marks</span> in 7 days</h3>
          <p className="text-white/90 text-sm font-bold opacity-80">Your personalized AI plan is ready. Don't lose your progress.</p>
        </div>
        <div className="p-6 md:p-8 space-y-4">
          {items.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-50 grid place-items-center shrink-0"><Icon className="h-5 w-5 text-red-500" /></div>
              <span className="text-sm font-bold text-slate-700 flex-1">{text}</span>
            </div>
          ))}
          <div className="pt-6 space-y-3">
            <button onClick={onContinue} className="w-full bg-[image:var(--gradient-success)] text-white rounded-2xl py-4 font-black text-lg shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition">Continue & Unlock for ₹20 →</button>
            <button onClick={onLeave} className="w-full text-slate-400 font-bold py-3 hover:bg-slate-50 rounded-2xl transition uppercase tracking-widest text-xs">No thanks, I'll lose my progress</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Screen6({ onUnlock, onLater }: { onUnlock: () => void; onLater: () => void }) {
  const [showExit, setShowExit] = useState(false);
  const handlePayment = () => onUnlock();
  return (
    <div className="relative mx-auto max-w-4xl px-3 py-5 text-center sm:px-6 md:py-12">
      <div className="relative mx-auto mb-8 h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <img src={aiMascot} alt="AI Mentor mascot" className="relative h-28 w-28 object-contain drop-shadow-2xl sm:h-36 sm:w-36 md:h-44 md:w-44" />
        <div className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-warning shadow-xl ring-4 ring-white"><Lock className="h-5 w-5 text-white" /></div>
      </div>
      <h3 className="mb-3 text-2xl font-black text-slate-900 leading-tight sm:text-3xl md:text-5xl tracking-tight">Unlock Unlimited AI Mentor</h3>
      <p className="mx-auto mb-8 max-w-2xl text-sm font-bold text-slate-400 sm:text-base md:mb-12 md:text-xl uppercase tracking-wider">You've used all 3 free chats.</p>
      <div className="mx-auto mb-10 grid max-w-3xl gap-4 text-left md:grid-cols-2">
        {["Unlimited AI Chat & Doubts", "7-Day Personalized Study Plan", "Targeted Tests & Notes", "Score Improvement Tracking"].map((f) => (
          <div key={f} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-primary/30 transition-all group">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors"><CheckCircle2 className="h-5 w-5" /></div>
            <span className="text-sm font-black text-slate-700">{f}</span>
          </div>
        ))}
      </div>
      <div className="mb-10">
        <p className="text-4xl md:text-5xl font-black text-primary mb-2 tracking-tight">₹20 <span className="text-2xl text-slate-300">Only</span></p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
        <button onClick={handlePayment} className="w-full rounded-2xl bg-[image:var(--gradient-success)] px-8 py-4 text-base font-black text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all">Unlock Now</button>
        <button onClick={() => setShowExit(true)} className="w-full rounded-2xl py-4 font-bold text-slate-400 hover:bg-slate-100 transition-all">Maybe Later</button>
      </div>
      {showExit && <ExitIntentPopup onClose={() => setShowExit(false)} onContinue={() => { setShowExit(false); handlePayment(); }} onLeave={() => { setShowExit(false); onLater(); }} />}
    </div>
  );
}

function Screen7({ onContinue, userData }: { onContinue: () => void; userData: any }) {
  const [unlocked, setUnlocked] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [showRedirect, setShowRedirect] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const userName = userData?.user?.name?.split(' ')[0] || "Aspirant";

  const triggerRedirect = () => {
    setShowRedirect(true);
    setTimeout(onContinue, 2600);
  };

  // Generate confetti pieces once
  const confetti = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: `${(i / 36) * 100}%`,
    delay: `${(Math.sin(i) * 0.5 + 0.5) * 2}s`,
    duration: `${2.5 + (Math.cos(i) * 0.5 + 0.5) * 2}s`,
    color: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"][i % 6],
    size: `${7 + (i % 5)}px`,
  }));

  const handleSlideStart = (clientX: number) => {
    if (unlocked) return;
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const thumbW = 56;
    const maxX = trackRect.width - thumbW - 8;

    const move = (x: number) => {
      const nx = Math.min(Math.max(0, x - trackRect.left - thumbW / 2), maxX);
      setSlideX(nx);
      if (nx >= maxX * 0.88) {
        setUnlocked(true);
        setSlideX(maxX);
        cleanup();
        setTimeout(triggerRedirect, 400);
      }
    };
    const up = () => {
      if (!unlocked) setSlideX(0);
      cleanup();
    };
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

  return (
    <div className="relative flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center overflow-hidden px-4 py-6 text-center">
      <style>{`
        @keyframes fall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
        @keyframes successPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 20px rgba(16,185,129,0)} }
        @keyframes shimmerText { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes lockShake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-12deg)} 60%{transform:rotate(10deg)} }
        @keyframes redirectProgress { 0%{width:0%} 100%{width:100%} }
        @keyframes redirectFadeIn { 0%{opacity:0;transform:scale(0.9)} 100%{opacity:1;transform:scale(1)} }
        @keyframes spinOrbit { 0%{transform:rotate(0deg) translateX(28px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(28px) rotate(-360deg)} }
        .shimmer-txt { background:linear-gradient(90deg,#10b981,#6366f1,#10b981);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmerText 3s linear infinite; }
        .success-ring { animation:successPulse 2s ease-out infinite; }
        .lock-shake { animation:lockShake 0.5s ease-in-out; }
      `}</style>

      {/* Gradient BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-300/10 blur-[80px] pointer-events-none" />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map(p => (
          <div
            key={p.id}
            className="absolute top-0"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.id % 3 === 0 ? "50%" : "2px",
              animation: `fall ${p.duration} ${p.delay} linear infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto">
        {/* Success ring icon */}
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            Your Payment Was<br />
            <span className="shimmer-txt">Successful!</span>
          </h2>
          <p className="text-base font-bold text-slate-500">
            Welcome aboard, <span className="text-primary font-black">{userName}</span>! 🚀
          </p>
        </div>

        {/* Features card */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-100 shadow-xl p-5 mb-6 mt-6 space-y-3" style={{ animationDelay: "200ms" }}>
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

        {/* Slide to unlock */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: "500ms" }}>
          <div
            ref={trackRef}
            className={`relative h-16 w-full rounded-2xl overflow-hidden select-none shadow-xl transition-colors duration-500 ${unlocked ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-primary"
              }`}
            style={{ boxShadow: unlocked ? "0 8px 30px rgba(16,185,129,0.4)" : "0 8px 30px rgba(99,102,241,0.3)" }}
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-white/15 rounded-2xl transition-none"
              style={{ width: `${progress * 100}%` }}
            />

            {/* Label */}
            <div className={`absolute inset-0 flex items-center justify-center gap-2 pointer-events-none transition-opacity duration-200 ${slideX > 40 || unlocked ? "opacity-0" : "opacity-100"
              }`}>
              <span className="text-white/90 font-black text-sm tracking-wide">Slide to Unlock My Plan</span>
              <span className="text-white/60 text-sm animate-pulse">›</span>
            </div>
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${unlocked ? "opacity-100" : "opacity-0"
              }`}>
              <span className="text-white font-black text-sm">🔓 Unlocked! Opening...</span>
            </div>

            {/* Thumb */}
            <div
              className={`absolute top-1 h-14 w-14 rounded-xl bg-white shadow-lg grid place-items-center cursor-grab active:cursor-grabbing ${unlocked ? "lock-shake" : ""
                }`}
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

            {/* Progress bar */}
            <div className="mt-7 h-1.5 w-60 overflow-hidden rounded-full bg-white/80 shadow-[0_3px_14px_rgba(38,132,255,0.18)]">
              <div className="h-full rounded-full bg-[#0a7cff]" style={{ animation: "redirectProgress 2.4s cubic-bezier(0.4,0,0.2,1) forwards" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Screen8({ onRestart, userData }: { onRestart: () => void; userData: any }) {

  const days = [
    { day: "Day 1", title: "Fix Weak Concepts", sub: "Syllogism + Basic Concepts", done: true },
    { day: "Day 2", title: "Improve Speed", sub: "Ordering & Ranking · Practice", done: true },
    { day: "Day 3", title: "Strengthen Accuracy", sub: "Puzzle + Data Sufficiency", done: false },
  ];
  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your 7-Day Sprint</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Target: +12 Marks Improvement</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl">
          <Trophy className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-black text-emerald-700">65% Progress</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-800"><Calendar className="h-5 w-5 text-primary" /> Today's Action Plan</h3>
          <div className="space-y-3">
            {days.map((d, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 rounded-[1.5rem] border-2 p-5 transition-all ${d.done ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-white shadow-sm'}`}>
                <div className="min-w-0">
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${d.done ? 'text-emerald-600' : 'text-primary'}`}>{d.day}</p>
                  <p className="text-base font-black text-slate-800">{d.title}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">{d.sub}</p>
                </div>
                {d.done ? <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div> : <ChevronRight className="h-6 w-6 text-slate-300" />}
              </div>
            ))}
          </div>
          <button onClick={onRestart} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[image:var(--gradient-primary)] py-4 text-base font-black text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"><Rocket className="h-6 w-6" /> Resume Training</button>
        </div>
      </div>
    </div>
  );
}

export function DemoFlowPage({ screen, userid: routeUserid, liveOnly = false, hideNav = false }: { screen: ScreenId; userid?: string; liveOnly?: boolean; hideNav?: boolean }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userid, setUserid] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"EN" | "हिं">("EN");
  const [chatsLeft, setChatsLeft] = useState(3);
  const [messages, setMessages] = useState<any[]>([{ from: "bot", text: "नमस्ते! मैं आपका AI मेंटर हूँ। आप क्या जानना चाहते हैं?" }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uidFromUrl = normalizeUserId(routeUserid) || normalizeUserId(urlParams.get('userid'));

    // 1. Clean UID from URL → sessionStorage → null
    const rawUid = uidFromUrl || normalizeUserId(sessionStorage.getItem('current_userid'));
    const effectiveUid = rawUid;

    // 2. Validate + restore localStorage cache only for the active user
    if (!liveOnly) {
      const cached = localStorage.getItem('currentUserData');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const topics: any[] = parsed?.latestAnalysis?.weakTopics || [];
          const cachedUserId = parsed?.user?.userid;
          // Cache is only valid if every topic has a truthy name AND a real number score
          const isValid = topics.every(
            t => t.name && typeof t.score === 'number' && !isNaN(t.score)
          );
          if (isValid && (!effectiveUid || cachedUserId === effectiveUid)) {
            setUserData(parsed);
            console.log('[Cache] Restored valid cached data');
          } else {
            localStorage.removeItem('currentUserData');
            console.warn('[Cache] Stale/broken cache cleared — weak topics or userid did not match');
          }
        } catch (_) {
          localStorage.removeItem('currentUserData');
        }
      }
    }

    if (effectiveUid) {
      setUserid(effectiveUid);
      sessionStorage.setItem('current_userid', effectiveUid);
      // Always fetch fresh from API (don't rely on cache alone)
      setLoading(true);
      fetchLmsAnalysis(effectiveUid, { live: liveOnly })
        .then(data => {
          setUserData(data);
          if (!liveOnly) {
            localStorage.setItem('currentUserData', JSON.stringify(data));
          }
          console.log('[LMS] Fresh data loaded. Weak topics:', data?.latestAnalysis?.weakTopics);
          setLoading(false);
        })
        .catch(err => {
          console.error('[LMS] Fetch failed:', err);
          setLoading(false);
        });
    }
  }, []);

  const sendChat = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { from: "user", text: msg }]);
    setInput("");

    if (chatsLeft <= 1) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        go(6);
      }, 1500);
      return;
    }

    setChatsLeft(prev => prev - 1);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { from: "bot", text: `Interesting question about ${msg.split(' ')[0]}! Based on your last mock where you scored ${userData?.latestAnalysis?.score || 12}/50, I recommend focusing on ${userData?.latestAnalysis?.weakTopics?.[0]?.name || 'Algebra'}.` }]);
    }, 2000);
  };

  const go = (s: ScreenId) => {
    const paths: Record<ScreenId, string> = { 1: "/", 2: "/", 3: "/", 4: "/mentor-chat", 5: "/mentor-chat", 6: "/paywall", 7: "/payment-success", 8: "/plan" };
    navigate({ to: paths[s] as any, search: userid ? ({ userid } as any) : undefined });
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Track screen change
    const screenNames = {
      1: "test_result_viewed",
      2: "test_result_viewed",
      3: "ai_popup_shown",
      4: "ai_landing_viewed",
      5: "ai_chat_opened",
      6: "ai_paywall_shown",
      7: "payment_success",
      8: "plan_viewed"
    };
    if (userid && screenNames[s]) {
      trackEvent(userid, screenNames[s], paths[s]);
    }
  };

  const renderScreen = (id: ScreenId) => {
    if (id === 1) return <Screen1 onNext={() => go(3)} userData={userData} loading={loading} />;
    if (id === 2) return <Screen2 onNext={() => go(3)} userData={userData} loading={loading} />;
    if (id === 3) return <Screen3 onUnlock={() => go(5)} onLater={() => go(1)} userData={userData} loading={loading} userid={userid} />;
    if (id === 4) return <Screen4 lang={lang} setLang={setLang} onUnlock={() => go(5)} userData={userData} />;
    if (id === 5) return <Screen5 messages={messages} input={input} setInput={setInput} send={sendChat} chatsLeft={chatsLeft} isTyping={isTyping} />;
    if (id === 6) return <Screen6 onUnlock={() => go(7)} onLater={() => go(1)} />;
    if (id === 7) return <Screen7 onContinue={() => go(4)} userData={userData} />;
    return <Screen8 onRestart={() => { setChatsLeft(3); go(1); }} userData={userData} />;
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userData={userData} />
      {!hideNav && <Navbar onMenuClick={() => setIsSidebarOpen(true)} userData={userData} />}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden">
        <div key={screen} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out w-full flex-1">
          {renderScreen(screen)}
        </div>
      </main>
    </div>
  );
}
