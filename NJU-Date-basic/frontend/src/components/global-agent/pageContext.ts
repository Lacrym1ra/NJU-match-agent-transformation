import type { AgentPageContext } from '../../api/agent';

function segment(pathname: string, index: number) {
  const value = pathname.split('/').filter(Boolean)[index];
  if (!value) return undefined;
  try { return decodeURIComponent(value).slice(0, 120); } catch { return value.slice(0, 120); }
}

export function deriveAgentPageContext(pathname: string, documentTitle?: string): AgentPageContext {
  const pathOnly = pathname.split(/[?#]/, 1)[0] ?? '/';
  const safePath = pathOnly.startsWith('/') ? pathOnly.slice(0, 300) : '/';
  const title = documentTitle?.trim().slice(0, 160) || undefined;
  const circleId = safePath.startsWith('/circles/') ? segment(safePath, 1) : undefined;
  const teamupId = circleId && safePath.includes('/teamups/') ? segment(safePath, 3) : undefined;
  const postId = safePath.startsWith('/forum/') && !/^\/forum\/(ranking|guestbook)(?:\/|$)/.test(safePath)
    ? segment(safePath, 1) : undefined;

  if (safePath === '/dashboard' || safePath === '/profile') {
    return { pathname: safePath, pageType: safePath === '/profile' ? 'profile' : 'dashboard', title };
  }
  if (teamupId && safePath.includes('/chat')) {
    return { pathname: safePath, pageType: 'teamup_chat', resourceId: teamupId, parentResourceId: circleId, title };
  }
  if (teamupId) {
    return { pathname: safePath, pageType: 'teamup', resourceId: teamupId, parentResourceId: circleId, title };
  }
  if (circleId && safePath.includes('/livechat')) {
    return { pathname: safePath, pageType: 'circle_livechat', resourceId: circleId, title };
  }
  if (circleId) return { pathname: safePath, pageType: 'circle', resourceId: circleId, title };
  if (postId) return { pathname: safePath, pageType: 'forum_post', resourceId: postId, title };
  if (safePath.startsWith('/forum')) return { pathname: safePath, pageType: 'forum', title };
  if (safePath === '/survey') return { pathname: safePath, pageType: 'survey', title };
  if (/^\/(reveal|heartbox)(?:\/|$)/.test(safePath)) return { pathname: safePath, pageType: 'match', title };
  if (safePath.startsWith('/messages')) return { pathname: safePath, pageType: 'messages', resourceId: segment(safePath, 1), title };
  if (safePath.startsWith('/user/')) return { pathname: safePath, pageType: 'profile', resourceId: segment(safePath, 1), title };
  if (safePath.startsWith('/settings') || safePath === '/account') return { pathname: safePath, pageType: 'settings', title };
  if (safePath === '/notifications') return { pathname: safePath, pageType: 'notifications', title };
  return { pathname: safePath, pageType: 'other', title };
}

export const pageContextLabels: Record<AgentPageContext['pageType'], string> = {
  dashboard: '主页',
  circle: '圈子',
  circle_livechat: '圈内茶话',
  teamup: '搭子/组队',
  teamup_chat: '搭子群聊',
  forum: '论坛',
  forum_post: '帖子',
  match: '匹配',
  survey: '问卷',
  messages: '私信',
  profile: '资料',
  settings: '设置',
  notifications: '通知',
  other: '当前页面',
};
