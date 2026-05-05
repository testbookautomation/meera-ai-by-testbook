import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  X,
  Lightbulb,
  Trophy,
  Target,
  Zap,
  ChevronLeft,
  Mic,
  Menu,
  History,
  Download,
  Volume2,
  VolumeX,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Languages,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { installGlobalEventTracking, trackEvent } from "../utils/tracking";
import { sendAiMentorMessage } from "@/services/aiMentorApi";
import { fetchLmsAnalysis } from "@/services/lmsApi";
import { openRazorpayCheckout } from "@/services/razorpay";
import { synthesizeSpeech } from "@/services/ttsApi";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/mentor-chat")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: search.userid as string | undefined,
  }),
  component: MentorChatPage,
});

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
  timestamp: Date;
  isPlan?: boolean;
  planData?: any;
  showAnalysis?: boolean;
  showFomo?: boolean;
  fomoScore?: number;
  showIntroCard?: boolean;
  introTestName?: string | null;
  introTotalMarks?: number | null;
  showPitch?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Can you give me my report in PDF?",
  "What are my recommended tests?",
  "Analyze my weak topics in detail",
  "Give me a 7-day study sprint",
];

const MEERA_CHAT_AVATAR_URL =
  "https://cdn.testbook.com/1777459230137-Untitled_design__6_-removebg-preview.png/1777462110.png";
const MEERA_PAYWALL_AVATAR_URL =
  "https://cdn.testbook.com/1777529686714-ChatGPT_Image_Apr_30__2026__11_43_10_AM-removebg-preview.png/1777529687.png";
const MEERA_EXIT_AVATAR_URL =
  "https://cdn.testbook.com/1777531366276-ChatGPT%20Image%20Apr%2030%2C%202026%2C%2012_11_29%20PM%20%282%29.png/1777531367.png";

const MAX_RESPONSE_TEXT_CHARS = 9000;
const MAX_VOICE_TEXT_CHARS = 1400;
const STREAM_WORDS_PER_TICK = 8;
const STREAM_TICK_MS = 45;

type LanguageCode = "english" | "hindi" | "hinglish";

const LANGUAGE_OPTIONS: {
  value: LanguageCode;
  label: string;
  shortLabel: string;
}[] = [
  { value: "english", label: "English", shortLabel: "EN" },
  { value: "hindi", label: "Hindi", shortLabel: "HI" },
  { value: "hinglish", label: "Hinglish", shortLabel: "HING" },
];

const UI_TRANSLATIONS: Record<LanguageCode, any> = {
  english: {
    assistant_subtitle: "Smart AI Assistant",
    thinking: "Meera Thinking..",
    typing: "Meera Typing...",
    input_placeholder: "Message Meera AI...",
    listening: "Listening...",
    maybe_later: "Maybe later",
    pro_member: "PRO",
    hello: "Hello",
    im_meera: "I'm Meera AI.",
    default_greet:
      "I'm ready to analyze your Testbook performance. Share your latest mock results or ask me anything!",
    analysis_greet:
      "I've analyzed your performance in the **{testName}**. You scored **{scoreLabel}** with **{accuracy}%** accuracy{rank}.\n\nI've found specific gaps in your preparation. Would you like a personalized strategy to improve your score?",
    unlock_pro: "Unlock Pro Access",
    pro_desc: "Unlimited AI strategy, tests & doubt solving.",
    pay_unlock: "Pay ₹20 & Unlock",
    features: [
      "Unlimited AI Questions & Strategy",
      "Daily Customized Action Plans",
      "Unlock All Topic Tests & Analytics",
    ],
  },
  hindi: {
    assistant_subtitle: "स्मार्ट AI असिस्टेंट",
    thinking: "मीरा सोच रही है..",
    typing: "मीरा टाइप कर रही है...",
    input_placeholder: "मीरा AI को मैसेज करें...",
    listening: "सुन रहा हूँ...",
    maybe_later: "बाद में",
    pro_member: "प्रो",
    hello: "नमस्ते",
    im_meera: "मैं मीरा AI हूँ।",
    default_greet:
      "मैं आपके टेस्टबुक प्रदर्शन का विश्लेषण करने के लिए तैयार हूँ। अपने नवीनतम मॉक परिणाम साझा करें या मुझसे कुछ भी पूछें!",
    analysis_greet:
      "मैंने **{testName}** में आपके प्रदर्शन का विश्लेषण किया है। आपने **{accuracy}%** सटीकता के साथ **{scoreLabel}** स्कोर किया है{rank}।\n\nमुझे आपकी तैयारी में कुछ कमियाँ मिली हैं। क्या आप अपना स्कोर सुधारने के लिए एक व्यक्तिगत रणनीति चाहेंगे?",
    unlock_pro: "प्रो एक्सेस अनलॉक करें",
    pro_desc: "असीमित AI रणनीति, टेस्ट और डाउट सॉल्विंग।",
    pay_unlock: "₹20 भुगतान करें और अनलॉक करें",
    features: [
      "असीमित AI प्रश्न और रणनीति",
      "दैनिक अनुकूलित कार्य योजनाएं",
      "सभी टॉपिक टेस्ट और एनालिटिक्स अनलॉक करें",
    ],
  },
  hinglish: {
    assistant_subtitle: "Smart AI Assistant",
    thinking: "Meera soch rahi hai..",
    typing: "Meera type kar rahi hai...",
    input_placeholder: "Meera AI ko message karein...",
    listening: "Sun raha hoon...",
    maybe_later: "Baad mein",
    pro_member: "PRO",
    hello: "Hello",
    im_meera: "Main Meera AI hoon.",
    default_greet:
      "Main aapki Testbook performance analyze karne ke liye ready hoon. Apne latest mock results share karein ya mujhse kuch bhi puchein!",
    analysis_greet:
      "Maine **{testName}** mein aapki performance analyze ki hai. Aapne **{accuracy}%** accuracy ke saath **{scoreLabel}** score kiya hai{rank}.\n\nMujhe aapki prep mein kuch gaps mile hain. Kya aap score improve karne ke liye personalized strategy chahenge?",
    unlock_pro: "Unlock Pro Access",
    pro_desc: "Unlimited AI strategy, tests & doubt solving.",
    pay_unlock: "Pay ₹20 & Unlock",
    features: [
      "Unlimited AI Questions & Strategy",
      "Daily Customized Action Plans",
      "Unlock All Topic Tests & Analytics",
    ],
  },
};

function normalizeSuggestionText(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionTabs(query: string, analysis?: any) {
  const normalizedQuery = normalizeSuggestionText(query);
  const weakTopics = Array.isArray(analysis?.weakTopics)
    ? analysis.weakTopics
        .map((topic: any) => topic?.topic || topic?.name)
        .filter(Boolean)
    : [];

  const weakTopic = weakTopics[0] || "my weak topic";
  const secondWeakTopic = weakTopics[1] || weakTopic;
  const thirdWeakTopic = weakTopics[2] || weakTopic;

  const pushUnique = (items: string[], value: string) => {
    if (value && !items.includes(value)) items.push(value);
  };

  const chips: string[] = [];
  const isPdf = /pdf|report|download/.test(normalizedQuery);
  const isTest = /recommended|mock|test|attempt|practice/.test(normalizedQuery);
  const isWeak = /weak|topic|chapter|chapter-wise/.test(normalizedQuery);
  const isTime = /time|speed|manage|slow/.test(normalizedQuery);
  const isScore = /score|rank|accuracy|percentile|marks/.test(normalizedQuery);
  const isPlan = /plan|sprint|study|routine/.test(normalizedQuery);

  if (isPdf) {
    pushUnique(chips, "Download my report as PDF");
    pushUnique(chips, "Show weak topics");
    pushUnique(chips, "Compare my last 10 tests");
    pushUnique(chips, "Give me a study plan");
  } else if (isTest) {
    pushUnique(chips, `Show tests for ${weakTopic}`);
    pushUnique(chips, "Give me direct Testbook links");
    pushUnique(chips, "Show chapter-wise practice");
    pushUnique(chips, "What should I attempt next?");
  } else if (isWeak) {
    pushUnique(chips, `Drill ${weakTopic}`);
    pushUnique(chips, `Fix ${secondWeakTopic}`);
    pushUnique(chips, "Show chapter-wise analysis");
    pushUnique(chips, "Explain my weak areas");
  } else if (isTime) {
    pushUnique(chips, "Show time per section");
    pushUnique(chips, "Where do I lose time?");
    pushUnique(chips, "Give me speed drills");
    pushUnique(chips, "Set section time targets");
  } else if (isScore) {
    pushUnique(chips, "How can I improve my score?");
    pushUnique(chips, "Show score trend");
    pushUnique(chips, "Show accuracy breakdown");
    pushUnique(chips, "Rank vs marks comparison");
  } else if (isPlan) {
    pushUnique(chips, "Give me a 7-day study sprint");
    pushUnique(chips, `Focus on ${weakTopic}`);
    pushUnique(chips, `Fix ${secondWeakTopic}`);
    pushUnique(chips, "Set daily targets");
  } else {
    pushUnique(chips, `Drill ${weakTopic}`);
    pushUnique(chips, "Show weak topics");
    pushUnique(chips, "Recommend a test");
    pushUnique(chips, "Give me a 7-day study sprint");
  }

  if (weakTopics.length > 2) {
    pushUnique(chips, `Fix ${thirdWeakTopic}`);
  }

  return chips.slice(0, 4);
}

function cleanTextForVoice(text: string) {
  const cleaned = String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[`*_>#|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > MAX_VOICE_TEXT_CHARS
    ? `${cleaned.slice(0, MAX_VOICE_TEXT_CHARS).trim()}...`
    : cleaned;
}

function normalizeResponseText(text: string) {
  const normalized = String(text || "").trim();
  if (normalized.length <= MAX_RESPONSE_TEXT_CHARS) return normalized;
  return `${normalized.slice(0, MAX_RESPONSE_TEXT_CHARS).trim()}\n\nResponse trimmed for smooth display. Ask Meera to continue for the next part.`;
}

// ─── Exam helpers ──────────────────────────────────────────────────────────

function getDaysLeft(testName: string | null): number {
  const n = (testName || "").toLowerCase();
  const map: [RegExp, string][] = [
    [/cgl/, "2026-09-10"],
    [/chsl/, "2026-08-05"],
    [/cpo/, "2026-10-15"],
    [/mts/, "2026-07-20"],
    [/gd/, "2026-11-01"],
    [/steno/, "2026-09-25"],
  ];
  const hit = map.find(([re]) => re.test(n));
  const target = new Date(hit ? hit[1] : "2026-08-20");
  return Math.max(1, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

function getExamSocialProof(testName: string | null, totalMarks: number | null) {
  const n = (testName || "").toLowerCase();
  const tm = totalMarks ?? 100;
  const topPct = n.includes("cgl") ? 0.96 : 0.94;
  const cutPct = n.includes("cgl") ? 0.74 : n.includes("mts") ? 0.62 : 0.68;
  return {
    students: n.includes("cgl") ? "1,42,865" : n.includes("mts") ? "1,24,492" : "98,742",
    topScore: `${Math.round(tm * topPct)}/${tm}`,
    cutoff: `~${Math.round(tm * cutPct)}/${tm}`,
  };
}

// ─── Questionnaire data ─────────────────────────────────────────────────────

const QUESTIONNAIRE = [
  {
    number: 1, question: "How many SSC CGL mocks have you attempted so far?", emoji: "📝",
    options: [
      { label: "0–2 mocks", value: 1, tag: "Haven't started yet" },
      { label: "3–4 mocks", value: 2, tag: "Just getting started" },
      { label: "5+ mocks", value: 3, tag: "Regularly practicing" },
    ],
  },
  {
    number: 2, question: "What is your average mock score percentage?", emoji: "📊",
    options: [
      { label: "Less than 50%", value: 1, tag: "Needs improvement" },
      { label: "50–70%", value: 2, tag: "On track" },
      { label: "70% and above", value: 3, tag: "Strong performance" },
    ],
  },
  {
    number: 3, question: "What's your accuracy rate in practice questions?", emoji: "🎯",
    options: [
      { label: "Below 60%", value: 1, tag: "Room to grow" },
      { label: "60–80%", value: 2, tag: "Decent accuracy" },
      { label: "Above 80%", value: 3, tag: "High accuracy" },
    ],
  },
  {
    number: 4, question: "How confident are you about clearing SSC CGL Tier 1?", emoji: "💪",
    options: [
      { label: "Not confident", value: 1, tag: "Need more practice" },
      { label: "Somewhat confident", value: 2, tag: "Getting there" },
      { label: "Very confident", value: 3, tag: "Ready to ace it" },
    ],
  },
  {
    number: 5, question: "Which section do you find most challenging?", emoji: "🔍",
    options: [
      { label: "Quantitative Aptitude", value: 2, tag: "Needs focused drills" },
      { label: "Reasoning", value: 2, tag: "Speed & logic practice" },
      { label: "English", value: 2, tag: "Grammar & vocab work" },
      { label: "General Awareness", value: 2, tag: "Daily revision helps" },
    ],
  },
  {
    number: 6, question: "How many hours do you dedicate weekly for SSC CGL prep?", emoji: "⏱️",
    options: [
      { label: "1–3 hours", value: 1, tag: "Low dedication" },
      { label: "5–10 hours", value: 2, tag: "Moderate effort" },
      { label: "More than 10 hours", value: 3, tag: "High commitment" },
    ],
  },
];

// ─── IntroCard (Flow 1 — conversational hook) ───────────────────────────────

function IntroCard({
  testName, onAnalyze,
}: { testName: string | null; totalMarks: number | null; onAnalyze: () => void }) {
  const examLabel = testName ? testName.replace(/:.*/i, "").trim() : "SSC CGL";
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-semibold leading-relaxed">
        Hi, I'm <span className="font-black text-[#2563eb]">Meera</span> — your {examLabel} prep mentor.
        {" "}I just analyzed thousands of aspirants preparing for{" "}
        <span className="font-black">{examLabel}</span> on our platform…
      </p>

      <div>
        <p className="text-[13px] font-bold text-[#1e293b] mb-1.5">📊 Most serious aspirants:</p>
        <div className="space-y-1">
          {[
            "Attempt 6–8 mocks every week",
            "Maintain 70%+ accuracy before the exam",
            "Start full-length tests at least 3 months before Tier 1",
          ].map((b) => (
            <div key={b} className="flex items-start gap-2">
              <span className="font-black text-[#2563eb] text-[13px] mt-px">•</span>
              <p className="text-[13px] font-semibold text-[#334155]">{b}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[13px] font-semibold text-[#475569]">
        But many new aspirants struggle with consistency and{" "}
        <span className="font-black text-[#1e293b]">don't know where they stand.</span>
      </p>

      <p className="text-[13px] font-semibold text-[#475569]">
        Let me quickly understand your preparation level — it'll take{" "}
        <span className="font-black text-[#2563eb]">30 seconds.</span>
      </p>

      <button
        onClick={onAnalyze}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] py-3 text-[14px] font-black text-white shadow-lg shadow-blue-700/20 transition-all hover:brightness-105 active:scale-[0.98]"
      >
        Test Your Preparation <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── QuestionnaireModal ─────────────────────────────────────────────────────

function QuestionnaireModal({ onComplete }: { onComplete: (score: number) => void }) {
  const [step, setStep] = useState(0);
  // answers stores selected option INDEX per question (not value), so keys are always unique
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [fading, setFading] = useState(false);

  const q = QUESTIONNAIRE[step];
  const isLast = step === QUESTIONNAIRE.length - 1;

  const next = () => {
    if (selectedIdx === null || fading) return;
    const nextAnswers = [...answers, selectedIdx];
    if (!isLast) {
      setFading(true);
      setTimeout(() => { setAnswers(nextAnswers); setStep(s => s + 1); setSelectedIdx(null); setFading(false); }, 200);
    } else {
      // Sum option values (not indices) for the final score
      const score = nextAnswers.reduce((sum, idx, qi) => sum + QUESTIONNAIRE[qi].options[idx].value, 0);
      onComplete(score);
    }
  };

  const back = () => {
    if (step === 0 || fading) return;
    setFading(true);
    setTimeout(() => { setStep(s => s - 1); setSelectedIdx(answers[step - 1] ?? null); setAnswers(a => a.slice(0, -1)); setFading(false); }, 200);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[linear-gradient(180deg,#f5f9ff,#eef0ff)] pb-[max(1.4rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="h-1 w-full bg-blue-100">
          <div className="h-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] transition-all duration-500" style={{ width: `${(step / QUESTIONNAIRE.length) * 100}%` }} />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#2563eb]">Preparation Check · {step + 1}/{QUESTIONNAIRE.length}</p>
          <div className="flex gap-1">
            {QUESTIONNAIRE.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i < step ? "w-4 bg-[#2563eb]" : i === step ? "w-6 bg-[#2563eb]" : "w-1.5 bg-blue-200"}`} />
            ))}
          </div>
        </div>

        <div className={`flex flex-col px-5 pt-2 pb-4 transition-all duration-200 ${fading ? "translate-x-3 opacity-0" : "opacity-100"}`}>
          <div className="mb-2 text-[36px] leading-none">{q.emoji}</div>
          <h3 className="mb-5 text-[18px] font-black leading-snug text-[#111f45]">{q.question}</h3>
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, i) => {
              const active = selectedIdx === i;
              return (
                <button key={`${step}-${i}`} onClick={() => setSelectedIdx(i)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all active:scale-[0.98] ${active ? "border-[#2563eb] bg-gradient-to-r from-[#2563eb] to-[#4f46e5] shadow-md" : "border-blue-100 bg-white/90 hover:border-[#2563eb]/40"}`}>
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-white bg-white" : "border-slate-300"}`}>
                    {active && <div className="h-2 w-2 rounded-full bg-[#2563eb]" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[14px] font-black ${active ? "text-white" : "text-[#111f45]"}`}>{opt.label}</p>
                    <p className={`text-[11px] font-semibold ${active ? "text-blue-100" : "text-slate-400"}`}>{opt.tag}</p>
                  </div>
                  {active && <svg className="h-4 w-4 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pt-1">
          <button onClick={next} disabled={selectedIdx === null}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-black text-white shadow-lg transition-all active:scale-[0.98] ${selectedIdx !== null ? "bg-gradient-to-r from-[#2563eb] to-[#4f46e5] shadow-blue-700/20 hover:brightness-105" : "cursor-not-allowed bg-slate-200 shadow-none"}`}>
            {isLast ? "Reveal My Result" : "Next"} <ArrowRight className="h-4 w-4" />
          </button>
          {step > 0 && <button onClick={back} className="mt-2 w-full py-1.5 text-center text-[12px] font-semibold text-slate-400">← Back</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Topic → recommended test mapping ───────────────────────────────────────

const TOPIC_TEST_MAP: { pattern: RegExp; title: string; tag: string; url: string }[] = [
  { pattern: /arithmetic|percent|ratio|profit|loss|interest|average|time.*work|time.*speed|pipe/i, title: "Arithmetic Practice Set", tag: "Boost weak maths", url: "https://testbook.com/ssc-cgl-practice-questions/arithmetic-questions" },
  { pattern: /algebra|equation|linear|quadratic|polynomial/i, title: "Algebra Drills", tag: "Strengthen algebra", url: "https://testbook.com/ssc-cgl-practice-questions/algebra-questions" },
  { pattern: /geometry|mensuration|triangle|circle|area|volume|coordinate/i, title: "Geometry & Mensuration", tag: "Visual maths boost", url: "https://testbook.com/ssc-cgl-practice-questions/geometry-questions" },
  { pattern: /number\s*system|hcf|lcm|divisibility|prime/i, title: "Number System Quiz", tag: "Foundation building", url: "https://testbook.com/ssc-cgl-practice-questions/number-system-questions" },
  { pattern: /data\s*interpret|di|table|chart|graph/i, title: "Data Interpretation Set", tag: "Speed & accuracy", url: "https://testbook.com/ssc-cgl-practice-questions/data-interpretation-questions" },
  { pattern: /reasoning|analogy|series|coding|syllogism|direction|blood\s*relation|puzzle/i, title: "Reasoning Speed Drill", tag: "Score +10 quickly", url: "https://testbook.com/ssc-cgl-practice-questions/reasoning-questions" },
  { pattern: /english|grammar|vocab|comprehension|cloze|error|fill.*blank|idiom|phrase/i, title: "English Practice Test", tag: "Grammar & vocab", url: "https://testbook.com/ssc-cgl-practice-questions/english-questions" },
  { pattern: /general\s*awareness|ga|gk|history|geography|polity|economy|science|biology|physics|chemistry/i, title: "GA Mock Quiz", tag: "GK rapid fire", url: "https://testbook.com/ssc-cgl-practice-questions/general-awareness-questions" },
  { pattern: /current\s*affairs|current|news/i, title: "Current Affairs Test", tag: "Stay updated", url: "https://testbook.com/current-affairs" },
  { pattern: /statistics|data|mean|median|mode|variance/i, title: "Statistics Practice", tag: "Data & stats boost", url: "https://testbook.com/ssc-cgl-practice-questions/statistics-questions" },
];

function getRecommendedTests(weakTopics: any[]): { title: string; tag: string; url: string }[] {
  if (!Array.isArray(weakTopics) || weakTopics.length === 0) return [];
  const results: { title: string; tag: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const wt of weakTopics) {
    const topicName = String(wt?.topic || wt?.name || wt || "");
    for (const mapping of TOPIC_TEST_MAP) {
      if (mapping.pattern.test(topicName) && !seen.has(mapping.title)) {
        seen.add(mapping.title);
        results.push({ title: mapping.title, tag: mapping.tag, url: mapping.url });
        if (results.length >= 3) return results;
        break;
      }
    }
  }
  return results;
}

// ─── FomoCard (Flow 3 — insight reveal only) ────────────────────────────────

function FomoCard({ score }: { score: number }) {
  const uid = Math.round(score * 100);
  const readiness = Math.round(((score - 6) / 12) * 70) + 8;
  const isLow = readiness < 40;
  const isMid = readiness >= 40 && readiness < 70;
  const isGreen = readiness >= 70;
  const zoneColor = isGreen ? "#16a34a" : isMid ? "#d97706" : "#dc2626";

  const [animReadiness, setAnimReadiness] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1600;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimReadiness(Math.round(eased * readiness));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [readiness]);

  const insight = isLow
    ? { behind: "80%", gap: "lack of mock exposure + low accuracy", warning: "clearing Tier 1 will be very difficult", fix: "4–6 weeks" }
    : isMid
    ? { behind: "55%", gap: "inconsistency in practice + accuracy gaps", warning: "your rank will stay below cutoff", fix: "3–4 weeks" }
    : { behind: "25%", gap: "sectional weak spots + time management", warning: "toppers will still outpace you", fix: "2–3 weeks" };

  // SVG gauge params
  const CX = 130, CY = 128, R = 104;
  function toXY(deg: number): [number, number] {
    const r = (deg * Math.PI) / 180;
    return [CX + R * Math.cos(r), CY - R * Math.sin(r)];
  }
  function arcD(s: number, e: number) {
    const [sx, sy] = toXY(s), [ex, ey] = toXY(e);
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }
  const needleLen = R - 18;
  const nRad = ((180 - (animReadiness / 100) * 180) * Math.PI) / 180;
  const nX = (CX + needleLen * Math.cos(nRad)).toFixed(2);
  const nY = (CY - needleLen * Math.sin(nRad)).toFixed(2);

  function tickAt(deg: number) {
    const inner = R - 26, outer = R - 4;
    const ri = (deg * Math.PI) / 180;
    return {
      x1: (CX + inner * Math.cos(ri)).toFixed(2), y1: (CY - inner * Math.sin(ri)).toFixed(2),
      x2: (CX + outer * Math.cos(ri)).toFixed(2), y2: (CY - outer * Math.sin(ri)).toFixed(2),
    };
  }
  const t40 = tickAt(108), t70 = tickAt(54);

  // Animated zone color based on animReadiness
  const animIsGreen = animReadiness >= 70;
  const animIsMid = animReadiness >= 40 && animReadiness < 70;
  const animColor = animIsGreen ? "#16a34a" : animIsMid ? "#d97706" : "#dc2626";

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-bold text-[#1e293b]">Here's what I found 👇</p>

      {/* Gauge card */}
      <div className="overflow-hidden rounded-2xl shadow-xl border border-slate-200/80">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a1628] via-[#0f172a] to-[#1e3a8a] px-4 py-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300/80 mb-0.5">Analysis Complete</p>
          <p className="text-[16px] font-black tracking-tight text-white leading-snug">
            Your Exam Readiness Score
          </p>
        </div>

        {/* Gauge bg */}
        <div className="bg-gradient-to-b from-[#f8fafc] to-white px-2 pb-3 pt-1">
          <svg viewBox="0 0 260 162" className="mx-auto block w-full max-w-[280px]">
            <defs>
              <filter id={`nd-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1e293b" floodOpacity="0.3"/>
              </filter>
              <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Track shadow */}
            <path d={arcD(180, 0)} stroke="#cbd5e1" strokeWidth="28" fill="none" strokeLinecap="round" />
            {/* Track base */}
            <path d={arcD(180, 0)} stroke="#f1f5f9" strokeWidth="24" fill="none" strokeLinecap="round" />

            {/* Colored zones */}
            <path d={arcD(180, 108)} stroke="#ef4444" strokeWidth="24" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={arcD(108, 54)} stroke="#f59e0b" strokeWidth="24" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={arcD(54, 0)} stroke="#22c55e" strokeWidth="24" fill="none" strokeLinecap="round" opacity="0.9" />

            {/* White separator ticks */}
            <line x1={t40.x1} y1={t40.y1} x2={t40.x2} y2={t40.y2} stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1={t70.x1} y1={t70.y1} x2={t70.x2} y2={t70.y2} stroke="white" strokeWidth="3.5" strokeLinecap="round" />

            {/* Needle shadow */}
            <line x1={CX} y1={CY} x2={nX} y2={nY} stroke="#1e293b" strokeWidth="5" strokeLinecap="round" opacity="0.15" />
            {/* Needle */}
            <line x1={CX} y1={CY} x2={nX} y2={nY} stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" filter={`url(#nd-${uid})`} />

            {/* Pivot rings */}
            <circle cx={CX} cy={CY} r="14" fill="#1e293b" />
            <circle cx={CX} cy={CY} r="10" fill="white" />
            <circle cx={CX} cy={CY} r="5" fill={animColor} />

            {/* Zone labels */}
            <text x="13" y="154" fontSize="9.5" fill="#ef4444" fontWeight="800">Danger</text>
            <text x={CX} y="20" fontSize="9.5" fill="#d97706" fontWeight="800" textAnchor="middle">Caution</text>
            <text x="247" y="154" fontSize="9.5" fill="#16a34a" fontWeight="800" textAnchor="end">Green</text>

            {/* Percentage */}
            <text x={CX} y={CY - 24} fontSize="42" fontWeight="900" fill={animColor} textAnchor="middle" letterSpacing="-2">{animReadiness}%</text>
          </svg>

          {/* Zone badge */}
          <div className="flex justify-center -mt-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-black shadow-md" style={{ backgroundColor: `${zoneColor}15`, color: zoneColor, border: `2px solid ${zoneColor}50` }}>
              {isGreen ? "✓ Green Zone" : isMid ? "⚡ Caution Zone" : "⚠ Danger Zone"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-[13px]">⚠️</span>
          <p className="text-[13px] font-semibold text-[#1e293b]">
            You're currently behind <span className="font-black text-[#dc2626]">{insight.behind} of serious aspirants</span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[13px]">📌</span>
          <p className="text-[13px] font-semibold text-[#1e293b]">
            Your biggest gap is <span className="font-black">{insight.gap}</span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[13px]">📉</span>
          <p className="text-[13px] font-semibold text-[#475569]">
            If this continues, <span className="font-black text-[#1e293b]">{insight.warning}</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
        <p className="text-[13px] font-black text-emerald-800">✅ But the good part?</p>
        <p className="mt-0.5 text-[13px] font-semibold text-emerald-700">
          This is fixable within <span className="font-black">{insight.fix}</span> with the right strategy.
        </p>
      </div>
    </div>
  );
}

// ─── PitchCard (Flow 4 — smart pitch, conversational) ───────────────────────

function PitchCard({ lmsTests, weakTopics }: { lmsTests?: { title: string; link: string }[]; weakTopics?: any[] }) {
  const tests = (lmsTests && lmsTests.length > 0)
    ? lmsTests.map((t) => ({ title: t.title, tag: "Recommended by Meera", url: t.link }))
    : getRecommendedTests(weakTopics ?? []);

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold text-[#1e293b]">
        Top performers on Testbook follow a simple system:
      </p>

      <div className="space-y-1">
        {["Regular full-length mocks", "Sectional tests for weak areas", "Detailed performance analysis"].map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="text-emerald-500 font-black">✅</span>
            <p className="text-[13px] font-semibold text-[#1e293b]">{f}</p>
          </div>
        ))}
      </div>

      <p className="text-[13px] font-semibold text-[#475569]">
        That's exactly what our <span className="font-black text-[#2563eb]">SSC CGL Test Series</span> helps you do 👇
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          "Full-length mocks based on latest pattern",
          "Sectional + topic-wise tests",
          "Rank + percentile vs lakhs of students",
          "AI-based analysis (I'll guide you after every test)",
        ].map((f) => (
          <div key={f} className="flex items-start gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2 py-1.5">
            <span className="text-[#2563eb] text-xs mt-px font-black">●</span>
            <p className="text-[10px] font-semibold text-[#334155] leading-snug">{f}</p>
          </div>
        ))}
      </div>

      {tests.length > 0 ? (
        <div className="space-y-2">
          {tests.map((test) => (
            <a key={test.title} href={test.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 transition-all hover:border-[#2563eb]/40 hover:bg-blue-50 active:scale-[0.98]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-[#111f45]">{test.title}</p>
                <p className="text-[10px] font-semibold text-[#2563eb]">{test.tag}</p>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] px-2.5 py-1 text-[11px] font-black text-white">
                Start <ArrowRight className="h-3 w-3" />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <a href="https://testbook.com/ssc-cgl/mock-tests" target="_blank" rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] py-3 text-[14px] font-black text-white shadow-lg shadow-blue-700/20 transition-all hover:brightness-105 active:scale-[0.98]">
          👉 Start SSC CGL Test Series <ArrowRight className="h-4 w-4" />
        </a>
      )}

      <p className="text-[13px] font-semibold text-[#475569]">
        👉 Want me to create your <span className="font-black text-[#2563eb]">personalized test plan</span> and get you started?
      </p>
    </div>
  );
}

// ─── AnalysisMeterCard ──────────────────────────────────────────────────────

function AnalysisMeterCard({ accuracy, score, totalMarks, rank, testName }: {
  accuracy: number | null; score: number | null; totalMarks: number | null; rank: string | null; testName: string | null;
}) {
  const acc = typeof accuracy === "number" ? Math.max(0, Math.min(100, accuracy)) : 0;
  const CX = 100, CY = 108, R = 82;
  function toXY(deg: number): [number, number] {
    const r = (deg * Math.PI) / 180;
    return [CX + R * Math.cos(r), CY - R * Math.sin(r)];
  }
  function arcD(s: number, e: number) {
    const [sx, sy] = toXY(s), [ex, ey] = toXY(e);
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }
  const needleDeg = 180 - (acc / 100) * 180;
  const nRad = (needleDeg * Math.PI) / 180;
  const nX = (CX + (R - 12) * Math.cos(nRad)).toFixed(2);
  const nY = (CY - (R - 12) * Math.sin(nRad)).toFixed(2);
  const isGreen = acc >= 70, isCaution = acc >= 40 && acc < 70;
  const zoneColor = isGreen ? "#16a34a" : isCaution ? "#d97706" : "#dc2626";
  const zoneBg = isGreen ? "from-green-50 to-emerald-50 border-green-200" : isCaution ? "from-amber-50 to-yellow-50 border-amber-200" : "from-red-50 to-rose-50 border-red-200";
  const hasData = typeof accuracy === "number";

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${zoneBg} p-4`}>
      <p className="mb-1 text-center text-[11px] font-semibold text-slate-500">{testName ? `Analysis · ${testName}` : "Performance Analysis"}</p>
      {hasData ? (
        <>
          <svg viewBox="0 0 200 125" className="mx-auto block w-full max-w-[220px]">
            <path d={arcD(180, 0)} stroke="#e2e8f0" strokeWidth="16" fill="none" strokeLinecap="round" />
            <path d={arcD(180, 108)} stroke="#ef4444" strokeWidth="16" fill="none" strokeLinecap="round" />
            <path d={arcD(108, 54)} stroke="#f59e0b" strokeWidth="16" fill="none" strokeLinecap="round" />
            <path d={arcD(54, 0)} stroke="#22c55e" strokeWidth="16" fill="none" strokeLinecap="round" />
            <line x1={CX} y1={CY} x2={nX} y2={nY} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="5.5" fill="#1e293b" />
            <text x="14" y="120" fontSize="7.5" fill="#ef4444" fontWeight="700">Danger</text>
            <text x={CX} y="18" fontSize="7.5" fill="#d97706" fontWeight="700" textAnchor="middle">Caution</text>
            <text x="186" y="120" fontSize="7.5" fill="#16a34a" fontWeight="700" textAnchor="end">Green</text>
            <text x={CX} y={CY - 20} fontSize="21" fontWeight="800" fill={zoneColor} textAnchor="middle">{acc.toFixed(0)}%</text>
            <text x={CX} y={CY - 7} fontSize="7" fill="#64748b" textAnchor="middle">Accuracy</text>
          </svg>
          <div className="mb-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: `${zoneColor}20`, color: zoneColor }}>
              {isGreen ? "✓" : isCaution ? "⚡" : "⚠"} {isGreen ? "Green Zone" : isCaution ? "Caution Zone" : "Danger Zone"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {score !== null && totalMarks !== null && <div className="rounded-lg bg-white/70 py-2"><p className="text-sm font-bold text-slate-700">{score}/{totalMarks}</p><p className="text-[10px] font-medium text-slate-400">Score</p></div>}
            <div className="rounded-lg bg-white/70 py-2"><p className="text-sm font-bold" style={{ color: zoneColor }}>{acc.toFixed(1)}%</p><p className="text-[10px] font-medium text-slate-400">Accuracy</p></div>
            {rank ? <div className="rounded-lg bg-white/70 py-2"><p className="text-sm font-bold text-slate-700">#{rank}</p><p className="text-[10px] font-medium text-slate-400">Rank</p></div> : null}
          </div>
        </>
      ) : (
        <p className="py-4 text-center text-xs text-slate-400">No analysis data available yet.</p>
      )}
    </div>
  );
}

function MentorChatPage() {
  const { userid: searchUserid } = Route.useSearch();
  const navigate = useNavigate();
  const [userid, setUserid] = useState<string>("demo_user");
  const [userData, setUserData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [recommendedTests, setRecommendedTests] = useState<{ title: string; link: string }[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<
    "thinking" | "typing" | null
  >(null);
  const [responseLanguage, setResponseLanguage] =
    useState<LanguageCode>("english");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAbortControllerRef = useRef<AbortController | null>(null);
  const speakingIdRef = useRef<string | null>(null);
  const hasUserInteractedRef = useRef(false);
  const thoughtIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responseAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const responseRunIdRef = useRef(0);
  const useridRef = useRef(userid);
  const fomoScoreRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const injectTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recognitionRef = useRef<any>(null);
  const aiBusy = isTyping || isStreaming;

  useEffect(() => {
    useridRef.current = userid;
  }, [userid]);

  useEffect(() => {
    speakingIdRef.current = speakingId;
  }, [speakingId]);

  useEffect(
    () => installGlobalEventTracking(() => useridRef.current, "mentor_chat"),
    [],
  );

  const stopVoiceOutput = (eventName = "ai_voice_stopped") => {
    const activeMessageId = speakingIdRef.current;
    voiceAbortControllerRef.current?.abort();
    voiceAbortControllerRef.current = null;

    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
      voiceAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    speakingIdRef.current = null;
    setSpeakingId(null);
    if (activeMessageId) {
      trackEvent(useridRef.current, eventName, "mentor_chat", {
        messageId: activeMessageId,
      });
    }
  };

  const speakWithBrowserVoiceFallback = (
    voiceText: string,
    msgId: string,
    auto: boolean,
    reason: string,
  ) => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(voiceText);
    utterance.lang = responseLanguage === "hindi" ? "hi-IN" : "en-IN";

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (voice) =>
          voice.name.includes("Google") &&
          (voice.lang.includes("hi") || voice.lang.includes("en-IN")),
      ) || voices.find((voice) => voice.lang === utterance.lang);
    if (preferredVoice) utterance.voice = preferredVoice;

    speakingIdRef.current = msgId;
    setSpeakingId(msgId);
    utterance.onend = () => {
      speakingIdRef.current = null;
      if (isMountedRef.current) setSpeakingId(null);
      trackEvent(useridRef.current, "ai_voice_finished", "mentor_chat", {
        messageId: msgId,
        fallback: true,
      });
    };
    utterance.onerror = () => {
      speakingIdRef.current = null;
      if (isMountedRef.current) setSpeakingId(null);
      trackEvent(useridRef.current, "ai_voice_error", "mentor_chat", {
        messageId: msgId,
        fallback: true,
      });
    };

    trackEvent(
      useridRef.current,
      "ai_voice_browser_fallback_started",
      "mentor_chat",
      {
        messageId: msgId,
        auto,
        reason,
      },
    );
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const speakText = async (text: string, msgId: string, auto = false) => {
    if (speakingIdRef.current === msgId) {
      stopVoiceOutput();
      return;
    }

    stopVoiceOutput("ai_voice_replaced");

    const voiceText = cleanTextForVoice(text);
    if (!voiceText) return;

    const abortController = new AbortController();
    voiceAbortControllerRef.current = abortController;
    speakingIdRef.current = msgId;
    setSpeakingId(msgId);
    trackEvent(
      useridRef.current,
      auto ? "ai_voice_auto_started" : "ai_voice_started",
      "mentor_chat",
      {
        messageId: msgId,
        textLength: voiceText.length,
        responseLanguage,
      },
    );

    try {
      const audioData = await synthesizeSpeech({
        text: voiceText,
        responseLanguage,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted || !isMountedRef.current) return;
      if (!audioData?.mimeType || !audioData?.audioContent) {
        throw new Error("Invalid TTS response");
      }

      const player = new Audio(
        `data:${audioData.mimeType};base64,${audioData.audioContent}`,
      );
      voiceAudioRef.current = player;
      player.onended = () => {
        voiceAudioRef.current = null;
        voiceAbortControllerRef.current = null;
        speakingIdRef.current = null;
        if (isMountedRef.current) setSpeakingId(null);
        trackEvent(useridRef.current, "ai_voice_finished", "mentor_chat", {
          messageId: msgId,
        });
      };
      player.onerror = () => {
        voiceAudioRef.current = null;
        voiceAbortControllerRef.current = null;
        speakingIdRef.current = null;
        if (isMountedRef.current) setSpeakingId(null);
        trackEvent(useridRef.current, "ai_voice_error", "mentor_chat", {
          messageId: msgId,
        });
      };

      await player.play().catch((err) => {
        // Autoplay blocked — fall through to browser voice fallback
        throw err;
      });
    } catch (error) {
      if (abortController.signal.aborted || !isMountedRef.current) return;

      const message = error instanceof Error ? error.message : "unknown";
      if (speakWithBrowserVoiceFallback(voiceText, msgId, auto, message)) {
        voiceAbortControllerRef.current = null;
        voiceAudioRef.current = null;
        return;
      }

      voiceAbortControllerRef.current = null;
      voiceAudioRef.current = null;
      speakingIdRef.current = null;
      setSpeakingId(null);
      trackEvent(useridRef.current, "ai_voice_error", "mentor_chat", {
        messageId: msgId,
        auto,
        error: message,
      });
    }
  };

  const [activeSuggestions, setActiveSuggestions] =
    useState(DEFAULT_SUGGESTIONS);

  useEffect(() => {
    // Read questionnaire score before any async ops
    try {
      const raw = sessionStorage.getItem("meera_questionnaire");
      if (raw) {
        const parsed = JSON.parse(raw) as { score: number };
        fomoScoreRef.current = parsed.score;
        sessionStorage.removeItem("meera_questionnaire");
      }
    } catch {
      sessionStorage.removeItem("meera_questionnaire");
    }

    // 1. Clean UID from URL → sessionStorage → demo fallback
    let rawUid =
      searchUserid || sessionStorage.getItem("current_userid") || "demo_user";
    const effectiveUid = rawUid.replace(/["\\]/g, "");
    let hasCachedData = false;

    setUserid(effectiveUid);
    sessionStorage.setItem("current_userid", effectiveUid);
    setLoading(true);
    trackEvent(effectiveUid, "ai_chat_opened", "mentor_chat");

    // 2. Reuse cached data only if it belongs to the same user
    const stored = localStorage.getItem("currentUserData");
    let localIsPro = false;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.user?.userid === effectiveUid) {
          setUserData(parsed);
          localIsPro = !!parsed.isPro;
          setIsPro(localIsPro);
          initChat(parsed.user?.name || "Aspirant", parsed.latestAnalysis);
          setActiveSuggestions(buildSuggestionTabs("", parsed.latestAnalysis));
          hasCachedData = true;
          setLoading(false);
        }
      } catch {
        localStorage.removeItem("currentUserData");
      }
    }

    // 3. Always fetch FRESH from the LMS API — no cache
    const controller = new AbortController();

    // Injects intro card (always) and FOMO card (if questionnaire was done)
    // Must be called AFTER the final initChat so messages aren't overwritten
    const safeInject = (delay: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!isMountedRef.current) return;
        fn();
      }, delay);
      injectTimeoutsRef.current.push(t);
    };

    const injectCards = (testName: string | null, totalMarks: number | null) => {
      safeInject(900, () => {
        setMessages((prev) => [
          ...prev,
          { id: "intro-card", from: "bot" as const, text: " ", timestamp: new Date(), showIntroCard: true, introTestName: testName, introTotalMarks: totalMarks },
        ]);
      });

      if (fomoScoreRef.current !== null) {
        const sc = fomoScoreRef.current;
        fomoScoreRef.current = null;
        safeInject(1200, () => {
          setMessages((prev) => [...prev, { id: "fomo-card", from: "bot" as const, text: " ", timestamp: new Date(), showFomo: true, fomoScore: sc }]);
        });
        safeInject(2800, () => {
          setMessages((prev) => [...prev, { id: "pitch-card", from: "bot" as const, text: " ", timestamp: new Date(), showPitch: true }]);
          fetch(`/api/recommended-tests/${encodeURIComponent(effectiveUid)}`)
            .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then((p) => { if (isMountedRef.current && p.success && Array.isArray(p.data) && p.data.length > 0) setRecommendedTests(p.data); })
            .catch((e) => { console.warn("[Meera] Recommended tests fetch failed:", e.message); });
        });
        safeInject(4200, () => {
          setMessages((prev) => [...prev, { id: "trigger-msg", from: "bot" as const, text: "Also — students who start mocks early improve their score by **15–25 marks** on average.\n\nYou don't need more studying. You need **smarter practice.** 🔥", timestamp: new Date() }]);
        });
      }
    };

    fetchLmsAnalysis(effectiveUid, { signal: controller.signal })
      .then((freshData) => {
        const isPaidUser = freshData.isPro || localIsPro;
        freshData.isPro = isPaidUser;
        trackEvent(effectiveUid, "lms_analysis_loaded", "mentor_chat", {
          isPro: isPaidUser,
          hasLatestAnalysis: !!freshData.latestAnalysis,
          weakTopicCount: Array.isArray(freshData.latestAnalysis?.weakTopics)
            ? freshData.latestAnalysis.weakTopics.length
            : 0,
        });

        localStorage.setItem("currentUserData", JSON.stringify(freshData));
        setUserData(freshData);
        setIsPro(isPaidUser);
        initChat(freshData.user?.name || "Aspirant", freshData.latestAnalysis);
        setActiveSuggestions(buildSuggestionTabs("", freshData.latestAnalysis));
        setLoading(false);
        injectCards(freshData.latestAnalysis?.testName ?? null, freshData.latestAnalysis?.totalMarks ?? null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[Mentor Chat] LMS fetch failed:", err);
        trackEvent(effectiveUid, "lms_analysis_failed", "mentor_chat", {
          error: err?.message || "unknown",
        });
        if (!hasCachedData) {
          initChat("Aspirant", null);
        }
        setLoading(false);
        injectCards(null, null);
      });

    return () => controller.abort();
  }, [searchUserid]);

  useEffect(() => {
    if (!hasUserInteractedRef.current && userData) {
      initChat(userData.user?.name || "Aspirant", userData.latestAnalysis);
    }
  }, [responseLanguage]);

  const initChat = (name: string, analysis: any) => {
    const cleanName = name?.toLowerCase().includes("testbook")
      ? "Aspirant"
      : name?.split(" ")[0] || "Aspirant";

    const rawScore =
      typeof analysis?.score === "number" ? analysis.score : null;
    const totalMarks = analysis?.totalMarks || null;
    const accuracy =
      typeof analysis?.accuracy === "number" ? analysis.accuracy : null;
    const testName = analysis?.testName || null;
    const rank = analysis?.rank || null;

    const t = UI_TRANSLATIONS[responseLanguage] || UI_TRANSLATIONS.english;
    let greetBody = "";
    if (testName && totalMarks !== null && rawScore !== null) {
      const scoreLabel =
        rawScore < 0
          ? `${rawScore} (negative marking)`
          : `${rawScore}/${totalMarks}`;
      const rankText = rank
        ? responseLanguage === "hindi"
          ? ` (रैंक ${rank})`
          : ` (Rank ${rank})`
        : "";

      greetBody = t.analysis_greet
        .replace("{testName}", testName)
        .replace("{scoreLabel}", scoreLabel)
        .replace("{accuracy}", String(accuracy ?? "—"))
        .replace("{rank}", rankText);
    } else {
      greetBody = t.default_greet;
    }

    // Welcome message suppressed — IntroCard serves as the opening message
    setMessages((prev) =>
      hasUserInteractedRef.current && prev.length > 0 ? prev : [],
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isStreaming, aiThoughts]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (thoughtIntervalRef.current) clearInterval(thoughtIntervalRef.current);
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      responseAbortControllerRef.current?.abort();
      voiceAbortControllerRef.current?.abort();
      voiceAudioRef.current?.pause();
      // Clear all inject card timeouts
      injectTimeoutsRef.current.forEach((t) => clearTimeout(t));
      injectTimeoutsRef.current = [];
      // Stop speech recognition if active
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      trackEvent(userid, "voice_input_stopped", "mentor_chat");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      trackEvent(userid, "voice_input_unsupported", "mentor_chat");
      alert("Voice input is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      trackEvent(userid, "voice_input_started", "mentor_chat");
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join("");
      setInput(transcript);
      trackEvent(userid, "voice_input_transcript", "mentor_chat", {
        length: transcript.length,
        transcript,
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      trackEvent(userid, "voice_input_error", "mentor_chat", {
        error: event.error,
      });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      trackEvent(userid, "voice_input_ended", "mentor_chat");
    };

    recognition.start();
  };

  const handleSend = (textToSend?: string) => {
    if (isTyping || isStreaming) return;

    const msgText = textToSend || input;
    if (!msgText.trim()) return;
    stopVoiceOutput();

    if (!isPro && messageCount >= 3) {
      trackEvent(userid, "paywall_shown", "mentor_chat", {
        reason: "free_message_limit",
        attemptedMessage: msgText,
        messageCount,
      });
      setShowPaywall(true);
      return;
    }

    const newUserMsg: Message = {
      id: Math.random().toString(),
      from: "user",
      text: msgText,
      timestamp: new Date(),
    };
    const historyForApi = [...messages, newUserMsg].map((m) => ({
      from: m.from,
      text: m.text,
    }));

    hasUserInteractedRef.current = true;
    setMessages((prev) => [...prev, newUserMsg]);
    if (!textToSend) setInput("");
    setMessageCount((prev) => prev + 1);

    // Track interactions
    if (textToSend) {
      trackEvent(userid, "ai_chat_suggestion_clicked", "mentor_chat", {
        suggestion: msgText,
      });
      trackEvent(userid, "ai_message_sent", "mentor_chat", {
        source: "suggestion",
        message: msgText,
        length: msgText.length,
        messageCount: messageCount + 1,
        responseLanguage,
      });
    } else {
      trackEvent(userid, "ai_message_sent", "mentor_chat", {
        source: "typed",
        message: msgText,
        length: msgText.length,
        messageCount: messageCount + 1,
        responseLanguage,
      });
    }

    setActiveSuggestions(
      buildSuggestionTabs(msgText, userData?.latestAnalysis),
    );

    stopRequestedRef.current = false;
    responseRunIdRef.current += 1;
    const runId = responseRunIdRef.current;
    if (thoughtIntervalRef.current) clearInterval(thoughtIntervalRef.current);
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    responseAbortControllerRef.current?.abort();
    responseAbortControllerRef.current = null;

    setIsTyping(true);
    setLoadingStage("thinking");
    setAiThoughts([]);

    const thoughts = [
      "Analyzing your latest mock test data...",
      "Identifying weak patterns and time sinks...",
      "Cross-referencing with topper strategies...",
    ];

    let thoughtIndex = 0;
    thoughtIntervalRef.current = setInterval(() => {
      if (stopRequestedRef.current || responseRunIdRef.current !== runId) {
        if (thoughtIntervalRef.current)
          clearInterval(thoughtIntervalRef.current);
        thoughtIntervalRef.current = null;
        return;
      }

      if (thoughtIndex < thoughts.length) {
        setAiThoughts((prev) => [...prev, thoughts[thoughtIndex]]);
        thoughtIndex++;
      } else {
        if (thoughtIntervalRef.current)
          clearInterval(thoughtIntervalRef.current);
        thoughtIntervalRef.current = null;
        setLoadingStage("typing");
        setAiThoughts([]);
        generateBotResponse(msgText, historyForApi, runId);
      }
    }, 1200);
  };

  const stopAiResponse = () => {
    if (!aiBusy) return;
    trackEvent(userid, "ai_response_stopped", "mentor_chat", {
      loadingStage,
      isTyping,
      isStreaming,
    });

    stopRequestedRef.current = true;
    responseRunIdRef.current += 1;

    if (thoughtIntervalRef.current) clearInterval(thoughtIntervalRef.current);
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    thoughtIntervalRef.current = null;
    streamIntervalRef.current = null;

    responseAbortControllerRef.current?.abort();
    responseAbortControllerRef.current = null;
    stopVoiceOutput();

    setIsTyping(false);
    setIsStreaming(false);
    setLoadingStage(null);
    setAiThoughts([]);
    setMessages((prev) =>
      prev.filter((m) => !(m.from === "bot" && !m.text.trim())),
    );
  };

  const generateBotResponse = async (
    userText: string,
    conversationHistory: { from: "bot" | "user"; text: string }[],
    runId: number,
  ) => {
    const responseStartedAt = Date.now();
    try {
      setIsTyping(true);
      setLoadingStage("typing");
      const abortController = new AbortController();
      responseAbortControllerRef.current = abortController;

      const rawResponse = await sendAiMentorMessage({
        userId: userid || "demo_user",
        message: userText,
        history: conversationHistory,
        responseLanguage,
        signal: abortController.signal,
      });
      responseAbortControllerRef.current = null;

      if (!isMountedRef.current || stopRequestedRef.current || responseRunIdRef.current !== runId) return;
      if (typeof rawResponse !== "string" || !rawResponse.trim()) {
        throw new Error("Empty or invalid response from AI");
      }

      const fullText = normalizeResponseText(rawResponse);
      trackEvent(userid, "ai_response_received", "mentor_chat", {
        prompt: userText,
        response: fullText,
        responseLength: fullText.length,
        durationMs: Date.now() - responseStartedAt,
        responseLanguage,
      });

      if (stopRequestedRef.current || responseRunIdRef.current !== runId)
        return;

      const botMsgId = Math.random().toString();
      const newBotMsg: Message = {
        id: botMsgId,
        from: "bot",
        text: "",
        timestamp: new Date(),
      };

      setIsStreaming(true);
      setMessages((prev) => [...prev, newBotMsg]);

      let currentText = "";
      let index = 0;
      const words = fullText.split(" ");

      streamIntervalRef.current = setInterval(() => {
        if (stopRequestedRef.current || responseRunIdRef.current !== runId) {
          if (streamIntervalRef.current)
            clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
          return;
        }

        if (index < words.length) {
          const nextWords = words.slice(index, index + STREAM_WORDS_PER_TICK);
          currentText += (index === 0 ? "" : " ") + nextWords.join(" ");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, text: currentText } : m,
            ),
          );
          index += STREAM_WORDS_PER_TICK;
        } else {
          if (streamIntervalRef.current)
            clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
          setIsStreaming(false);
          setIsTyping(false);
          setLoadingStage(null);
          setAiThoughts([]);
          trackEvent(userid, "ai_response_rendered", "mentor_chat", {
            responseLength: fullText.length,
            wordCount: words.length,
            durationMs: Date.now() - responseStartedAt,
          });
          if (hasUserInteractedRef.current) void speakText(fullText, botMsgId, true);
        }
      }, STREAM_TICK_MS);
    } catch (error: any) {
      if (stopRequestedRef.current || responseRunIdRef.current !== runId)
        return;

      console.error("AI Mentor Chat Error:", error);
      trackEvent(userid, "ai_response_failed", "mentor_chat", {
        prompt: userText,
        error: error?.message || "unknown",
        durationMs: Date.now() - responseStartedAt,
      });
      setIsTyping(false);
      setLoadingStage(null);
      setAiThoughts([]);
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev.filter((m) => m.text !== ""),
        {
          id: Math.random().toString(),
          from: "bot",
          text: `Error: ${error.message || "Could not reach Meera AI."}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handlePayment = async () => {
    trackEvent(userid, "ai_payment_initiated", "mentor_chat", {
      price: 20,
      currency: "INR",
      source: "paywall",
    });

    const options = {
      key: "rzp_test_SgUQKnFFQEK0Xh",
      amount: "2000",
      currency: "INR",
      name: "ExamDost Smart Analysis",
      description: "Unlock Unlimited Meera AI",
      image:
        "https://cdn.testbook.com/1755173671769-testbook-logo.png/1755173673.png",
      handler: function (response: any) {
        setShowPaywall(false);
        setMessageCount(0);

        const stored = localStorage.getItem("currentUserData");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.isPro = true;
          parsed.user = parsed.user || {};
          parsed.user.userid = userid;
          localStorage.setItem("currentUserData", JSON.stringify(parsed));
          setIsPro(true);
        } else {
          localStorage.setItem(
            "currentUserData",
            JSON.stringify({ isPro: true, user: { userid } }),
          );
          setIsPro(true);
        }

        trackEvent(userid, "payment_success", "mentor_chat", {
          amount: 20,
          currency: "INR",
          razorpayPaymentId: response?.razorpay_payment_id || "",
          razorpayOrderId: response?.razorpay_order_id || "",
          razorpaySignaturePresent: !!response?.razorpay_signature,
        });
        navigate({ to: "/payment-success", search: { userid } });
      },
      modal: {
        ondismiss: function () {
          trackEvent(userid, "payment_dismissed", "mentor_chat", {
            amount: 20,
            currency: "INR",
          });
        },
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
      const checkout = await openRazorpayCheckout(options);
      checkout?.on?.("payment.failed", function (response: any) {
        trackEvent(userid, "payment_failed", "mentor_chat", {
          amount: 20,
          currency: "INR",
          code: response?.error?.code || "",
          description: response?.error?.description || "",
          reason: response?.error?.reason || "",
          step: response?.error?.step || "",
        });
      });
      trackEvent(userid, "payment_checkout_opened", "mentor_chat", {
        amount: 20,
        currency: "INR",
      });
    } catch (error: any) {
      trackEvent(userid, "payment_checkout_failed_to_open", "mentor_chat", {
        error: error?.message || "unknown",
      });
      alert(error.message || "Razorpay SDK failed to load. Are you online?");
    }
  };

  const renderMessageText = (text: string) => {
    // Strip markdown links from display — they are rendered as CTA buttons below
    const stripped = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "");

    const renderInlineMarkdown = (value: string, keyPrefix: string) => {
      const parts = value.split(/(`[^`]+`|\*\*.*?\*\*)/g);

      return parts.map((part, index) => {
        const key = `${keyPrefix}-${index}`;
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={key} className="font-black">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={key}
              className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] font-bold text-[#1d4ed8]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={key}>{part}</span>;
      });
    };

    const normalizeTableRow = (line: string) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

    const isTableSeparator = (line: string) =>
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

    const isTableStart = (lines: string[], index: number) =>
      lines[index]?.includes("|") && isTableSeparator(lines[index + 1] || "");

    const lines = stripped.split(/\r?\n/);
    const blocks: JSX.Element[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (isTableStart(lines, index)) {
        const header = normalizeTableRow(lines[index]);
        index += 2;

        const rows: string[][] = [];
        while (
          index < lines.length &&
          lines[index].includes("|") &&
          lines[index].trim()
        ) {
          rows.push(normalizeTableRow(lines[index]));
          index += 1;
        }

        blocks.push(
          <div
            key={`table-${index}`}
            className="my-2 max-w-full overflow-x-auto rounded-xl border border-blue-100 bg-white shadow-sm"
          >
            <table className="min-w-full border-collapse text-left text-[12px] leading-normal">
              <thead className="bg-blue-50/80 text-[#1d4ed8]">
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      className="whitespace-nowrap border-b border-blue-100 px-3 py-2 font-black"
                    >
                      {renderInlineMarkdown(cell, `th-${index}-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="odd:bg-white even:bg-slate-50/80"
                  >
                    {header.map((_, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border-b border-slate-100 px-3 py-2 align-top text-[#25324a] last:border-b-0"
                      >
                        {renderInlineMarkdown(
                          row[cellIndex] || "",
                          `td-${index}-${rowIndex}-${cellIndex}`,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }

      const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (bulletMatch) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
          if (!match) break;
          items.push(match[1]);
          index += 1;
        }
        blocks.push(
          <ul key={`ul-${index}`} className="my-1.5 list-disc space-y-1 pl-5">
            {items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {renderInlineMarkdown(item, `li-${index}-${itemIndex}`)}
              </li>
            ))}
          </ul>,
        );
        continue;
      }

      const numberedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (numberedMatch) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
          if (!match) break;
          items.push(match[1]);
          index += 1;
        }
        blocks.push(
          <ol
            key={`ol-${index}`}
            className="my-1.5 list-decimal space-y-1 pl-5"
          >
            {items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {renderInlineMarkdown(item, `oli-${index}-${itemIndex}`)}
              </li>
            ))}
          </ol>,
        );
        continue;
      }

      // Safety: if current line is somehow empty here, skip it to prevent infinite loop
      if (!line.trim()) { index += 1; continue; }

      const paragraphLines: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !isTableStart(lines, index) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index])
      ) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      // Safety: if no lines collected, advance index to prevent infinite loop
      if (paragraphLines.length === 0) { index += 1; continue; }

      blocks.push(
        <p key={`p-${index}`} className="my-1.5 first:mt-0 last:mb-0">
          {renderInlineMarkdown(paragraphLines.join(" "), `p-${index}`)}
        </p>,
      );
    }

    return blocks;
  };

  const handleDownloadPDF = () => {
    try {
      trackEvent(userid, "ai_pdf_download_started", "mentor_chat");
      const doc = new jsPDF();
      const name = userData?.user?.name || "Aspirant";
      const analysis = userData?.latestAnalysis;

      // Styling
      doc.setFillColor(0, 185, 107); // Testbook Green
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.text("ExamDost AI Performance Report", 20, 25);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(`Student Name: ${name}`, 20, 50);
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, 20, 58);

      doc.line(20, 65, 190, 65);

      doc.setFontSize(18);
      doc.text("LATEST MOCK PERFORMANCE", 20, 78);

      doc.setFontSize(12);
      doc.text(`Mock Test: ${analysis?.testName || "Latest Attempt"}`, 25, 88);
      doc.text(`Score: ${analysis?.score} / ${analysis?.totalMarks}`, 25, 95);
      doc.text(`Accuracy: ${analysis?.accuracy}%`, 25, 102);
      doc.text(
        `Rank: ${analysis?.rank} of ${analysis?.totalStudents} students`,
        25,
        109,
      );

      doc.setFontSize(18);
      doc.text("WEAK TOPICS & IMPROVEMENT PLAN", 20, 125);

      let y = 135;
      const topics = analysis?.weakTopics || [];
      if (topics.length > 0) {
        topics.forEach((topic: any, i: number) => {
          doc.setFontSize(13);
          doc.text(`${i + 1}. ${topic.topic || topic.name}`, 25, y);
          doc.setFontSize(11);
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Current Accuracy: ${topic.accuracy || topic.score}%`,
            30,
            y + 6,
          );
          doc.setTextColor(0, 0, 0);
          y += 18;
        });
      } else {
        doc.text(
          "Complete more mock tests for a detailed topic breakdown.",
          25,
          135,
        );
      }

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "This report was generated by ExamDost Meera AI - Powered by Testbook.",
        20,
        280,
      );

      doc.save(`ExamDost_Report_${name.split(" ")[0]}.pdf`);
      trackEvent(userid, "ai_pdf_downloaded", "mentor_chat", {
        studentName: name,
        testName: analysis?.testName || "",
      });
    } catch (err) {
      console.error("PDF Generation failed:", err);
      trackEvent(userid, "ai_pdf_download_failed", "mentor_chat", {
        error: err instanceof Error ? err.message : "unknown",
      });
      alert("Could not generate PDF. Please try again.");
    }
  };

  const parseCTAs = (responseText: string) => {
    // 1. Detect Markdown links: [Label](url)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const ctas: {
      label: string;
      action: string;
      type: "link" | "pdf" | "internal";
    }[] = [];
    let match;

    while ((match = mdLinkRegex.exec(responseText)) !== null) {
      ctas.push({ label: match[1], action: match[2], type: "link" });
    }

    // 2. Detect bracketed buttons: [Button Name]
    const buttonRegex = /\[([^\]]+)\]/g;
    while ((match = buttonRegex.exec(responseText)) !== null) {
      const label = match[1];

      // Skip if it was already matched as part of a markdown link
      if (responseText.includes(`](${label}`)) continue;
      if (ctas.find((c) => c.label === label)) continue;

      if (
        label.toLowerCase().includes("pdf") ||
        label.toLowerCase().includes("download report")
      ) {
        ctas.push({ label, action: "pdf_download", type: "pdf" });
      } else if (
        label.toLowerCase().includes("mock") ||
        label.toLowerCase().includes("practice")
      ) {
        ctas.push({ label, action: `/?userid=${userid}`, type: "internal" });
      } else {
        ctas.push({
          label,
          action: `https://testbook.com/search?q=${encodeURIComponent(label)}`,
          type: "link",
        });
      }
    }
    return ctas;
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#f2f6ff_45%,#f7f9fc_100%)] font-sans antialiased">
      <header className="relative z-10 shrink-0 border-b border-blue-100/70 bg-white/88 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 shadow-[0_8px_28px_-24px_rgba(37,99,235,0.55)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[2.5rem] w-full max-w-2xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 rounded-full border border-blue-100/80 bg-gradient-to-r from-white to-blue-50/70 px-2.5 py-1.5 shadow-sm">
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-blue-200/80 bg-blue-50 shadow-[0_6px_16px_-10px_rgba(37,99,235,0.75)]">
              <img
                src={MEERA_CHAT_AVATAR_URL}
                alt="Meera"
                className="h-full w-full scale-125 object-cover object-top"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center text-left">
              <h1 className="leading-none text-[14.5px] font-black tracking-tight text-[#132247]">
                Meera
              </h1>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]" />
                <span className="truncate text-[10px] font-bold leading-none text-[#62708d]">
                  {UI_TRANSLATIONS[responseLanguage]?.assistant_subtitle ||
                    "Smart AI Assistant"}
                </span>
              </div>
            </div>
            {isPro && (
              <span className="ml-1 flex items-center rounded-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/10">
                {UI_TRANSLATIONS[responseLanguage]?.pro_member || "PRO"}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <label className="relative flex h-8 items-center gap-1.5 rounded-full border border-blue-200/80 bg-gradient-to-r from-white to-blue-50 px-2 text-[11px] font-black text-[#2563eb] shadow-sm">
              <Languages className="h-3.5 w-3.5 shrink-0" />
              <span className="sr-only">Response language</span>
              <select
                value={responseLanguage}
                onChange={(e) => {
                  const nextLanguage = e.target.value as LanguageCode;
                  trackEvent(
                    userid,
                    "response_language_changed",
                    "mentor_chat",
                    {
                      from: responseLanguage,
                      to: nextLanguage,
                    },
                  );
                  setResponseLanguage(nextLanguage);
                }}
                title="Response language"
                className="w-[2.85rem] appearance-none bg-transparent pr-2 text-[11px] font-black uppercase text-[#2563eb] outline-none"
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.shortLabel}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] leading-none text-[#2563eb]/70">
                v
              </span>
            </label>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════
          MESSAGES — slate bg
      ══════════════════════════════ */}
      <section className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_12%_8%,rgba(37,99,235,0.055),transparent_34%),radial-gradient(circle_at_92%_32%,rgba(20,184,166,0.06),transparent_30%)] px-4 py-5 [scrollbar-width:none] touch-pan-y [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-2">
          {messages
            .filter((msg) => msg.from === "user" || msg.text.trim() !== "" || msg.showAnalysis || msg.showFomo || msg.showIntroCard || msg.showPitch)
            .map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Bot avatar */}
                {msg.from === "bot" && (
                  <div className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-blue-200/80 bg-blue-50 shadow-sm">
                    <img
                      src={MEERA_CHAT_AVATAR_URL}
                      alt="Meera"
                      className="h-full w-full scale-125 object-cover object-top"
                    />
                  </div>
                )}

                <div
                  className={`flex min-w-0 max-w-[82%] flex-col ${msg.from === "user" ? "items-end" : "items-start"}`}
                >
                  {/* Bubble */}
                  <div
                    className={`max-w-full overflow-hidden break-words text-[14px] leading-[1.7] [overflow-wrap:anywhere] ${
                      msg.from === "user"
                        ? "bg-gradient-to-br from-[#2563eb] to-[#4f46e5] text-white px-4 py-3 rounded-2xl rounded-br-sm shadow-[0_12px_28px_-18px_rgba(37,99,235,0.75)]"
                        : msg.showAnalysis
                          ? "w-[280px] rounded-2xl rounded-bl-sm overflow-hidden"
                          : "bg-white/95 text-[#18243d] px-4 py-3 rounded-2xl rounded-bl-sm shadow-[0_10px_30px_-24px_rgba(15,23,42,0.7)] border border-blue-100/70"
                    }`}
                  >
                    {msg.showIntroCard ? (
                      (() => { try { return <IntroCard testName={msg.introTestName ?? null} totalMarks={null} onAnalyze={() => setShowQuestionnaire(true)} />; } catch { return null; } })()
                    ) : msg.showFomo ? (
                      (() => { try { const s = typeof msg.fomoScore === "number" && !isNaN(msg.fomoScore) ? msg.fomoScore : 9; return <FomoCard score={s} />; } catch { return null; } })()
                    ) : msg.showPitch ? (
                      (() => { try { return <PitchCard lmsTests={recommendedTests} weakTopics={userData?.latestAnalysis?.weakTopics} />; } catch { return null; } })()
                    ) : msg.showAnalysis ? (
                      (() => { try { return <AnalysisMeterCard accuracy={userData?.latestAnalysis?.accuracy ?? null} score={userData?.latestAnalysis?.score ?? null} totalMarks={userData?.latestAnalysis?.totalMarks ?? null} rank={userData?.latestAnalysis?.rank ?? null} testName={userData?.latestAnalysis?.testName ?? null} />; } catch { return null; } })()
                    ) : (
                    <>
                    <div className="break-words font-[450] [overflow-wrap:anywhere]">
                      {renderMessageText(msg.text)}
                    </div>

                    {msg.from === "bot" && parseCTAs(msg.text).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-blue-100 pt-3">
                        {parseCTAs(msg.text).map((cta, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              trackEvent(
                                userid,
                                "ai_cta_clicked",
                                "mentor_chat",
                                {
                                  type: cta.type,
                                  label: cta.label,
                                  action: cta.action,
                                },
                              );
                              if (cta.type === "pdf") handleDownloadPDF();
                              else if (cta.type === "internal") {
                                trackEvent(
                                  userid,
                                  "internal_navigation_clicked",
                                  "mentor_chat",
                                  { to: cta.action },
                                );
                                navigate({
                                  to: cta.action as any,
                                  search: { userid } as any,
                                });
                              } else {
                                trackEvent(
                                  userid,
                                  "external_link_opened",
                                  "mentor_chat",
                                  { url: cta.action, label: cta.label },
                                );
                                window.open(cta.action, "_blank");
                              }
                            }}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition-all active:scale-95 ${
                              cta.type === "pdf"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            }`}
                          >
                            {cta.type === "pdf" && (
                              <Download className="h-3 w-3" />
                            )}
                            {cta.label}
                            {cta.type !== "pdf" && (
                              <ArrowRight className="h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    </>
                    )}
                  </div>

                  {/* Timestamp + speak — hidden for card-only messages */}
                  {!msg.showFomo && !msg.showPitch && !msg.showIntroCard && !msg.showAnalysis && (
                  <div className="flex items-center gap-2 mt-1 px-0.5">
                    <span className="text-[10px] tabular-nums text-slate-400">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {msg.from === "bot" && msg.text.trim() && (
                      <button
                        onClick={() => void speakText(msg.text, msg.id)}
                        className={`flex items-center gap-1 text-[10px] font-semibold transition-colors ${speakingId === msg.id ? "animate-pulse text-[#2563eb]" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        {speakingId === msg.id ? "Stop" : "Listen"}
                      </button>
                    )}
                  </div>
                  )}
                </div>
              </div>
            ))}

          {/* Typing indicator */}
          {isTyping && !isStreaming && (
            <div className="flex items-end gap-2.5 justify-start animate-in fade-in duration-200">
              <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-blue-200/80 bg-blue-50 shadow-sm">
                <img
                  src={MEERA_CHAT_AVATAR_URL}
                  alt="Meera"
                  className="h-full w-full scale-125 object-cover object-top"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-blue-100/80 bg-white/95 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.7)]">
                <span className="whitespace-nowrap text-xs font-semibold text-[#62708d]">
                  {loadingStage === "typing"
                    ? UI_TRANSLATIONS[responseLanguage]?.typing
                    : UI_TRANSLATIONS[responseLanguage]?.thinking}
                </span>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#2563eb]/70 animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#2563eb]/70 animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#2563eb]/70 animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </section>

      {/* ══════════════════════════════
          INPUT — white
      ══════════════════════════════ */}
      <div className="shrink-0 border-t border-blue-100/80 bg-white/92 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] shadow-[0_-12px_34px_-30px_rgba(37,99,235,0.6)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl">
          {/* Suggestion chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap">
            {activeSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                disabled={aiBusy}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-100 bg-gradient-to-r from-white to-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#61708b] shadow-sm transition-all hover:border-blue-200 hover:text-[#1d4ed8] disabled:opacity-30"
              >
                <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                {s}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 shadow-inner transition-all duration-200 ${
              isListening
                ? "border-red-200 bg-red-50"
                : "border-blue-100 bg-[#f8fbff] focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100"
            }`}
          >
            {/* Mic */}
            <button
              onClick={() => {
                if (!isPro && messageCount >= 3) {
                  trackEvent(userid, "paywall_shown", "mentor_chat", {
                    reason: "voice_after_free_limit",
                    messageCount,
                  });
                  setShowPaywall(true);
                  return;
                }
                toggleListening();
              }}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all ${
                isListening
                  ? "animate-pulse bg-red-500 text-white shadow-md shadow-red-500/20"
                  : "border border-blue-100 bg-white text-[#64748b] shadow-sm hover:bg-blue-50 hover:text-[#2563eb]"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Text / waveform */}
            {isListening ? (
              <div className="flex-1 flex items-center gap-1 h-9 px-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full animate-bounce"
                    style={{
                      height: `${30 + i * 12}%`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
                <span className="ml-2 text-xs font-semibold text-red-500 animate-pulse">
                  {UI_TRANSLATIONS[responseLanguage]?.listening ||
                    "Listening..."}
                </span>
              </div>
            ) : (
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  if (!isPro && messageCount >= 3) {
                    trackEvent(userid, "paywall_shown", "mentor_chat", {
                      reason: "typing_after_free_limit",
                      messageCount,
                    });
                    setShowPaywall(true);
                    return;
                  }
                  setInput(e.target.value);
                }}
                onClick={() => {
                  if (!isPro && messageCount >= 3) {
                    trackEvent(userid, "paywall_shown", "mentor_chat", {
                      reason: "input_focus_after_free_limit",
                      messageCount,
                    });
                    setShowPaywall(true);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={isTyping || isStreaming}
                placeholder={
                  UI_TRANSLATIONS[responseLanguage]?.input_placeholder ||
                  "Message Meera AI…"
                }
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[14px] font-semibold text-[#17233d] placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              />
            )}

            {/* Send */}
            {!isListening && (
              <button
                onClick={() => (aiBusy ? stopAiResponse() : handleSend())}
                disabled={!aiBusy && !input.trim()}
                aria-label={aiBusy ? "Stop Meera response" : "Send message"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all active:scale-90 ${
                  aiBusy
                    ? "border border-blue-100 bg-white text-[#2563eb] shadow-sm shadow-blue-200/40"
                    : "bg-gradient-to-br from-[#2563eb] to-[#4f46e5] text-white shadow-md shadow-blue-600/20 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                }`}
              >
                {aiBusy ? (
                  <span className="relative grid h-4 w-4 place-items-center">
                    <span className="absolute h-4 w-4 animate-ping rounded-md bg-[#2563eb]/20" />
                    <span className="relative h-2.5 w-2.5 rounded-[3px] bg-[#2563eb]" />
                  </span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Free counter */}
          {!isPro && messageCount > 0 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 w-5 rounded-full transition-colors ${i < messageCount ? "bg-gradient-to-r from-[#2563eb] to-[#4f46e5]" : "bg-slate-200"}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                {messageCount}/3 free messages
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── QUESTIONNAIRE MODAL ── */}
      {showQuestionnaire && (
        <QuestionnaireModal
          onComplete={(score) => {
            if (!isMountedRef.current) return;
            setShowQuestionnaire(false);
            const t1 = setTimeout(() => {
              if (!isMountedRef.current) return;
              setMessages((prev) => [...prev, { id: `fomo-${Date.now()}`, from: "bot" as const, text: " ", timestamp: new Date(), showFomo: true, fomoScore: score }]);
            }, 400);
            const t2 = setTimeout(() => {
              if (!isMountedRef.current) return;
              setMessages((prev) => [...prev, { id: `pitch-${Date.now()}`, from: "bot" as const, text: " ", timestamp: new Date(), showPitch: true }]);
              fetch(`/api/recommended-tests/${encodeURIComponent(userid)}`)
                .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                .then((p) => { if (isMountedRef.current && p.success && Array.isArray(p.data) && p.data.length > 0) setRecommendedTests(p.data); })
                .catch((e) => { console.warn("[Meera] Recommended tests fetch failed:", e.message); });
            }, 2000);
            const t3 = setTimeout(() => {
              if (!isMountedRef.current) return;
              setMessages((prev) => [...prev, { id: `trigger-${Date.now()}`, from: "bot" as const, text: "Also — students who start mocks early improve their score by **15–25 marks** on average.\n\nYou don't need more studying. You need **smarter practice.** 🔥", timestamp: new Date() }]);
            }, 3400);
            injectTimeoutsRef.current.push(t1, t2, t3);
          }}
        />
      )}

      {/* ── PAYWALL MODAL ── */}
      {showPaywall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111f45]/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[#111f45]/25 animate-in zoom-in-95 duration-300">
            {/* Modal header gradient */}
            <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f2ff_52%,#eef0ff_100%)] px-6 pt-5 pb-7 text-center text-[#111f45]">
              <div className="absolute inset-0 pointer-events-none text-[#243b80] opacity-[0.05]">
                <MessageSquare className="absolute left-5 top-7 h-16 w-16 rotate-[-15deg]" />
                <GraduationCap className="absolute right-4 top-8 h-20 w-20 rotate-[14deg]" />
              </div>
              {!isPro && messageCount >= 3 ? null : (
                <button
                  onClick={() => {
                    trackEvent(userid, "paywall_closed", "mentor_chat", {
                      method: "x_button",
                    });
                    setShowPaywall(false);
                  }}
                  className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 text-[#53617c] shadow-sm hover:bg-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="paywall-avatar-float relative z-10 mx-auto mb-5 grid h-40 w-40 place-items-center overflow-hidden rounded-full border-[6px] border-white bg-white shadow-2xl shadow-blue-900/30 sm:h-44 sm:w-44">
                <img
                  src={MEERA_PAYWALL_AVATAR_URL}
                  alt="Meera"
                  className="h-full w-full object-cover object-top scale-110"
                />
              </div>
              <h3 className="relative z-10 text-2xl font-black tracking-tight bg-gradient-to-br from-[#111f45] via-[#2563eb] to-[#4f46e5] bg-clip-text text-transparent drop-shadow-sm">
                {UI_TRANSLATIONS[responseLanguage]?.unlock_pro ||
                  "Unlock Pro Access"}
              </h3>
            </div>

            <div className="px-5 py-5">
              <div className="space-y-2 mb-5">
                {(
                  UI_TRANSLATIONS[responseLanguage]?.features || [
                    "Unlimited AI Questions & Strategy",
                    "Daily Customized Action Plans",
                    "Unlock All Topic Tests & Analytics",
                  ]
                ).map((item: string) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-[#dbe8ff] bg-[#f5f9ff] p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#14b8a6] shrink-0" />
                    <span className="font-bold text-sm text-[#22304d]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#7aa7ff]/30 bg-[#eef0ff]/80 px-3.5 py-2 mb-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#2563eb] mb-0">
                    {UI_TRANSLATIONS[responseLanguage]?.pro_member || "PRO"}
                  </p>
                  <p className="text-xl font-black text-slate-900">
                    ₹20{" "}
                    <span className="text-[10px] font-bold text-slate-400">
                      one-time
                    </span>
                  </p>
                </div>
                <span className="bg-[#14b8a6] text-white text-[9px] font-black px-2 py-0.5 rounded-lg uppercase">
                  Save 90%
                </span>
              </div>

              <button
                onClick={handlePayment}
                className="cta-shine w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#4f46e5] text-white font-black shadow-xl shadow-blue-700/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base [&_*]:text-white"
              >
                {UI_TRANSLATIONS[responseLanguage]?.pay_unlock ||
                  "Pay ₹20 & Unlock"}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  trackEvent(
                    userid,
                    "paywall_maybe_later_clicked",
                    "mentor_chat",
                    { messageCount },
                  );
                  setShowCancelPopup(true);
                }}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 mt-2 py-1 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXIT-INTENT POPUP ── */}
      {showCancelPopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111f45]/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[#111f45]/25 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                trackEvent(userid, "exit_popup_closed", "mentor_chat", {
                  method: "x_button",
                });
                setShowCancelPopup(false);
              }}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 text-[#53617c] shadow-sm hover:bg-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f2ff_52%,#eef0ff_100%)] px-6 pb-6 pt-5 text-center">
              <div className="absolute inset-0 pointer-events-none text-[#243b80] opacity-[0.05]">
                <MessageSquare className="absolute left-5 top-7 h-16 w-16 rotate-[-15deg]" />
                <GraduationCap className="absolute right-4 top-8 h-20 w-20 rotate-[14deg]" />
              </div>
              <div className="paywall-avatar-float relative z-10 mx-auto mb-3 grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-[#7aa7ff]/30 bg-white shadow-xl shadow-blue-900/10">
                <img
                  src={MEERA_EXIT_AVATAR_URL}
                  alt="Meera"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
                <span className="text-2xl">😟</span>
              </div>
              <h3 className="relative z-10 text-2xl font-black tracking-tight text-[#111f45] drop-shadow-sm">
                You're Missing Out!
              </h3>
              <p className="relative z-10 mx-auto mt-3 flex w-fit max-w-[17rem] items-center justify-center rounded-full border border-[#7aa7ff]/45 bg-white px-4 py-1.5 text-center text-xs font-black text-[#2563eb] shadow-sm shadow-blue-900/5">
                Cancel and you lose access to:
              </p>
            </div>
            <div className="space-y-2 px-5 py-5">
              {[
                { e: "🤖", t: "Unlimited AI Chats" },
                { e: "📅", t: "Daily Personalized Action Plans" },
                { e: "🎯", t: "Weak Topic Drill Recommendations" },
                { e: "💡", t: "24/7 AI Doubt Solving" },
              ].map(({ t }, index) => {
                const icons = [MessageSquare, BookOpen, Target, Lightbulb];
                const Icon = icons[index] || MessageSquare;
                return (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-xl border border-[#dbe8ff] bg-[#f5f9ff] p-3"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#14b8a6]" />
                    <span className="text-xs font-bold text-[#22304d]">
                      {t}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-2">
              <button
                onClick={() => {
                  trackEvent(
                    userid,
                    "exit_popup_keep_access_clicked",
                    "mentor_chat",
                  );
                  setShowCancelPopup(false);
                }}
                className="cta-shine flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#4f46e5] py-3 text-sm font-black text-white shadow-xl shadow-blue-700/25 transition-all active:scale-[0.98] [&_*]:text-white"
              >
                Keep My Access →
              </button>
            </div>
            <button
              onClick={() => {
                trackEvent(
                  userid,
                  "exit_popup_no_thanks_clicked",
                  "mentor_chat",
                );
                setShowCancelPopup(false);
                setShowPaywall(false);
              }}
              className="mx-auto mb-5 block w-fit px-4 text-center text-xs font-bold text-slate-400 hover:text-slate-600 py-1.5 transition-colors"
            >
              No thanks, I'll miss out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  const isPercentage = value.includes("%");
  const numValue = isPercentage ? parseInt(value) : 0;

  return (
    <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:border-primary/40 hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-50 grid place-items-center border border-slate-100 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
            <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              {label}
            </span>
            <span className="text-[19px] font-black text-slate-800 leading-none tracking-tight">
              {value}
            </span>
          </div>
        </div>

        {isPercentage && (
          <div className="h-10 w-10 relative flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 36 36"
            >
              <path
                className="text-slate-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${numValue > 70 ? "text-emerald-500" : numValue > 40 ? "text-amber-500" : "text-red-500"}`}
                strokeDasharray={`${numValue}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
