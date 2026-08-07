import type { ForumPostType } from './forumService.js';

const MAX_TERMS = 8;
const MAX_RESULTS = 6;
const DEFAULT_RESULTS = 3;

const DOMAIN_TERMS = [
  'Agent', 'LLM', 'RAG', 'AI', '人工智能', '产品', '学习', '论文', '工具调用',
  '羽毛球', '跑步', '运动', '摄影', '阅读', '展览', '科幻', '公益', '环保',
  '算法', 'Docker', 'React', '论坛', '安全', '见面', 'Citywalk', '闲置', '交换',
  '活动', '搭子', '讲座', '志愿',
] as const;

const GENERIC_TOKENS = new Set([
  '根据', '我的', '资料', '问卷', '推荐', '适合', '希望', '想找', '查找', '寻找',
  '圈子', '帖子', '相关', '一个', '一些', '最多', '分别', '各个', '内容',
]);

export interface AgentQueryPlan {
  intent: 'personalized_recommendation' | 'circle_search' | 'forum_search' | 'mixed_search';
  keywords: string[];
  circleLimit: number;
  postLimit: number;
  forumTypes: ForumPostType[];
  includeJoinedCircles: boolean;
  includeCirclePosts: boolean;
  usedProfileFallback: boolean;
}

function normalizeProfileTags(profileStatus: unknown): string[] {
  const profile = (profileStatus as { profile?: { tags?: unknown } } | null)?.profile;
  const raw = profile?.tags;
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return raw.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function inferTypes(message: string): ForumPostType[] {
  const types: ForumPostType[] = [];
  if (/闲置|交换|转让|二手/.test(message)) types.push('trade');
  if (/求助|请教|怎么办|建议|征集/.test(message)) types.push('help');
  if (/组队|招募|搭子|缺人/.test(message)) types.push('squad');
  if (/活动|讲座|共读|展览|比赛/.test(message)) types.push('activity');
  return types;
}

function requestedLimit(message: string): number {
  const match = message.match(/(?:最多|各|分别)?\s*([1-9])\s*(?:个|篇|条)/);
  if (!match) return DEFAULT_RESULTS;
  return Math.min(MAX_RESULTS, Math.max(1, Number(match[1])));
}

function addKeyword(target: string[], seen: Set<string>, raw: string) {
  const value = raw.trim()
    .replace(/^["“”'‘’]+|["“”'‘’。，、！？：；]+$/g, '')
    .replace(/[%_\\]/g, '');
  if (value.length < 2 || value.length > 32) return;
  const key = value.toLocaleLowerCase('zh-CN');
  if (GENERIC_TOKENS.has(key) || seen.has(key)) return;
  seen.add(key);
  target.push(value);
}

export function planAgentQuery(message: string, profileStatus: unknown): AgentQueryPlan {
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const term of DOMAIN_TERMS) {
    if (message.toLocaleLowerCase('zh-CN').includes(term.toLocaleLowerCase('zh-CN'))) {
      addKeyword(keywords, seen, term);
    }
  }

  for (const token of message.match(/[A-Za-z][A-Za-z0-9.+#-]{1,24}/g) ?? []) {
    addKeyword(keywords, seen, token);
  }
  for (const match of message.matchAll(/[“"]([^”"]{2,32})[”"]/g)) {
    addKeyword(keywords, seen, match[1] ?? '');
  }

  const wantsPersonalizedRecommendation = /资料|问卷|适合我|为我推荐|根据我/.test(message);
  const wantsCircles = /圈子|社群/.test(message);
  const wantsPosts = /帖子|论坛|招募|活动|求助|闲置|搭子|共读/.test(message);
  let usedProfileFallback = false;
  if (wantsPersonalizedRecommendation || keywords.length === 0) {
    for (const tag of normalizeProfileTags(profileStatus)) {
      const before = keywords.length;
      addKeyword(keywords, seen, tag);
      if (keywords.length > before) usedProfileFallback = true;
    }
  }

  return {
    intent: wantsPersonalizedRecommendation
      ? 'personalized_recommendation'
      : wantsCircles && wantsPosts
        ? 'mixed_search'
        : wantsPosts ? 'forum_search' : 'circle_search',
    keywords: keywords.slice(0, MAX_TERMS),
    circleLimit: requestedLimit(message),
    postLimit: requestedLimit(message),
    forumTypes: inferTypes(message),
    includeJoinedCircles: true,
    includeCirclePosts: true,
    usedProfileFallback,
  };
}
