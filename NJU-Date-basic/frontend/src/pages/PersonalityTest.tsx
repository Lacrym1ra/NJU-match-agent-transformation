import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  TEST_QUESTIONS,
  TestQuestion,
  TYPE_INFO,
  MAIN_TYPES,
  STORAGE_KEY_RESULT,
  STORAGE_KEY_ANSWERS,
  STORAGE_KEY_SURVEY_DRAFT,
  PersonalityType,
} from '../lib/personalityConfig';
import { computePersonality } from '../lib/personalityEngine';
import { useAuth } from '../context/AuthContext';
import { getAnswers, getQuestions } from '../api/survey';

type Answers = Record<string, number | string | string[]>;

// ── Helpers ──────────────────────────────────────────────

function isVisible(q: TestQuestion, answers: Answers): boolean {
  if (!q.dependsOn) return true;
  const dep = answers[q.dependsOn.questionId];
  if (!dep) return false;
  const vals = Array.isArray(q.dependsOn.value) ? q.dependsOn.value : [q.dependsOn.value];
  if (Array.isArray(dep)) return dep.some(v => vals.includes(v));
  return vals.includes(dep as string);
}

function buildVisibleQuestions(answers: Answers): TestQuestion[] {
  return TEST_QUESTIONS.filter(q => isVisible(q, answers));
}

function isAnswered(q: TestQuestion, answers: Answers): boolean {
  const val = answers[q.id];
  if (val === undefined || val === null) return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function getResumeIndex(questions: TestQuestion[], answers: Answers): number {
  const firstUnansweredIndex = questions.findIndex(q => !isAnswered(q, answers));
  return firstUnansweredIndex === -1 ? 0 : firstUnansweredIndex;
}

// ── Slide animation variants ─────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '60%' : '-60%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({
    x: dir > 0 ? '-60%' : '60%',
    opacity: 0,
  }),
};

// ── Section metadata ──────────────────────────────────────

const SECTIONS = [
  { id: 'action',    label: '行动风格' },
  { id: 'social',    label: '社交氛围' },
  { id: 'mind',      label: '思维方式' },
  { id: 'interests', label: '兴趣爱好' },
  { id: 'values',    label: '价值观'   },
];

// ── Sub-components ────────────────────────────────────────

function LikertInput({
  scale, value, onChange,
}: {
  scale: NonNullable<TestQuestion['scale']>;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex gap-2 justify-between mb-3">
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all duration-300 ${
              value === n
                ? 'bg-[#420047] text-white shadow-md scale-105'
                : 'bg-white shadow-sm text-[#2C2825] hover:shadow-md hover:bg-[#FCFBF8]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[#8B7355] px-1 font-serif">
        <span>{scale.minLabel}</span>
        <span>{scale.maxLabel}</span>
      </div>
    </div>
  );
}

function SingleSelectInput({
  options, optionLabels = {}, value, onChange,
}: {
  options: string[];
  optionLabels?: Record<string, string>;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-medium transition-all duration-300 ${
            value === opt
              ? 'bg-[#420047] text-white shadow-md scale-[1.02]'
              : 'bg-white shadow-sm text-[#2C2825] hover:shadow-md hover:bg-[#FCFBF8]'
          }`}
        >
          {optionLabels[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

function MultiSelectInput({
  options, optionLabels = {}, value = [], onChange, maxSelect,
}: {
  options: string[];
  optionLabels?: Record<string, string>;
  value?: string[];
  onChange: (v: string[]) => void;
  maxSelect?: number;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else if (!maxSelect || value.length < maxSelect) {
      onChange([...value, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-3 w-full">
      {options.map(opt => {
        const sel = value.includes(opt);
        const disabled = !sel && maxSelect !== undefined && value.length >= maxSelect;
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            disabled={disabled}
            className={`px-5 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
              sel
                ? 'bg-[#420047] text-white shadow-md scale-[1.02]'
                : disabled
                  ? 'bg-[#FCFBF8] text-[#D4C1CF] cursor-not-allowed'
                  : 'bg-white shadow-sm text-[#2C2825] hover:shadow-md hover:bg-[#FCFBF8]'
            }`}
          >
            {optionLabels[opt] ?? opt}
          </button>
        );
      })}
      {maxSelect && (
        <p className="w-full text-xs text-[#8B7355] mt-2 font-serif">
          已选 {value.length} / {maxSelect}
        </p>
      )}
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────

function WelcomeScreen({
  onStart, onViewResult, onBack, existingType, startLabel,
}: {
  onStart: () => void;
  onViewResult: () => void;
  onBack: () => void;
  existingType: PersonalityType | null;
  startLabel: string;
}) {
  const allTypes = [...MAIN_TYPES, 'you-know-who' as const].map(type => TYPE_INFO[type]);
  return (
    <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center px-5 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="w-full max-w-md text-center relative"
      >
        <button
          type="button"
          onClick={onBack}
          className="absolute -top-12 left-0 text-sm text-[#8B7355] hover:text-[#420047] transition-colors font-medium"
        >
          ← 返回
        </button>

        {/* Logo area */}
        <div className="mb-10">
          <img src="/icon.svg" alt="NJU Match" className="w-12 h-12 mx-auto mb-6 opacity-90 drop-shadow-sm" />
          <p className="text-xs tracking-[0.25em] uppercase text-[#8B7355] font-serif">NJU Match</p>
        </div>

        <h1 className="font-serif text-[28px] font-bold text-[#2C2825] mb-5 leading-tight tracking-wide">
          发现你的<br />
          <span className="text-[#420047]">NJU 人格类型</span>
        </h1>
        <p className="text-[#8B7355] text-sm leading-loose mb-10 font-serif">
          12 种南大人格，你是哪一种？<br />
          约 10 分钟 · 26 题左右 · 结果仅保存在本机设备
        </p>

        {/* Type chips */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {allTypes.map((t, i) => (
            <motion.span
              key={t.nameEn}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="inline-flex items-center shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-serif shadow-sm bg-white"
              style={{ color: t.color }}
            >
              {t.emoji} {t.nameCn}
            </motion.span>
          ))}
        </div>

        {/* Existing result notice */}
        {existingType && (
          <div className="mb-6 p-6 rounded-3xl bg-white shadow-sm text-left">
            <p className="text-xs text-[#8B7355] mb-2 font-serif">历史解读</p>
            <p className="font-serif text-[#420047] text-lg font-bold">
              {TYPE_INFO[existingType].emoji} {TYPE_INFO[existingType].nameCn}
            </p>
            <button
              onClick={onViewResult}
              className="mt-3 text-sm text-[#420047] font-serif underline underline-offset-4"
            >
              查看展览手册 →
            </button>
          </div>
        )}

        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl bg-[#420047] text-[#FCFBF8] font-serif text-base hover:bg-[#611066] active:scale-[0.98] transition-all duration-300 shadow-[0_8px_20px_rgba(66,0,71,0.2)]"
        >
          {startLabel}
        </button>

        <p className="mt-8 text-xs text-[#8B7355] font-serif leading-relaxed">
          完成测试后，答案可直接收录于{' '}
          <Link to="/survey" className="text-[#420047] underline underline-offset-4 font-semibold">
            完整匹配档案
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

// ── Computing screen ──────────────────────────────────────

function ComputingScreen() {
  const dots = ['·', '·', '·'];
  return (
    <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="relative w-20 h-20 mx-auto mb-6">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#420047]/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-t-[#420047] border-r-transparent border-b-transparent border-l-transparent"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            ✨
          </div>
        </div>
        <p className="text-[#420047] font-semibold text-lg mb-2">正在分析你的气质类型</p>
        <p className="text-[#82737e] text-sm">
          {dots.map((d, i) => (
            <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity }}>
              {d}
            </motion.span>
          ))}
        </p>
      </motion.div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────

export default function PersonalityTest() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<'welcome' | 'test' | 'computing'>('welcome');
  const [answers, setAnswers] = useState<Answers>({});
  const [visibleQs, setVisibleQs] = useState<TestQuestion[]>(() => buildVisibleQuestions({}));
  const [qIndex, setQIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [canOpenSurveyResult, setCanOpenSurveyResult] = useState(false);

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  };

  // Check existing result
  const existingResultRaw = localStorage.getItem(STORAGE_KEY_RESULT);
  const existingType: PersonalityType | null = existingResultRaw
    ? (() => { try { return JSON.parse(existingResultRaw).finalType ?? null; } catch { return null; } })()
    : null;

  const SURVEY_DRAFT_KEY = 'survey_draft';
  const testQIds = new Set(TEST_QUESTIONS.map(q => q.id));

  useEffect(() => {
    let cancelled = false;

    if (existingType || !user?.surveyComplete) {
      setCanOpenSurveyResult(false);
      return;
    }

    (async () => {
      try {
        const [qRes, aRes] = await Promise.all([getQuestions(), getAnswers()]);
        const surveyIsLatest = Boolean(aRes.version && qRes.version && aRes.version === qRes.version);
        const hasSurveyAnswers = Boolean(aRes.answers && Object.keys(aRes.answers).length > 0);
        if (!cancelled) {
          setCanOpenSurveyResult(surveyIsLatest && hasSurveyAnswers);
        }
      } catch {
        if (!cancelled) {
          setCanOpenSurveyResult(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [existingType, user?.surveyComplete]);

  // Load saved answers on mount.
  // Priority: survey_draft (source of truth shared with main survey) > STORAGE_KEY_ANSWERS fallback
  useEffect(() => {
    let loaded: Answers = {};

    // Try survey_draft first — extract only question IDs used by this test
    try {
      const draftRaw = localStorage.getItem(SURVEY_DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as Record<string, { value: any }>;
        for (const [k, v] of Object.entries(draft)) {
          if (testQIds.has(k) && v?.value !== undefined) {
            loaded[k] = v.value;
          }
        }
      }
    } catch { /* ignore */ }

    // Fall back to standalone personality test answers if survey_draft had nothing
    if (Object.keys(loaded).length === 0) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ANSWERS);
        if (saved) loaded = JSON.parse(saved) as Answers;
      } catch { /* ignore */ }
    }

    if (Object.keys(loaded).length > 0) {
      setAnswers(loaded);
      setVisibleQs(buildVisibleQuestions(loaded));
    }

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const currentQ = visibleQs[qIndex];
  const progress = visibleQs.length > 0 ? (qIndex / visibleQs.length) * 100 : 0;
  const currentSection = currentQ?.section ?? '';
  const sectionIndex = SECTIONS.findIndex(s => s.id === currentSection);

  // Persist answers to both stores so survey_draft stays in sync
  const saveAnswers = (newAnswers: Answers) => {
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(newAnswers));
    // Sync back to survey_draft in real-time (always overwrite matching keys)
    try {
      const draftRaw = localStorage.getItem(SURVEY_DRAFT_KEY);
      const draft: Record<string, { value: any; [key: string]: any }> = draftRaw ? JSON.parse(draftRaw) : {};
      for (const [k, v] of Object.entries(newAnswers)) {
        const existingEntry = draft[k];
        draft[k] = existingEntry && typeof existingEntry === 'object' && !Array.isArray(existingEntry)
          ? { ...existingEntry, value: v }
          : { value: v };
      }
      localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem('survey_draft_time', Date.now().toString());
    } catch { /* ignore */ }
  };

  const handleAnswer = (id: string, val: number | string | string[]) => {
    const newAnswers = { ...answers, [id]: val };
    setAnswers(newAnswers);
    setVisibleQs(buildVisibleQuestions(newAnswers));
    saveAnswers(newAnswers);

    // Auto-advance for likert and single_select
    if (currentQ?.type !== 'multi_select') {
      clearAutoAdvanceTimer();
      autoAdvanceTimer.current = setTimeout(() => {
        autoAdvanceTimer.current = null;
        advance(newAnswers);
      }, 180);
    }
  };

  const advance = (latestAnswers?: Answers) => {
    clearAutoAdvanceTimer();
    const ans = latestAnswers ?? answers;
    const qs = buildVisibleQuestions(ans);
    if (qIndex < qs.length - 1) {
      setDirection(1);
      setQIndex(i => i + 1);
      setVisibleQs(qs);
    } else {
      finishTest(ans);
    }
  };

  const back = () => {
    clearAutoAdvanceTimer();
    if (qIndex > 0) {
      setDirection(-1);
      setQIndex(i => i - 1);
    } else {
      setPhase('welcome');
    }
  };

  const returnToWelcome = () => {
    clearAutoAdvanceTimer();
    setPhase('welcome');
  };

  const finishTest = (finalAnswers: Answers) => {
    clearAutoAdvanceTimer();
    setPhase('computing');
    setTimeout(() => {
      const result = computePersonality(finalAnswers);
      result.source = 'test';
      localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(result));

      // survey_draft is already up-to-date via real-time saveAnswers() sync

      navigate('/personality-result');
    }, 2000);
  };

  const startTest = async () => {
    clearAutoAdvanceTimer();

    if (!existingType) {
      let shouldOpenResult = canOpenSurveyResult;

      if (!shouldOpenResult && user?.surveyComplete) {
        try {
          const [qRes, aRes] = await Promise.all([getQuestions(), getAnswers()]);
          const surveyIsLatest = Boolean(aRes.version && qRes.version && aRes.version === qRes.version);
          const hasSurveyAnswers = Boolean(aRes.answers && Object.keys(aRes.answers).length > 0);
          shouldOpenResult = surveyIsLatest && hasSurveyAnswers;
          setCanOpenSurveyResult(shouldOpenResult);
        } catch {
          shouldOpenResult = false;
        }
      }

      if (shouldOpenResult) {
        navigate('/personality-result');
        return;
      }
    }

    const resumedQuestions = buildVisibleQuestions(answers);
    setVisibleQs(resumedQuestions);
    setQIndex(getResumeIndex(resumedQuestions, answers));
    setDirection(1);
    setPhase('test');
  };

  const viewExistingResult = () => {
    navigate('/personality-result');
  };

  const startLabel = existingType ? '翻阅修润' : canOpenSurveyResult ? '查看结果' : '开启测试';

  // ── Render phases ────────────────────────────────────────

  if (phase === 'welcome') {
    return (
      <WelcomeScreen
        onStart={startTest}
        onViewResult={viewExistingResult}
        onBack={() => navigate(-1)}
        existingType={existingType}
        startLabel={startLabel}
      />
    );
  }

  if (phase === 'computing') return <ComputingScreen />;

  if (!currentQ) return null;

  const answered = isAnswered(currentQ, answers);
  const isMulti = currentQ.type === 'multi_select';
  const currentVal = answers[currentQ.id];
  const nextButtonLabel = qIndex < visibleQs.length - 1 ? '下一题 →' : '揭晓信封 →';

  return (
    <div className="min-h-screen bg-[#FCFBF8] flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-[#FCFBF8]/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-6 pt-6 pb-4">
          {/* Section indicators */}
          <div className="flex gap-2 mb-3">
            {SECTIONS.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 h-[2px] rounded-full transition-all duration-700 ${
                  i < sectionIndex ? 'bg-[#420047]' : i === sectionIndex ? 'bg-[#420047]/60' : 'bg-[#D4C1CF]/30'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 font-serif">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-[#8B7355] tracking-wide whitespace-nowrap">
                {SECTIONS[sectionIndex]?.label ?? ''}
              </span>
              <span className="text-xs text-[#8B7355] whitespace-nowrap">
                {qIndex + 1} <span className="opacity-40 px-0.5">/</span> {visibleQs.length}
              </span>
            </div>
            <button
              type="button"
              onClick={returnToWelcome}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7DFDB] bg-white/90 px-3.5 py-1.5 text-[11px] font-serif tracking-[0.14em] text-[#8B7355] shadow-[0_6px_18px_rgba(44,40,37,0.04)] transition-all hover:border-[#D8C9BF] hover:text-[#420047] hover:shadow-[0_8px_22px_rgba(44,40,37,0.06)] whitespace-nowrap"
            >
              <span className="text-[12px] leading-none">↺</span>
              回到卷首
            </button>
          </div>
        </div>
        <div className="h-[1px] bg-transparent">
          <motion.div
            className="h-full bg-transparent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-24 pb-32">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQ.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Question text */}
              <p className="text-[#2C2825] text-[22px] font-serif font-bold leading-relaxed mb-10 tracking-wide">
                {currentQ.text}
              </p>

              {/* Answer input */}
              {currentQ.type === 'likert' && (
                <LikertInput
                  scale={currentQ.scale!}
                  value={currentVal as number | undefined}
                  onChange={v => handleAnswer(currentQ.id, v)}
                />
              )}
              {currentQ.type === 'single_select' && (
                <SingleSelectInput
                  options={currentQ.options!}
                  optionLabels={currentQ.optionLabels}
                  value={currentVal as string | undefined}
                  onChange={v => handleAnswer(currentQ.id, v)}
                />
              )}
              {currentQ.type === 'multi_select' && (
                <MultiSelectInput
                  options={currentQ.options!}
                  optionLabels={currentQ.optionLabels}
                  value={(currentVal as string[]) ?? []}
                  onChange={v => handleAnswer(currentQ.id, v)}
                  maxSelect={currentQ.maxSelect}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FCFBF8]/80 backdrop-blur-xl px-6 py-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-4">
            <button
              onClick={back}
              className="flex-none w-[52px] h-[52px] rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#2C2825] hover:shadow-md hover:text-[#420047] transition-all"
            >
              ←
            </button>

            {answered ? (
              <button
                onClick={() => advance()}
                className="flex-1 h-[52px] rounded-2xl font-serif font-bold text-[15px] transition-all duration-300 shadow-[0_8px_20px_rgba(66,0,71,0.15)] bg-[#420047] text-[#FCFBF8] hover:bg-[#611066] active:scale-[0.98]"
              >
                {nextButtonLabel}
              </button>
            ) : (
              <button
                onClick={() => advance()}
                disabled
                className="flex-1 h-[52px] rounded-2xl font-serif text-[15px] bg-transparent text-[#D4C1CF] border border-dashed border-[#D4C1CF]/50 cursor-not-allowed"
              >
                请落墨
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
