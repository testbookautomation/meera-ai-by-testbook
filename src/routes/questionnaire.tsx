import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

type SearchParams = { userid?: string };

export const Route = createFileRoute("/questionnaire")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    userid: Array.isArray(search.userid)
      ? String(search.userid[0] ?? "")
      : search.userid != null
        ? String(search.userid)
        : undefined,
  }),
  component: QuestionnairePage,
});

const QUESTIONS = [
  {
    number: 1,
    question: "How many CSAT mocks have you attempted?",
    emoji: "📝",
    options: [
      { label: "0 mocks", value: 1, tag: "Haven't started yet" },
      { label: "1–3 mocks", value: 2, tag: "Just getting started" },
      { label: "5+ mocks", value: 3, tag: "Regularly practicing" },
    ],
  },
  {
    number: 2,
    question: "What is your average CSAT score percentage so far?",
    emoji: "📊",
    options: [
      { label: "Less than 50%", value: 1, tag: "Needs improvement" },
      { label: "50–66%", value: 2, tag: "On track" },
      { label: "66% and above", value: 3, tag: "Strong performance" },
    ],
  },
  {
    number: 3,
    question: "What's your accuracy rate for CSAT practice questions?",
    emoji: "🎯",
    options: [
      { label: "Below 60%", value: 1, tag: "Room to grow" },
      { label: "60–80%", value: 2, tag: "Decent accuracy" },
      { label: "Above 80%", value: 3, tag: "High accuracy" },
    ],
  },
  {
    number: 4,
    question: "How confident do you feel about clearing CSAT?",
    emoji: "💪",
    options: [
      { label: "Not confident", value: 1, tag: "Need more practice" },
      { label: "Somewhat confident", value: 2, tag: "Getting there" },
      { label: "Very confident", value: 3, tag: "Ready to ace it" },
    ],
  },
  {
    number: 5,
    question: "Which CSAT topics do you find most challenging?",
    emoji: "🔍",
    options: [
      { label: "Math / Reasoning", value: 1, tag: "Needs most focus" },
      { label: "Comprehension", value: 2, tag: "Common struggle" },
      { label: "None of them", value: 3, tag: "Well-prepared" },
    ],
  },
  {
    number: 6,
    question: "How much time do you dedicate to CSAT prep weekly?",
    emoji: "⏱️",
    options: [
      { label: "Less than 2 hours", value: 1, tag: "Low dedication" },
      { label: "2–5 hours", value: 2, tag: "Moderate effort" },
      { label: "More than 5 hours", value: 3, tag: "High commitment" },
    ],
  },
];

function QuestionnairePage() {
  const { userid } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [fading, setFading] = useState(false);

  const currentQ = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progressPct = (step / QUESTIONS.length) * 100;

  const handleNext = () => {
    if (selected === null || fading) return;
    const newAnswers = [...answers, selected];

    if (!isLast) {
      setFading(true);
      setTimeout(() => {
        setAnswers(newAnswers);
        setStep((s) => s + 1);
        setSelected(null);
        setFading(false);
      }, 220);
    } else {
      const totalScore = newAnswers.reduce((a, b) => a + b, 0);
      sessionStorage.setItem(
        "meera_questionnaire",
        JSON.stringify({
          answers: newAnswers,
          score: totalScore,
          completedAt: Date.now(),
        }),
      );
      navigate({ to: "/mentor-chat", search: { userid } as any });
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[linear-gradient(180deg,#f5f9ff_0%,#e9f2ff_50%,#eef0ff_100%)]">
      {/* Progress bar */}
      <div className="h-1 w-full bg-blue-100/80">
        <div
          className="h-full bg-gradient-to-r from-[#2563eb] to-[#4f46e5] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <img
          src="https://cdn.testbook.com/1755173671769-testbook-logo.png/1755173673.png"
          alt="Testbook"
          className="h-6 opacity-90"
        />
        <span className="rounded-full bg-[#2563eb]/10 px-3 py-0.5 text-[11px] font-black text-[#2563eb]">
          {step + 1} / {QUESTIONS.length}
        </span>
      </div>

      {/* Question content */}
      <div
        className={`flex flex-1 flex-col overflow-hidden px-5 pt-5 transition-all duration-200 ${fading ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"}`}
      >
        {/* Step dots */}
        <div className="mb-5 flex items-center gap-1.5">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < step
                  ? "w-5 bg-[#2563eb]"
                  : i === step
                    ? "w-8 bg-[#2563eb]"
                    : "w-1.5 bg-blue-200"
              }`}
            />
          ))}
        </div>

        {/* Emoji */}
        <div className="mb-3 text-[42px] leading-none">{currentQ.emoji}</div>

        {/* Question label + text */}
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#2563eb]/60">
          Question {currentQ.number} of {QUESTIONS.length}
        </p>
        <h2 className="mb-7 text-[21px] font-black leading-snug text-[#111f45]">
          {currentQ.question}
        </h2>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {currentQ.options.map((opt) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "border-[#2563eb] bg-gradient-to-r from-[#2563eb] to-[#4f46e5] shadow-lg shadow-blue-700/20"
                    : "border-blue-100 bg-white/90 shadow-sm hover:border-[#2563eb]/40 hover:shadow-md"
                }`}
              >
                {/* Radio dot */}
                <div
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    active
                      ? "border-white bg-white"
                      : "border-[#2563eb]/25 bg-transparent"
                  }`}
                >
                  {active && (
                    <div className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
                  )}
                </div>

                {/* Labels */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[15px] font-black leading-tight ${active ? "text-white" : "text-[#111f45]"}`}
                  >
                    {opt.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[11px] font-semibold ${active ? "text-blue-100" : "text-[#8a9bb5]"}`}
                  >
                    {opt.tag}
                  </p>
                </div>

                {/* Check mark on active */}
                {active && (
                  <div className="shrink-0 text-white opacity-90">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 px-5 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-5">
        <button
          onClick={handleNext}
          disabled={selected === null}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-[1.05rem] text-[16px] font-black text-white shadow-xl transition-all active:scale-[0.98] ${
            selected !== null
              ? "bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#4f46e5] shadow-blue-700/25 hover:brightness-105"
              : "cursor-not-allowed bg-slate-200 shadow-none"
          }`}
        >
          {isLast ? "Reveal My Analysis" : "Next Question"}
          <ArrowRight className="h-5 w-5" />
        </button>

        {step > 0 && (
          <button
            onClick={() => {
              setFading(true);
              setTimeout(() => {
                setAnswers((prev) => prev.slice(0, -1));
                setStep((s) => s - 1);
                setSelected(answers[step - 1] ?? null);
                setFading(false);
              }, 200);
            }}
            className="mt-3 w-full py-2 text-center text-[12px] font-semibold text-slate-400 hover:text-slate-600"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
