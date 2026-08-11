import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import MaterialIcon from '../components/MaterialIcon';

type PrivacySectionProps = {
  index: string;
  title: string;
  children: ReactNode;
};

function PrivacySection({ index, title, children }: PrivacySectionProps) {
  return (
    <section className="border-t border-[#EAE7E1] pt-9">
      <h2 className="mb-5 flex items-center gap-3 font-serif text-xl text-[#420047]">
        <span className="text-sm font-light text-[#8B7355]">{index}</span>
        {title}
      </h2>
      <div className="space-y-4 pl-0 text-[15px] font-light leading-8 text-[#5E5855] md:pl-8">
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  const location = useLocation();
  const fromPath = typeof location.state?.fromPath === 'string' ? location.state.fromPath : '/';
  const backPath = fromPath === '/privacy' ? '/' : fromPath;

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] selection:bg-[#420047] selection:text-[#FCFBF8]">
      <nav className="flex items-center justify-between px-6 py-6 md:px-16 md:py-10">
        <Link to={backPath} className="flex items-center gap-2 font-serif text-xl tracking-widest text-[#420047] hover:opacity-75">
          <MaterialIcon name="arrow_back_ios_new" className="text-[16px]" />
          返回
        </Link>
        <div className="flex gap-6 text-sm tracking-widest text-[#8B7355]">
          <Link to="/about" className="hover:text-[#2C2825]">关于</Link>
          <span className="border-b border-[#2C2825] pb-1 text-[#2C2825]">隐私边界</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 pb-28 pt-12 md:pt-20">
        <header className="mb-14 text-center md:mb-20">
          <p className="mb-6 text-xs tracking-[0.32em] text-[#8B7355]">COURSE DERIVATIVE / DATA BOUNDARY</p>
          <h1 className="mb-5 font-serif text-3xl tracking-[0.12em] md:text-5xl">隐私、身份与数据边界</h1>
          <p className="mx-auto max-w-2xl leading-7 text-[#5E5855]">
            本页描述的是 NJU Match 课程衍生版，而不是原项目或南京大学的隐私承诺。
            当前公开部署仍以课程验收和受控测试为目的。
          </p>
          <p className="mt-4 text-xs text-[#8B7355]">最后更新：2026-08-11</p>
        </header>

        <article className="space-y-12">
          <PrivacySection index="01" title="项目身份分离">
            <p>
              本版本在独立仓库、独立域名、独立数据库与独立凭据下运行，不与原项目的生产用户库同步，
              也不沿用原项目的邮箱、社交媒体或运营身份。页面中的“NJU”仅说明目标校园场景，
              不表示南京大学对本服务存在官方隶属、授权或背书。
            </p>
            <p className="rounded-2xl border border-[#8B7355]/20 bg-[#F3F1ED] p-5 text-sm">
              邮箱域验证只能证明注册者在验证时能够接收该邮箱的邮件，不能证明其当前学籍、现实身份或资料真实性。
            </p>
          </PrivacySection>

          <PrivacySection index="02" title="收集范围与用途">
            <ul className="list-disc space-y-2 pl-5 marker:text-[#8B7355]">
              <li><strong className="font-medium text-[#2C2825]">账号与认证：</strong>邮箱、密码哈希、验证码与登录状态，用于建立和保护账号。</li>
              <li><strong className="font-medium text-[#2C2825]">资料与问卷：</strong>用户主动填写的个人资料、偏好与问卷答案，用于资料卡、匹配和个性化筛选。</li>
              <li><strong className="font-medium text-[#2C2825]">社区内容：</strong>圈子申请、帖子、评论、私信、互动与举报，用于提供社区功能和内容治理。</li>
              <li><strong className="font-medium text-[#2C2825]">运行信息：</strong>必要的错误、审计与安全事件，用于排障、防滥用和验证系统行为。</li>
            </ul>
            <p>不同页面只应取得完成当前功能所需的数据；页面左下角的边界标识给出当前页面的可见性类别。</p>
          </PrivacySection>

          <PrivacySection index="03" title="Agent 与外部模型">
            <p>
              Agent 是本课程版新增的创新模块。启用真实模型 Provider 时，后端可能向所配置的模型服务发送：
              当前请求、最少量资料或问卷摘要、允许调用的工具说明，以及经过裁剪的工具结果。
              Agent 不应获得数据库凭据、密码、Cookie、完整私信库或其他用户的非公开资料。
            </p>
            <p>
              查询动作仍受当前账号权限约束；发帖、评论、加入圈子和圈内发言等写操作必须展示实际参数并由用户确认。
              模型给出的文字不是执行成功证明，只有后端工具返回成功 Observation 才算完成。
            </p>
            <p className="rounded-2xl border border-[#611066]/20 bg-[#611066]/5 p-5 text-sm text-[#420047]">
              正式接入真实用户前，部署者必须补充所选模型服务商、数据地域、保存期限与退出机制；未完成时只应使用合成测试账号。
            </p>
          </PrivacySection>

          <PrivacySection index="04" title="测试数据与生产数据分离">
            <p>
              仓库提供的种子账号、论坛帖子、圈子和匹配记录均应视为合成测试数据。`@test.local` 账号、
              `/agent-local` 免登录入口和开发辅助接口仅可在 development 环境使用；生产构建会关闭前端入口，
              后端也只在 development 环境注册相应接口。
            </p>
            <p>不得把原项目数据库备份、真实学生名单、真实聊天记录、真实 API Key 或证书复制进课程版数据库、镜像或仓库。</p>
          </PrivacySection>

          <PrivacySection index="05" title="保存、注销与当前限制">
            <p>
              账号注销会停用账号并清除直接身份字段；为保持引用完整性，部分问卷聚合和匹配记录可能在去标识化后保留。
              这不等同于所有备份与日志中的数据立即物理擦除。当前测试版尚未提供完整数据导出和独立的物理删除工单通道。
            </p>
            <p>
              在专用的非公开隐私联系渠道、保存期限和备份删除流程配置完成之前，公开部署应限制为知情的测试账号，
              用户不应填写真实联系方式或其他不必要的敏感信息。
            </p>
          </PrivacySection>

          <PrivacySection index="06" title="安全边界与用户责任">
            <p>
              密码只保存为单向哈希；生产环境要求 HTTPS、受限数据库端口、独立运行凭据与日志脱敏。
              但任何系统都不能承诺绝对安全。请使用独立密码，不要在帖子、私信、Agent 输入或公开 Issue 中粘贴密码、
              API Key、证件、精确住址或其他高敏感信息。
            </p>
            <p>
              如发现安全问题，请在不包含真实个人数据的前提下，通过项目仓库的安全报告渠道联系维护者；
              不要在公开 Issue 中披露可利用细节或个人信息。
            </p>
          </PrivacySection>
        </article>

        <div className="mt-16 border-t border-[#EAE7E1] pt-8 text-center">
          <a
            href="https://github.com/Lacrym1ra/NJU-match-agent-transformation/security"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm tracking-widest text-[#420047] hover:opacity-70"
          >
            查看仓库安全报告渠道
            <MaterialIcon name="open_in_new" className="text-[16px]" />
          </a>
        </div>
      </main>
    </div>
  );
}
