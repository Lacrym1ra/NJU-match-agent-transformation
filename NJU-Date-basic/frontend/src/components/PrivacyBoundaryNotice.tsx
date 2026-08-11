import { Link, useLocation } from 'react-router-dom';
import { getRoutePrivacy } from '../modules/privacy/routePrivacy';

export default function PrivacyBoundaryNotice() {
  const { pathname } = useLocation();
  const rule = getRoutePrivacy(pathname);

  return (
    <aside className="fixed bottom-3 left-3 z-[35] max-w-[calc(100vw-6rem)]" aria-label="当前页面隐私边界">
      <Link
        to="/privacy"
        state={{ fromPath: pathname }}
        className="group flex items-center gap-2 rounded-full border border-[#d4c1cf]/70 bg-[#fff8f7]/90 px-3 py-2 text-[11px] text-[#50434e] shadow-[0_8px_28px_rgba(66,0,71,0.10)] backdrop-blur-xl transition hover:border-[#611066]/40 hover:text-[#420047]"
        title={`${rule.label}：${rule.notice}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#611066]" aria-hidden="true" />
        <strong className="whitespace-nowrap font-medium">{rule.label}</strong>
        <span className="hidden truncate sm:inline">{rule.notice}</span>
      </Link>
    </aside>
  );
}
