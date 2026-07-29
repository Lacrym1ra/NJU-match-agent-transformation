import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { PersonalityResult, PersonalityType } from '../lib/personalityConfig';
import {
  TYPE_INFO,
  COMPATIBLE_TYPES,
  AXIS_LABELS,
  STORAGE_KEY_RESULT,
} from '../lib/personalityConfig';
import MaterialIcon from '../components/MaterialIcon';
import { computePersonality, unwrapAnswers } from '../lib/personalityEngine';
import { useAuth } from '../context/AuthContext';
import { getAnswers, getQuestions } from '../api/survey';

// ── Helpers ───────────────────────────────────────────────

const LEGACY_TYPE_ALIASES: Record<string, PersonalityType> = {
  'code-flirt': 'art-kid',
  'low-key-ace': 'hidden-boss',
};

function normalizePersonalityType(type: unknown): PersonalityType | null {
  if (typeof type !== 'string') return null;
  const normalized = LEGACY_TYPE_ALIASES[type] ?? type;
  return normalized in TYPE_INFO ? (normalized as PersonalityType) : null;
}

function normalizeStoredResult(raw: PersonalityResult | null): PersonalityResult | null {
  if (!raw) return null;

  const finalType = normalizePersonalityType(raw.finalType);
  if (!finalType) return null;

  const top3 = Array.isArray(raw.top3)
    ? raw.top3
        .map((item) => {
          const type = normalizePersonalityType(item?.type);
          if (!type || typeof item?.score !== 'number') return null;
          return { ...item, type };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  return {
    ...raw,
    finalType,
    top3,
  };
}

function loadResultFromStorage(): PersonalityResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESULT);
    return raw ? normalizeStoredResult(JSON.parse(raw) as PersonalityResult) : null;
  } catch { return null; }
}

function getSourceBadgeLabel(result: PersonalityResult): string {
  return result.source === 'survey' ? '档案溯源' : '本册溯自我知';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

async function waitForDocumentFonts() {
  if ('fonts' in document) {
    await document.fonts.ready;
  }
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));

  await Promise.all(
    images.map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }

      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // ignore decode failures and let export continue
        }
      }
    }),
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesForExport(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

      try {
        const response = await fetch(src, { cache: 'force-cache' });
        if (!response.ok) return;
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.src = dataUrl;
        img.removeAttribute('srcset');
        await waitForImages(img.parentElement ?? container);
      } catch {
        // Ignore inlining failures and fall back to the original URL.
      }
    }),
  );
}

function applyPosterExportStyles(card: HTMLDivElement, accentColor: string) {
  const softenBorder = 'rgba(212, 193, 207, 0.24)';
  const softShadow = '0 14px 34px rgba(66, 0, 71, 0.07)';

  card.style.borderRadius = '38px';
  card.style.boxShadow = '0 18px 44px rgba(44, 40, 37, 0.08)';

  const hero = card.querySelector<HTMLElement>('[data-export="hero"]');
  if (hero) {
    hero.style.height = '300px';
  }

  const sourceBadge = card.querySelector<HTMLElement>('[data-export="source-badge"]');
  if (sourceBadge) {
    sourceBadge.style.padding = '12px 22px';
    sourceBadge.style.borderRadius = '999px';
    sourceBadge.style.borderColor = softenBorder;
    sourceBadge.style.background = 'rgba(255, 255, 255, 0.78)';
    sourceBadge.style.boxShadow = softShadow;
    sourceBadge.style.backdropFilter = 'blur(18px)';
    sourceBadge.style.whiteSpace = 'nowrap';
    sourceBadge.style.display = 'inline-flex';
    sourceBadge.style.alignItems = 'center';
    sourceBadge.style.justifyContent = 'center';
  }

  const stampBadge = card.querySelector<HTMLElement>('[data-export="stamp-badge"]');
  if (stampBadge) {
    stampBadge.style.padding = '13px 20px';
    stampBadge.style.borderRadius = '18px';
    stampBadge.style.boxShadow = `0 12px 28px ${accentColor}22`;
    stampBadge.style.whiteSpace = 'nowrap';
    stampBadge.style.display = 'inline-flex';
    stampBadge.style.alignItems = 'center';
    stampBadge.style.justifyContent = 'center';
    stampBadge.style.minWidth = '0';
    stampBadge.style.letterSpacing = '0.04em';
  }

  const titleSection = card.querySelector<HTMLElement>('[data-export="title-section"]');
  if (titleSection) {
    titleSection.style.paddingTop = '34px';
    titleSection.style.paddingBottom = '34px';
    titleSection.style.paddingLeft = '54px';
    titleSection.style.paddingRight = '54px';
  }

  const titleRow = card.querySelector<HTMLElement>('[data-export="title-row"]');
  if (titleRow) {
    titleRow.style.alignItems = 'flex-end';
    titleRow.style.gap = '36px';
  }

  const headlineEn = card.querySelector<HTMLElement>('[data-export="headline-en"]');
  if (headlineEn) {
    headlineEn.style.marginBottom = '18px';
  }

  const headlineCn = card.querySelector<HTMLElement>('[data-export="headline-cn"]');
  if (headlineCn) {
    headlineCn.style.fontSize = '56px';
  }

  const headlineTagline = card.querySelector<HTMLElement>('[data-export="headline-tagline"]');
  if (headlineTagline) {
    headlineTagline.style.marginTop = '20px';
    headlineTagline.style.maxWidth = '320px';
  }

  const confidenceValue = card.querySelector<HTMLElement>('[data-export="confidence-value"]');
  if (confidenceValue) {
    confidenceValue.style.fontSize = '58px';
    confidenceValue.style.lineHeight = '0.95';
  }

  const traitList = card.querySelector<HTMLElement>('[data-export="trait-list"]');
  if (traitList) {
    traitList.style.marginTop = '34px';
    traitList.style.gap = '14px';
  }

  const chips = card.querySelectorAll<HTMLElement>('[data-export="trait-chip"]');
  chips.forEach((chip) => {
    chip.style.padding = '11px 22px';
    chip.style.borderRadius = '999px';
    chip.style.borderColor = softenBorder;
    chip.style.background = 'rgba(255, 255, 255, 0.96)';
    chip.style.boxShadow = '0 10px 24px rgba(44, 40, 37, 0.03)';
    chip.style.fontWeight = '600';
  });

  const descriptionSection = card.querySelector<HTMLElement>('[data-export="description-section"]');
  if (descriptionSection) {
    descriptionSection.style.padding = '44px 54px';
  }

  const descriptionText = card.querySelector<HTMLElement>('[data-export="description-text"]');
  if (descriptionText) {
    descriptionText.style.lineHeight = '2';
    descriptionText.style.color = '#3A322E';
    descriptionText.style.opacity = '0.97';
  }

  const axesSection = card.querySelector<HTMLElement>('[data-export="axes-section"]');
  if (axesSection) {
    axesSection.style.padding = '46px 54px';
  }

  const top3Section = card.querySelector<HTMLElement>('[data-export="top3-section"]');
  if (top3Section) {
    top3Section.style.padding = '44px 54px';
  }

  const top3Names = card.querySelectorAll<HTMLElement>('[data-export="top3-name"]');
  top3Names.forEach((name) => {
    name.style.width = '168px';
  });

  const footer = card.querySelector<HTMLElement>('[data-export="footer"]');
  if (footer) {
    footer.style.padding = '26px 54px';
    footer.style.alignItems = 'flex-end';
  }

  const siteUrl = card.querySelector<HTMLElement>('[data-export="site-url"]');
  if (siteUrl) {
    siteUrl.textContent = 'njumatch.com';
    siteUrl.style.fontSize = '15px';
    siteUrl.style.letterSpacing = '0.16em';
    siteUrl.style.fontWeight = '700';
    siteUrl.style.color = '#5F4B39';
    siteUrl.style.opacity = '1';
  }

  const brandMark = card.querySelector<HTMLElement>('[data-export="brand-mark"]');
  if (brandMark) {
    brandMark.style.gap = '12px';
    brandMark.style.opacity = '0.86';
    brandMark.style.mixBlendMode = 'normal';
  }

  const brandIcon = card.querySelector<HTMLElement>('[data-export="brand-icon"]');
  if (brandIcon) {
    brandIcon.style.width = '22px';
    brandIcon.style.height = '22px';
    brandIcon.style.filter = 'grayscale(1)';
  }

  const brandText = card.querySelector<HTMLElement>('[data-export="brand-text"]');
  if (brandText) {
    brandText.style.fontSize = '14px';
    brandText.style.letterSpacing = '0.34em';
    brandText.style.fontWeight = '600';
    brandText.style.color = '#4B3E49';
  }

  const separators = card.querySelectorAll<HTMLElement>('[data-export="separator"]');
  separators.forEach((separator) => {
    separator.style.background =
      'linear-gradient(90deg, rgba(232, 223, 218, 0) 0%, rgba(232, 223, 218, 0.72) 20%, rgba(232, 223, 218, 0.95) 50%, rgba(232, 223, 218, 0.72) 80%, rgba(232, 223, 218, 0) 100%)';
  });
}

function SectionSeparator() {
  return (
    <div
      data-export="separator"
      className="pointer-events-none h-px w-full bg-[linear-gradient(90deg,rgba(237,231,228,0)_0%,rgba(237,231,228,0.72)_20%,rgba(237,231,228,0.95)_50%,rgba(237,231,228,0.72)_80%,rgba(237,231,228,0)_100%)]"
    />
  );
}

// ── Axis bar ──────────────────────────────────────────────

function AxisBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <span className="text-[14px] font-medium text-[#2C2825] w-[78px] shrink-0 whitespace-nowrap leading-none text-right opacity-90 tracking-[0.08em]">{label}</span>
      <div className="flex-1 h-[6px] bg-[#ECE5E3] rounded-full overflow-hidden relative">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.05)]"
          style={{ backgroundColor: color, opacity: 0.88 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </div>
      <span className="text-[15px] font-medium text-[#8B7355] w-9 pl-1">{Math.round(value)}</span>
    </div>
  );
}

// ── Compatible type card ──────────────────────────────────

function CompatibleCard({ type }: { type: PersonalityType }) {
  const info = TYPE_INFO[type];
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[#E9E1E0] bg-[#FCFBF8]/50 hover:bg-white hover:shadow-sm transition-all group relative">
      <div 
        className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
        style={{ background: `${info.color}15`, color: info.color }}
      >
        <span className="opacity-90 leading-none">{info.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[#8B7355] tracking-[0.2em] uppercase mb-0.5 font-serif opacity-80 truncate">{info.nameEn}</div>
        <div className="text-[15px] font-bold text-[#2C2825] font-serif tracking-wide truncate">{info.nameCn}</div>
      </div>
      <div className="text-[10px] text-[#8B7355] font-serif uppercase tracking-[0.2em] opacity-60 pl-3 border-l border-[#E9E1E0] shrink-0 h-8 flex flex-col justify-center">
        <span>核心</span>
        <span>互补</span>
      </div>
    </div>
  );
}

// ── Image placeholder ─────────────────────────────────────

function TypeImage({ type, color, bgColor }: { type: PersonalityType; color: string; bgColor: string }) {
  const [imgError, setImgError] = useState(false);
  const info = TYPE_INFO[type];
  if (!imgError) {
    return (
      <div className="w-full h-full px-4 pt-4">
        <img
          src={info.imagePath}
          alt={info.nameCn}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain object-top"
        />
      </div>
    );
  }
  // Fallback placeholder
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${bgColor}, ${color}18)` }}
    >
      <span className="text-6xl mb-3">{info.emoji}</span>
      <span className="text-xs text-[#82737e]">图片即将上线</span>
    </div>
  );
}

// ── Result card (captured for save-image) ─────────────────

function ResultCard({
  result,
  cardRef,
  showDetailedData,
}: {
  result: PersonalityResult;
  cardRef: React.RefObject<HTMLDivElement | null>;
  showDetailedData: boolean;
}) {
  const info = TYPE_INFO[result.finalType];
  const coreAxes = ['analytical', 'drive', 'social_energy', 'freeflow', 'attachment'] as const;

  return (
    <div
      ref={cardRef}
      data-export="card"
      className="bg-white mx-auto w-full rounded-[2rem] overflow-hidden shadow-[0_18px_40px_rgba(44,40,37,0.06)] border border-[#E7DFDB] relative"
    >
      {/* Bookmark hole */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FCFBF8] shadow-inner z-20 opacity-90 border border-black/5" />

      {/* Header image area */}
      <div data-export="hero" className="relative h-64 overflow-hidden bg-[#FCFBF8]">
        <TypeImage type={result.finalType} color={info.color} bgColor={info.bgColor} />
        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/88 to-transparent" />
        {/* Stamp / badge */}
        <div
          data-export="stamp-badge"
          className="absolute top-6 right-5 inline-flex items-center justify-center whitespace-nowrap leading-none px-3 py-1.5 rounded-md text-[11px] font-bold tracking-[0.04em] shadow-sm z-10 border border-white/20"
          style={{ background: info.color, color: '#fff' }}
        >
          {result.isEasterEgg ? '✨ 限定画卷' : `NO.${result.finalType}`}
        </div>
        <div
          data-export="source-badge"
          className="absolute top-6 left-5 inline-flex items-center justify-center whitespace-nowrap leading-none px-3 py-1.5 bg-[#FCFBF8]/90 backdrop-blur-md rounded-md border border-[#E9E1E0] text-[11px] text-[#2C2825] font-serif shadow-sm z-10"
        >
          {getSourceBadgeLabel(result)}
        </div>
      </div>

      {/* Type name area */}
      <div data-export="title-section" className="px-8 pt-5 pb-8 relative z-10 bg-white">
        <div
          data-export="title-row"
          className={`flex items-end gap-5 relative ${showDetailedData ? 'justify-between' : 'justify-start'}`}
        >
          <div>
            <p data-export="headline-en" className="text-[11px] tracking-[0.25em] uppercase text-[#8B7355] mb-3 font-serif opacity-90">{info.nameEn}</p>
            <h2 data-export="headline-cn" className="text-4xl font-bold text-[#2C2825] font-serif leading-none tracking-wide">{info.nameCn}</h2>
            <p data-export="headline-tagline" className="text-[14px] text-[#9A7F60] mt-4 font-serif italic max-w-[280px] opacity-95">{info.tagline}</p>
          </div>
          {showDetailedData && (
            <div className="shrink-0 text-right mt-1">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#8B7355] font-serif mb-2 opacity-90 mt-1">相性</p>
              <p data-export="confidence-value" className="text-[32px] font-serif font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" style={{ color: info.color }}>
                {Math.round(result.confidence * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Trait chips */}
        <div data-export="trait-list" className="flex flex-wrap gap-2.5 mt-8">
          {info.traits.map(t => (
            <span
              key={t}
              data-export="trait-chip"
              className="inline-flex items-center shrink-0 whitespace-nowrap leading-none px-4 py-2 rounded-[14px] text-[12px] font-semibold bg-[#FFFEFC] border border-[#E6DDD7] tracking-[0.12em] shadow-[0_6px_18px_rgba(44,40,37,0.03)] font-serif"
              style={{ color: info.color }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Description */}
      <SectionSeparator />
      <div data-export="description-section" className="px-8 py-8 relative bg-white">
        <p data-export="description-text" className="text-[15px] text-[#302925] leading-[2.2] text-justify font-serif opacity-100" style={{ textAlignLast: 'left' }}>
          {info.description}
        </p>
      </div>

      {/* Axis bars */}
      {showDetailedData && (
        <>
          <SectionSeparator />
          <div data-export="axes-section" className="px-8 py-8 relative bg-white">
            <p className="text-[11px] font-bold text-[#9A8368] opacity-95 uppercase tracking-widest mb-6 font-serif">精神倾向谱系</p>
            <div className="flex flex-col gap-4">
              {coreAxes.map(ax => (
                <AxisBar
                  key={ax}
                  label={AXIS_LABELS[ax]}
                  value={result.features[ax]}
                  color={info.color}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top 3 */}
      {showDetailedData && result.top3.length > 0 && (
        <>
          <SectionSeparator />
          <div data-export="top3-section" className="px-8 py-8 relative bg-white">
            <p className="text-[11px] font-bold text-[#9A8368] opacity-95 uppercase tracking-widest mb-5 font-serif">潜在共振点</p>
            <div className="flex flex-col gap-6">
              {result.top3.map((item, i) => {
                const t = TYPE_INFO[item.type];
                return (
                  <div key={item.type} className="flex items-center gap-2 md:gap-3">
                    <span className="text-[13px] md:text-[14px] text-[#8B7355] w-4 md:w-6 italic opacity-80 font-serif font-medium shrink-0">{i + 1}</span>
                    <span data-export="top3-name" className="inline-flex items-center whitespace-nowrap text-[14px] md:text-[16px] font-bold w-[125px] md:w-[145px] shrink-0 text-[#2C2825] tracking-wide font-serif">
                      <span className="shrink-0">{t.emoji}</span> <span className="ml-1 md:ml-2 truncate">{t.nameCn}</span>
                    </span>
                    <div className="flex-1 h-[5px] md:h-[6px] bg-[#ECE5E3] rounded-full overflow-hidden relative">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ backgroundColor: t.color, opacity: 0.88 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[13px] md:text-[14px] text-[#8B7355] font-medium w-6 md:w-8 text-right pl-1 font-serif shrink-0">{item.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Footer stamp */}
      <SectionSeparator />
      <div data-export="footer" className="px-8 py-6 flex items-end justify-between gap-4 relative bg-white">
        <span data-export="site-url" className="text-[13px] md:text-[15px] tracking-[0.16em] text-[#5F4B39] opacity-80 font-serif">
          {new Date().toISOString().slice(0, 10).replace(/-/g, ' . ')}
        </span>
        <div data-export="brand-mark" className="flex items-center gap-2.5 opacity-75 mix-blend-multiply">
          <img data-export="brand-icon" src="/icon.svg" alt="" className="w-4.5 h-4.5 grayscale" />
          <span data-export="brand-text" className="text-[11px] uppercase tracking-[0.28em] font-serif text-[#4E414C] font-medium">NJU Match</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function PersonalityResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const cardRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<PersonalityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [sharedTypeParam] = useState(() => normalizePersonalityType(searchParams.get('type')));
  const [hasLatestSurveyProfile, setHasLatestSurveyProfile] = useState(false);

  // Load result: priority = localStorage > survey API (if logged in) > URL param
  useEffect(() => {
    const fromStorage = loadResultFromStorage();

    // If URL has a shared type and no local result, show that type's info only
    if (!fromStorage && sharedTypeParam && TYPE_INFO[sharedTypeParam]) {
      // Build a minimal result for display
      setResult({
        finalType: sharedTypeParam,
        isEasterEgg: false,
        confidence: 0,
        top3: [],
        features: {} as any,
      });
      setLoading(false);
      return;
    }

    if (fromStorage) {
      setResult(fromStorage);
      setLoading(false);
      return;
    }

    // If logged in, try to compute from survey answers
    if (user) {
      Promise.all([getQuestions(), getAnswers()])
        .then(([qRes, data]) => {
          const surveyOutdated = Boolean(data?.version && qRes?.version && data.version !== qRes.version);

          if (surveyOutdated) {
            navigate('/personality-test', { replace: true });
            return;
          }

          if (data?.answers && Object.keys(data.answers).length > 0) {
            const computed = computePersonality(unwrapAnswers(data.answers));
            computed.source = 'survey';
            setResult(computed);
            localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(computed));
          } else if (!user.surveyComplete) {
            // Only redirect to test if user genuinely hasn't completed the survey.
            // If surveyComplete is true but API returned nothing (e.g. dev mock),
            // fall through to the empty state rather than looping.
            navigate('/personality-test');
          }
        })
        .catch(() => { if (!user.surveyComplete) navigate('/personality-test'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      navigate('/personality-test');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setHasLatestSurveyProfile(false);
      return;
    }

    Promise.all([getQuestions(), getAnswers()])
      .then(([qRes, data]) => {
        const surveyIsLatest = Boolean(data?.version && qRes?.version && data.version === qRes.version);
        const hasSurveyAnswers = Boolean(data?.answers && Object.keys(data.answers).length > 0);

        if (!cancelled) {
          setHasLatestSurveyProfile(Boolean(user.surveyComplete && surveyIsLatest && hasSurveyAnswers));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasLatestSurveyProfile(Boolean(user.surveyComplete));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Share ─────────────────────────────────────────────

  const handleShare = async () => {
    if (!result) return;
    const info = TYPE_INFO[result.finalType];
    const url  = `${window.location.origin}/personality-result?type=${result.finalType}`;
    const text = `我在 NJU Match 测出了人格类型「${info.nameCn}」—— ${info.tagline}`;
    const mobileUserAgentData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true;
    const isIpadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isMobileShareDevice = isIpadDesktopMode || mobileUserAgentData || (mobileUserAgent && coarsePointer);

    if (isMobileShareDevice && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'NJU Match 人格类型', text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    } catch {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  };

  // ── Save image (html-to-image, lazy) ─────────────────

  const handleSaveImage = async () => {
    if (!cardRef.current || saveStatus === 'saving') return;
    setSaveStatus('saving');

    const EXPORT_CARD_WIDTH = 560;
    let captureRoot: HTMLDivElement | null = null;

    try {
      const { toPng } = await import('html-to-image');
      const el = cardRef.current;

      await waitForDocumentFonts();

      captureRoot = document.createElement('div');
      captureRoot.setAttribute('aria-hidden', 'true');
      captureRoot.style.position = 'fixed';
      captureRoot.style.left = '0';
      captureRoot.style.top = '0';
      captureRoot.style.width = `${EXPORT_CARD_WIDTH}px`;
      captureRoot.style.opacity = '0.01';
      captureRoot.style.pointerEvents = 'none';
      captureRoot.style.zIndex = '-1';
      captureRoot.style.background = '#ffffff';
      captureRoot.style.transform = 'translateX(-200vw)';

      const clonedCard = el.cloneNode(true) as HTMLDivElement;
      clonedCard.style.width = `${EXPORT_CARD_WIDTH}px`;
      clonedCard.style.maxWidth = `${EXPORT_CARD_WIDTH}px`;
      clonedCard.style.margin = '0';
      clonedCard.style.transform = 'none';
      applyPosterExportStyles(clonedCard, TYPE_INFO[result!.finalType].color);

      captureRoot.appendChild(clonedCard);
      document.body.appendChild(captureRoot);

      await waitForImages(clonedCard);
      await inlineImagesForExport(clonedCard);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

      const dataUrl = await toPng(clonedCard, {
        width: EXPORT_CARD_WIDTH,
        backgroundColor: '#ffffff',
        pixelRatio: Math.max(window.devicePixelRatio, 2),
        cacheBust: true,
        skipFonts: true,
      });

      const link = document.createElement('a');
      link.download = `nju-match-${result?.finalType ?? 'type'}.png`;
      link.href = dataUrl;
      link.click();

      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
      alert('保存失败，请截图保存 📸');
    } finally {
      captureRoot?.remove();
    }
  };

  // ── Loading / empty states ────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="w-8 h-8 border-2 border-t-[#420047] border-[#D4C1CF] rounded-full mx-auto mb-3"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-sm text-[#82737e]">加载中…</p>
        </div>
      </div>
    );
  }

  if (!result || !TYPE_INFO[result.finalType]) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center px-5 text-center">
        <p className="text-[#50434e] mb-4">未找到测试结果</p>
        <Link to="/personality-test" className="text-[#420047] underline underline-offset-2 text-sm">
          去参加测试
        </Link>
      </div>
    );
  }

  const info = TYPE_INFO[result.finalType];
  const compatibles = COMPATIBLE_TYPES[result.finalType] ?? [];
  const isSharedView = !result.completedAt && sharedTypeParam; // viewing someone else's shared link
  const hasFullData = result.top3.length > 0 && result.features && Object.keys(result.features).length > 0;
  const showDetailedData = hasFullData && !isSharedView;

  return (
    <div className="min-h-screen bg-[#FCFBF8]">
      {/* Colored top bar */}
      <div className="h-[3px] w-full" style={{ background: info.color }} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#FCFBF8]/80 backdrop-blur-xl border-b border-[#E9E1E0]/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="w-full md:max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-[#8B7355] text-sm font-medium hover:text-[#420047] transition-colors"
          >
            ← 返回
          </button>
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="" className="w-5 h-5 opacity-60" />
          </div>
        </div>
      </div>

      <div className="w-full md:max-w-2xl mx-auto px-6 pb-24 pt-8">
        {/* Shared-view banner */}
        {isSharedView && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 rounded-2xl bg-white shadow-sm text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: info.color }} />
            <p className="text-sm font-medium text-[#2C2825] tracking-wide">
              你的朋友是： <strong style={{ color: info.color }}>{info.nameCn}</strong>
            </p>
            <Link
              to="/personality-test"
              className="mt-3 inline-block text-sm font-bold text-[#420047] underline underline-offset-4"
            >
              测试你是哪种人格 →
            </Link>
          </motion.div>
        )}

        {/* Main result card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <ResultCard result={result} cardRef={cardRef as React.RefObject<HTMLDivElement>} showDetailedData={showDetailedData} />
        </motion.div>

        {/* Compatible types */}
        {compatibles.length > 0 && showDetailedData && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 bg-white border border-[#E9E1E0] shadow-sm rounded-xl p-8 pb-10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <p className="text-[11px] font-bold text-[#8B7355] opacity-80 uppercase tracking-widest mb-6 font-serif flex items-center gap-2">
              <span className="w-1 h-3 rounded-full" style={{ background: info.color }}></span>
              可期之遇
            </p>
            <div className="flex flex-col gap-3 relative z-10">
              {compatibles.map(t => <CompatibleCard key={t} type={t} />)}
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col gap-3"
        >
          {/* Share */}
          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-xl bg-[#420047] text-[#FCFBF8] font-bold text-sm tracking-wide hover:bg-[#611066] active:scale-[0.98] transition-all shadow-sm"
          >
            {shareStatus === 'copied' ? '已复制链接' : shareStatus === 'error' ? '复制失败' : '分享结果'}
          </button>

          {/* Save image */}
          {showDetailedData && (
            <button
              onClick={handleSaveImage}
              disabled={saveStatus === 'saving'}
              className="w-full py-3.5 rounded-xl bg-white shadow-sm border border-[#E9E1E0] text-[#2C2825] font-bold text-sm tracking-wide hover:shadow-md hover:text-[#420047] active:scale-[0.98] transition-all"
            >
              {saveStatus === 'saving' ? '正在生成图片…' : saveStatus === 'done' ? '图片已保存' : '保存为图片'}
            </button>
          )}

          {/* Retake */}
          {!isSharedView && (
            <button
              onClick={() => navigate('/personality-test')}
              className="w-full py-3 mt-1 rounded-xl bg-transparent text-[#8B7355] text-sm hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all font-serif"
            >
              重新测试
            </button>
          )}
        </motion.div>

        {/* ── CTA based on auth state ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          {!user ? (
            <div className="p-8 pb-10 rounded-[32px] bg-[#FCFBF8] border border-[#E9E1E0] shadow-[0_12px_36px_rgba(44,40,37,0.06)] text-center relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 inset-x-0 h-2" style={{ background: info.color }} />
              <h3 className="font-serif text-[26px] text-[#2C2825] mt-4 mb-5 tracking-wide leading-tight">
                邂逅 <strong style={{ color: info.color, fontWeight: 'bold' }}>{info.nameCn}</strong>
              </h3>
              <p className="text-[14px] text-[#50434e] mb-10 leading-[1.8] max-w-[420px] mx-auto opacity-90 px-2 font-light">
                加入 NJU Match，填写完整匹配档案，让算法在南大学生中为你精准配对<br className="hidden sm:block" />
                {compatibles.length > 0 && (
                  <span className="mt-4 block">
                    可能下周，便可遇见 <strong style={{ color: TYPE_INFO[compatibles[0]].color, fontWeight: 'bold' }}>{TYPE_INFO[compatibles[0]].nameCn}</strong> 或是 <strong style={{ color: TYPE_INFO[compatibles[1]].color, fontWeight: 'bold' }}>{TYPE_INFO[compatibles[1]].nameCn}</strong>。
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-4 w-full max-w-[340px]">
                <Link
                  to="/login"
                  className="block w-full py-4 rounded-full text-[#FCFBF8] shadow-[0_8px_20px_rgba(44,40,37,0.12)] font-serif text-[15px] font-bold tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] border border-transparent"
                  style={{ background: '#00639B' }}
                >
                  注册 / 登录 NJU Match
                </Link>
                <Link
                  to="/about"
                  className="block w-full py-4 rounded-full bg-white border border-[#D4C1CF]/60 text-[15px] text-[#8B7355] font-serif tracking-widest hover:bg-[#F8F7F4] hover:text-[#2C2825] transition-all hover:border-[#8B7355]/40"
                >
                  了解平台
                </Link>
              </div>
              <p className="text-[11px] text-[#D4C1CF] uppercase tracking-[0.3em] mt-10 font-serif">仅限南大在校生 / 校友</p>
            </div>
          ) : !hasLatestSurveyProfile && result.source === 'test' ? (
            <div className="relative overflow-visible rounded-[28px] border border-[#E8DED8] bg-[#F3F1ED]/82 px-6 pb-7 pt-9 shadow-[0_12px_28px_rgba(44,40,37,0.06)] rotate-[0.35deg] transition-transform duration-300 hover:rotate-0">
              <div className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-[-2deg] bg-[#EAE7E1] shadow-sm">
                <div className="h-full w-full bg-white/35 skew-x-12" />
              </div>

              <div className="relative z-10 flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div
                    className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/70 shadow-sm"
                    style={{ background: `${info.color}12`, color: info.color }}
                  >
                    <MaterialIcon name="history_edu" className="text-[20px] leading-none" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[#8B7355] font-medium">匹配档案</p>
                    <h3 className="font-serif text-[25px] text-[#2C2825] tracking-wide leading-tight">
                      还差最后几页
                    </h3>
                    <p className="mt-3 text-[13px] text-[#50434e] leading-[1.9] font-serif opacity-90">
                      人格测试的答案已经替你夹进主问卷，补完剩余题目，就能如期参与每周匹配。
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to="/survey"
                    className="inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-bold tracking-wide text-[#FCFBF8] shadow-[0_10px_24px_rgba(44,40,37,0.08)] transition-all hover:opacity-95 sm:w-auto"
                    style={{ background: info.color }}
                  >
                    继续补全问卷 →
                  </Link>
                  <p className="text-[11px] text-[#8B7355] font-serif italic opacity-80">
                    测试答案已自动带入
                  </p>
                </div>

                <svg width="86" height="8" viewBox="0 0 86 8" fill="none" className="opacity-30">
                  <path d="M2 5.5C20.5 2.3 58 -1.4 84 6" stroke="#8B7355" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#FCFBF8] border border-[#E9E1E0] text-center relative flex flex-col items-center shadow-sm">
              <p className="text-[15px] font-bold font-serif tracking-widest text-[#2C2825]">已落笔</p>
              <div className="w-8 h-[1px] bg-[#E9E1E0] mx-auto my-4" />
              <p className="text-[13px] text-[#8B7355] mb-6 font-serif opacity-90">匹配结果将于每周三 20:00 遣至</p>
              <Link to="/dashboard" className="inline-block text-[13px] text-[#420047] font-bold font-serif hover:underline underline-offset-4 tracking-widest">
                收拢画卷 →
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
