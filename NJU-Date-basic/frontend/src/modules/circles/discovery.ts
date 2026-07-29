import type { Circle, CreateCirclePayload } from '../../api/circles';

export const CIRCLE_CATEGORY_LABELS: Record<string, string> = {
  game: '游戏',
  sports: '运动',
  study: '学习',
  life: '生活',
  music: '音乐',
  art: '艺术',
  tech: '科技',
  career: '职场',
  academic: '学业',
  arts: '文艺',
  professional: '职场',
  lifestyle: '生活',
  anime: '动漫/二次元',
  fan: '追星',
  reading: '阅读',
};

export type CircleCreateForm = {
  name: string;
  description: string;
  category: string;
  tags: string;
  joinPolicy: 'public' | 'review';
  joinQuestion: string;
};

export const EMPTY_CIRCLE_CREATE_FORM: CircleCreateForm = {
  name: '',
  description: '',
  category: 'lifestyle',
  tags: '',
  joinPolicy: 'review',
  joinQuestion: '',
};

export function displayCircleCategory(category?: string, fallback = '圈子频道') {
  if (!category) return fallback;
  return CIRCLE_CATEGORY_LABELS[category.toLowerCase()] || category;
}

export function getCircleStatusLabel(circle: Pick<Circle, 'status' | 'isActive'>) {
  if (circle.status === 'pending_review') return '待审核';
  if (circle.status === 'rejected') return '未通过';
  if (circle.status === 'banned') return '已封禁';
  if (circle.status === 'archived') return '已归档';
  if (circle.status === 'active' || circle.isActive === true) return '已上线';
  if (circle.status === 'inactive' || circle.isActive === false) return '未上线';
  return '处理中';
}

export function normalizeCreateCirclePayload(form: CircleCreateForm): CreateCirclePayload {
  const tags = form.tags
    .split(/[，,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category.trim() || 'custom',
    ...(tags.length > 0 ? { tags } : {}),
    joinPolicy: form.joinPolicy,
    ...(form.joinQuestion.trim()
      ? { joinQuestions: [{ question: form.joinQuestion.trim(), required: true }] }
      : {}),
  };
}

export function normalizeCircleSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function matchesCircleFilters(circle: Circle, activeCategory: string | null, normalizedQuery: string) {
  const categoryMatched = !activeCategory || circle.category === activeCategory;
  if (!categoryMatched) return false;

  if (!normalizedQuery) return true;

  const searchTarget = [
    circle.name,
    circle.description,
    circle.slug,
    circle.category ? displayCircleCategory(circle.category, '') : '',
    circle.category || '',
    circle.tag || '',
    ...(circle.tags || []),
  ]
    .join(' ')
    .toLowerCase();

  return searchTarget.includes(normalizedQuery);
}

export function getAvailableCircleCategories(circles: Circle[]) {
  const categories = new Set<string>();
  circles.forEach((circle) => {
    if (circle.category) categories.add(circle.category);
  });
  return Array.from(categories);
}

export function splitJoinedCircles(circles: Circle[]) {
  return {
    joinedCircles: circles.filter((circle) => circle.isJoined),
    unjoinedCircles: circles.filter((circle) => !circle.isJoined),
  };
}
