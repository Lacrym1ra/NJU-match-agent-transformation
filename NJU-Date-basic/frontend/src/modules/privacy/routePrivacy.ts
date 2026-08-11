export type RoutePrivacyKind =
  | 'public'
  | 'personal'
  | 'community'
  | 'agent'
  | 'privileged'
  | 'development';

export type RoutePrivacyRule = {
  pattern: string;
  kind: RoutePrivacyKind;
  label: string;
  notice: string;
  productionEnabled: boolean;
};

export const ROUTE_PRIVACY_RULES: readonly RoutePrivacyRule[] = [
  { pattern: '/', kind: 'public', label: '公开介绍', notice: '不应展示账号私密数据', productionEnabled: true },
  { pattern: '/login', kind: 'public', label: '身份入口', notice: '仅提交认证所需信息', productionEnabled: true },
  { pattern: '/about', kind: 'public', label: '公开介绍', notice: '课程衍生版，不代表校方', productionEnabled: true },
  { pattern: '/personality-test', kind: 'public', label: '本地体验', notice: '结果提交前不进入账号资料', productionEnabled: true },
  { pattern: '/personality-result', kind: 'public', label: '本地体验', notice: '结果提交前不进入账号资料', productionEnabled: true },
  { pattern: '/changelog', kind: 'public', label: '公开记录', notice: '不应包含用户或凭据信息', productionEnabled: true },
  { pattern: '/privacy', kind: 'public', label: '隐私边界', notice: '查看课程衍生版数据说明', productionEnabled: true },
  { pattern: '/agent-demo', kind: 'public', label: '离线演示', notice: '不得读取真实账号资料', productionEnabled: true },
  { pattern: '/agent-local', kind: 'development', label: '本地测试', notice: '生产构建已禁用免登录入口', productionEnabled: false },

  { pattern: '/dashboard', kind: 'personal', label: '个人数据', notice: '仅限当前登录账号', productionEnabled: true },
  { pattern: '/onboarding', kind: 'personal', label: '个人资料', notice: '仅收集业务所需字段', productionEnabled: true },
  { pattern: '/profile', kind: 'personal', label: '个人数据', notice: '仅限当前登录账号', productionEnabled: true },
  { pattern: '/survey', kind: 'personal', label: '问卷数据', notice: '敏感答案仅用于明确功能', productionEnabled: true },
  { pattern: '/reveal', kind: 'personal', label: '匹配结果', notice: '受双方选择与权限约束', productionEnabled: true },
  { pattern: '/heartbox', kind: 'personal', label: '匹配结果', notice: '受双方选择与权限约束', productionEnabled: true },
  { pattern: '/heartbox/reveal', kind: 'personal', label: '匹配结果', notice: '受双方选择与权限约束', productionEnabled: true },
  { pattern: '/student-id/bind', kind: 'personal', label: '身份资料', notice: '不得向社区页面公开', productionEnabled: true },
  { pattern: '/settings', kind: 'personal', label: '账号设置', notice: '仅限当前登录账号', productionEnabled: true },
  { pattern: '/settings/card', kind: 'personal', label: '个人资料', notice: '发布前检查可见字段', productionEnabled: true },
  { pattern: '/account', kind: 'personal', label: '账号安全', notice: '注销与凭据操作不可代办', productionEnabled: true },
  { pattern: '/agent', kind: 'agent', label: 'Agent 辅助', notice: '最少上下文，写操作需确认', productionEnabled: true },
  { pattern: '/resonance', kind: 'personal', label: '共鸣胶囊', notice: '双方回应仅在共同提交后揭晓', productionEnabled: true },
  { pattern: '/resonance/:id', kind: 'personal', label: '共鸣胶囊', notice: '仅限胶囊双方访问，单边回答保持封存', productionEnabled: true },
  { pattern: '/meetup-safety', kind: 'personal', label: '安心赴约', notice: '地点与备注仅限当前账号，签到必须由本人完成', productionEnabled: true },

  { pattern: '/circles', kind: 'community', label: '圈子社区', notice: '遵循成员与内容可见性', productionEnabled: true },
  { pattern: '/circles/:id', kind: 'community', label: '圈子社区', notice: '遵循成员与内容可见性', productionEnabled: true },
  { pattern: '/circles/:id/manage', kind: 'privileged', label: '圈子管理', notice: '仅限圈主或获授权成员', productionEnabled: true },
  { pattern: '/circles/:id/teamups', kind: 'community', label: '圈子组队', notice: '联系方式按业务授权展示', productionEnabled: true },
  { pattern: '/circles/:id/livechat', kind: 'community', label: '圈内会话', notice: '仅限具备圈内权限的成员', productionEnabled: true },
  { pattern: '/circles/:id/create-teamup', kind: 'community', label: '圈子组队', notice: '发布内容需由本人确认', productionEnabled: true },
  { pattern: '/circles/:id/teamups/:teamupId', kind: 'community', label: '圈子组队', notice: '联系方式按业务授权展示', productionEnabled: true },
  { pattern: '/forum', kind: 'community', label: '论坛社区', notice: '内容按公开与圈内权限展示', productionEnabled: true },
  { pattern: '/forum/ranking', kind: 'community', label: '论坛社区', notice: '只展示允许公开的统计', productionEnabled: true },
  { pattern: '/forum/guestbook', kind: 'community', label: '站内反馈', notice: '请勿提交凭据与敏感身份信息', productionEnabled: true },
  { pattern: '/forum/:postId', kind: 'community', label: '论坛内容', notice: '遵循帖子可见性与匿名设置', productionEnabled: true },
  { pattern: '/notifications', kind: 'personal', label: '个人通知', notice: '仅限当前登录账号', productionEnabled: true },
  { pattern: '/user/:userId', kind: 'community', label: '公开资料', notice: '只展示用户允许公开的字段', productionEnabled: true },
  { pattern: '/follows', kind: 'personal', label: '社交关系', notice: '仅限当前登录账号', productionEnabled: true },
  { pattern: '/messages', kind: 'personal', label: '私信内容', notice: '仅限会话参与者', productionEnabled: true },
  { pattern: '/messages/:userId', kind: 'personal', label: '私信内容', notice: '仅限会话参与者', productionEnabled: true },
  { pattern: '/admin', kind: 'privileged', label: '独立管理入口', notice: '使用独立管理员认证与网络限制', productionEnabled: true },
  { pattern: '*', kind: 'public', label: '未知页面', notice: '不应展示任何私密数据', productionEnabled: true },
] as const;

function matches(pattern: string, pathname: string): boolean {
  if (pattern === '*') return true;
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
}

export function getRoutePrivacy(pathname: string): RoutePrivacyRule {
  return ROUTE_PRIVACY_RULES.find((rule) => matches(rule.pattern, pathname))
    ?? ROUTE_PRIVACY_RULES[ROUTE_PRIVACY_RULES.length - 1];
}
