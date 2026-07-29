import React from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import MaterialIcon from '../components/MaterialIcon';

// 这里是更新日志的数据结构，后续让 Claude 根据这个格式填充具体内容
// 请注意保证没有使用任何 Emoji
interface ChangelogEntry {
  date: string;
  items: {
    version?: string;
    text: string;
  }[];
}

/**
 * Latest released version + one-line summary shown as a notification badge
 * in Dashboard. Update these two fields every time a new version is released.
 */
export const CHANGELOG_NOTICE = {
  version: 'v2.4.0',
  summary: '心动信笺与页面体验升级',
  detail: '全新上线心动信笺匿名投递功能，支持按学号投递一次匿名心意，仅在双方互选时启封。并全面升级重构了仪表盘与设置页等各个界面的视觉留白与交互动线体验。',
};

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    date: '2026.5.21',
    items: [
      { version: 'v2.4.1', text: '心动信笺体验优化：双向奔赴后不再等待主线空档，可直接启封，并继续自动暂停主线匹配以专注当下缘分' },
    ],
  },
  {
    date: '2026.5.20',
    items: [
      { version: 'v2.4.0', text: '全新「心动信笺」上线：支持按学号投递一次匿名心意，当且仅当对方也走向你时，缘分才会悄然启封' },
      { version: 'v2.4.0', text: '「双向奔赴」专属体验：双向匹配成功时即刻揭晓，并贴心为您自动暂停主线匹配，以专注当下缘分' },
      { version: 'v2.4.0', text: '隐私与心意保护：投递全流程严密防护不走漏风声，且单向等待期间支持撤回（含 7 天冷却期）' },
      { version: 'v2.4.0', text: '全局视觉空间升级：重新梳理仪表盘、问卷系统与设置页面的空间留白，呈现更沉浸、更具呼吸感的极致界面体验' },
      { version: 'v2.4.0', text: '导航与交互重构：优化各层级子页面的响应逻辑与顶部极简导航形态，提供更顺滑的智能上下文返回操作' },
      { version: 'v2.4.0', text: '账户机制优化：更加完善登录校验，并全面支持学号邮箱与邮箱别名的智能自动 / 手动绑定' },
    ],
  },
  {
    date: '2026.5.6',
    items: [
      { version: 'v2.3.0', text: '圈子组队功能上线：可在兴趣圈内发布临期或长期组队，邀请同好一起自习、运动、游戏、探店或开展其他活动' },
      { version: 'v2.3.0', text: '组队准入支持直接加入与申请审核两种模式，组长可以查看拜帖并决定是否准入' },
      { version: 'v2.3.0', text: '组队联系方式按成员身份与时间节点保护，发布和加入时会自动带入档案联系方式，也可临时修改' },
    ],
  },
  {
    date: '2026.5.5',
    items: [
      { version: 'v2.2.0', text: '匹配体验权重升级：连续多周未匹配到人的用户将获得温和优先级补偿，尽量减少长期落空的体验' },
      { version: 'v2.2.0', text: '匹配池活跃治理优化：连续拒绝或过期不回应的用户将相应降低匹配优先级，让认真参与的人更容易被看见' },
      { version: 'v2.2.0', text: '匹配质量底线保持不变：体验权重只影响候选排序，不会绕过硬性筛选或把低质量配对强行抬进匹配池' },
    ],
  },
  {
    date: '2026.4.29',
    items: [
      { version: 'v2.1.0', text: '安全机制重磅升级：全面上线举报与拉黑功能，致力为您提供一个安全、友善的交流环境' },
      { version: 'v2.1.0', text: '仪表盘历史记录优化：支持查看每一期的专属记录，即使是未匹配的周末也在历史记录中留存' },
      { version: 'v2.1.0', text: '匹配算法持续优化：更严格地落实校区等硬性筛选偏好，让推荐更加精准' },
      { version: 'v2.1.0', text: '基础体验优化：本地化图标资源加载，整体浏览体验更加流畅' },
    ],
  },
  {
    date: '2026.4.22',
    items: [
      { version: 'v2.0', text: '圈子系统升级至 2.0，「破冰频道」正式开放，不止每周匹配，你也可以在共同兴趣里主动相遇' },
      { version: 'v2.0', text: '加入圈子后即可定制专属同好名片，不同的圈子，可以展示不同维度的你' },
      { version: 'v2.0', text: '圈子大厅现可翻阅成员公开名片，先看见彼此的表达与兴趣，再决定是否主动结识' },
      { version: 'v2.0', text: '圈内结识与联络流程完整打通：先递交交际申请，再在熟悉之后交换联系方式，节奏更自然' },
      { version: 'v2.0', text: '若你们在多个圈子里陆续结缘，已建立的联络关系会被妥帖留存，后续翻阅与回看都更方便' },
      { version: 'v2.0', text: '圈子入口、名片编辑与同窗名录体验同步整理，发现同频的人这件事，终于不只停留在一封周三来信里' },
    ],
  },
  {
    date: '2026.4.22',
    items: [
      { version: 'v1.5.0', text: 'NJU 人格测试上线，26 题即可解锁你的专属人格结果' },
      { version: 'v1.5.0', text: '人格结果页包含专属插画、人格介绍与潜在共振点展示' },
      { version: 'v1.5.0', text: '结果支持保存为海报图片，分享体验更完整' },
      { version: 'v1.5.0', text: '已完成主问卷的用户现在可以直接查看人格结果，也能随时回去修润答案' },
      { version: 'v1.5.0', text: '仪表盘历史记录支持展开查看，联系方式可一键复制' },
    ],
  },
  {
    date: '2026.4.11 (补充)',
    items: [
      { version: 'v1.4.1', text: '草稿治理优化：引入多端时间戳比对，彻底杜绝跨设备（如手机与 iPad）间的旧版问卷草稿误覆盖最新答卷问题' },
      { version: 'v1.4.1', text: '匹配算法透明化：首页及 FAQ 新增“先过边界，再算兼容”等算法说明，澄清匹配并非要求维度绝对一致' },
      { version: 'v1.4.1', text: '状态组件反馈升级：问卷未完成期间点击仪表盘禁用操作，将唤起具体提示并提供更清晰的指引' },
      { version: 'v1.4.1', text: '部分问卷选项释义优化，算法层解除过时的多选强制废弃，允许安全降级' },
    ],
  },
  {
    date: '2026.4.11',
    items: [
      { version: 'v1.4.0', text: '问卷版本升级至 v4.0，题目体系全面升级，匹配体验更准确、更贴近真实相处' },
      { version: 'v1.4.0', text: '找朋友/搭子模式优化：恋爱专属题目自动标灰跳过，不影响朋友匹配体验' },
      { version: 'v1.4.0', text: '家乡匹配细化：江苏用户新增省内城市选择，支持精确到市级的家乡偏好匹配' },
      { version: 'v1.4.0', text: '校区偏好新增"自选接受的校区"选项，最多勾选 3 个指定校区' },
      { version: 'v1.4.0', text: '问卷与匹配算法同步升级：更细化识别兴趣重合、相处节奏与偏好兼容度，匹配分数底线提升至 60%' },
      { version: 'v1.4.0', text: '匹配治理机制上线：揭晓后 48 小时未做选择将自动暂停匹配；持续未恢复将进入休眠流程，提升匹配池活跃度' },
      { version: 'v1.4.0', text: '通知体系扩展：新增问卷更新提醒、匹配到期预警、自动暂停通知与休眠通知，关键节点均有明确触达' },
      { version: 'v1.4.0', text: '安全与稳定性同步加固，整体使用体验更稳健' },
    ],
  },
  {
    date: '2026.4.7',
    items: [
      { version: 'v1.3.0', text: '全局操作提示：暂停/恢复本周参与等关键操作现有明确的成功/失败气泡提示，不再静默' },
      { version: 'v1.3.0', text: '移动端优化：问卷填写时输入框自动滚入视口中央，防止软键盘遮挡内容，适配 iOS 底部安全区' },
      { version: 'v1.3.0', text: '登录后页面跳转逻辑优化，建档、填问卷、正常使用三种状态之间的路由切换更稳定' },
      { version: 'v1.3.0', text: '注销机制更新：注销后账号数据改为匿名化处理（移除所有可识别字段，配对记录匿名留存用于算法改进）' },
    ],
  },
  {
    date: '2026.4.2',
    items: [
      { version: 'v1.2.5', text: '问卷提交遇到遗漏时，一次性高亮所有未完成题目，方便定位' },
      { version: 'v1.2.5', text: '针对“其他”选项，新增专属提示语“请补充填写‘其他’选项”' },
      { version: 'v1.2.5', text: '优化个人档案设置表单验证，提供更友好的界面交互提示' },
      { version: 'v1.2.5', text: '深度修复问卷表单中因遗留前后空格绕过作答校验的漏洞' },
      { version: 'v1.2.5', text: '修正部分文本输入清空后未正确重置为“未答”状态的边界问题' },
      { version: 'v1.2.4', text: '揭晓页新增操作说明文字，明确双方均愿见后才互相揭晓联系方式' },
      { version: 'v1.2.4', text: '优化匹配中的年龄限制逻辑，放宽了出生年份的单边约束情况，避免意外落选' },
    ],
  },
  {
    date: '2026.4.1',
    items: [
      { version: 'v1.2.3', text: '深度优化问卷页面的底部操作栏排版，解决小尺寸手机屏幕按钮拥挤问题' },
      { version: 'v1.2.3', text: '精细调整问卷打分组件的大小，解决宽屏幕下非预期横向滚动条问题' },
      { version: 'v1.2.3', text: '匹配揭晓页面对方校区信息转化为中文显示（如“仙林”、“鼓楼”）' },
      { version: 'v1.2.2', text: '“愿见”与“止步”操作新增二次确认弹窗，防范手滑误操作' },
      { version: 'v1.2.2', text: '全面优化揭晓页面对方年级的文案展示（如“大三”显示为“本科三年级”）' },
      { version: 'v1.2.2', text: '修复首次参与匹配且暂无缘分的用户在揭晓阶段错误显示状态提示的问题' },
      { version: 'v1.2.1', text: '学院列表新增「教育研究院・陶行知教师教育学院」' },
    ],
  },
  {
    date: '2026.3.31',
    items: [
      { version: 'v1.2.0', text: '匹配对方基础信息板块新增性别与所在校区显示' },
      { version: 'v1.2.0', text: '新增「共同兴趣」区块，一览双方重叠爱好' },
      { version: 'v1.2.0', text: '三个匹配维度新增文字洞察分析，取代冰冷的百分比结果' },
      { version: 'v1.2.0', text: 'AI 策展寄语全面升级：基于双方共同兴趣与校区给出约会参考' },
      { version: 'v1.2.0', text: '引入最低契合度门槛，低质量配对严格拦截' },
      { version: 'v1.1.1', text: '匹配计算期间，问卷与参与状态切换将被锁定以防打断进程' },
      { version: 'v1.1.1', text: '上线更新日志版块' },
    ],
  },
  {
    date: '2026.3.30',
    items: [
      { version: 'v1.1.0', text: '问卷版本升级至 v3.0：新增未来发展地区与兴趣细分追问，并上线问卷版本更新提醒' },
      { version: 'v1.1.0', text: '问卷新增「未来倾向发展省份」多向选择题' },
      { version: 'v1.1.0', text: '兴趣大分类下补充 4 道追问细节题' },
      { version: 'v1.1.0', text: '将模糊的「亲密关系预期」问题重新拆分为自我期望与对方期望' },
      { version: 'v1.1.0', text: '加入全新的开放性填空题，让个性化表达更充实' },
      { version: 'v1.1.0', text: '更新防呆设计，题目增加序号且旧答案不匹配版本时弹出红点警告' },
      { version: 'v1.1.0', text: '仪表盘新增轻量化的「本周暂停」开关，实现停转周期分离' },
      { version: 'v1.1.0', text: '修复注销账户后问卷草稿缓存未被彻底清空的问题' },
      { version: 'v1.1.0', text: '阻止由于无效未注册邮箱而诱发的假性「登录过期」弹窗误报' },
    ],
  },
  {
    date: '2026.3.28',
    items: [
      { version: 'v1.0.0', text: '内测首发：南得一见每周三匹配机制上线运行' },
      { version: 'v1.0.0', text: '提供涵盖 MBTI、三观、生活习惯等多维度精细问卷系统' },
      { version: 'v1.0.0', text: '前端组件提供紧凑级省份选择器与出生年份规则预验证' },
      { version: 'v1.0.0', text: '完善注销、注册和找回逻辑流程的表单阻断及友好红字提示' },
      { version: 'v1.0.0', text: '新形态匹配仪表盘落装，提供配对倒计时视觉交互' },
      { version: 'v1.0.0', text: '接入阿里云专业级系统邮件分发组件并配装全站 HTTPS 加密' },
    ],
  }
];

const Changelog: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const fromDashboard = location.state?.fromDashboard === true;
  const backPath = fromDashboard ? "/dashboard" : "/";
  
  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-[#FCFBF8] flex flex-col">

      {/* 极简导航 */}
      <nav className="flex items-center justify-between px-8 py-6 md:px-16 md:py-10 shrink-0">
        <Link 
          to={backPath}
          className="font-serif text-2xl tracking-widest text-[#420047] flex items-center gap-2 hover:opacity-80 transition-opacity"
          title={fromDashboard ? "返回仪表盘" : "返回首页"}
        >
          {fromDashboard && <MaterialIcon name="arrow_back_ios_new" className="text-[18px]" />}
          南得一见
        </Link>
        <div className="flex gap-8 font-serif text-sm tracking-widest">
          <Link to="/about" state={{ fromDashboard }} className="text-[#8B7355] hover:text-[#2C2825] transition-colors">关于</Link>
          <span className="text-[#2C2825] border-b border-[#2C2825] pb-1 cursor-default">日志</span>
          <Link to="/privacy" state={{ fromDashboard }} className="text-[#8B7355] hover:text-[#2C2825] transition-colors">隐私</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 md:py-20 w-full flex flex-col items-center">
        {/* 头部标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <div className="font-sans text-xs tracking-widest text-[#8B7355]/70 mb-4 uppercase">NJU DATE</div>
          <h1 className="font-serif text-4xl md:text-5xl text-[#420047] tracking-widest mb-6">
            更新日志
          </h1>
          <p className="font-sans text-[#8B7355] tracking-widest text-sm font-light">
            记录每一次优化与改进
          </p>
        </motion.div>

        {/* 已发布版本时间线 */}
        <div className="space-y-8 md:space-y-12 w-full max-w-2xl">
          {CHANGELOG_DATA.map((entry, idx) => (
            <motion.section
              key={entry.date}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-5%" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="bg-[#FCFBF8] border border-[#F3F1ED] rounded-3xl p-8 md:p-10 shadow-[0_2px_20px_rgba(0,0,0,0.01)]"
            >
              <h2 className="font-serif text-2xl tracking-wide text-[#8B7355] mb-8 pb-4 border-b border-[#F3F1ED]/50">
                {entry.date}
              </h2>

              <ul className="space-y-5">
                {entry.items.map((item, iIdx) => {
                  const showVersion = item.version && (iIdx === 0 || item.version !== entry.items[iIdx - 1].version);
                  return (
                    <li key={iIdx} className="flex items-start gap-4">
                      <span className="shrink-0 mt-2.5 w-1.5 h-1.5 rounded-full bg-[#8B7355]/80"></span>
                      <span className="font-sans text-[#5c544d] leading-relaxed tracking-wide text-[14px] flex items-start">
                        {item.version ? (
                          <span className={`font-medium shrink-0 w-[68px] mr-2 text-[#8B7355] ${showVersion ? 'opacity-80' : 'opacity-0 select-none'}`}>
                            [{item.version}]
                          </span>
                        ) : null}
                        <span>{item.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Changelog;
