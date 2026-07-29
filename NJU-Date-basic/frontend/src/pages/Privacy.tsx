import MaterialIcon from '../components/MaterialIcon';
import React from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Privacy = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const fromDashboard = location.state?.fromDashboard === true;
  const backPath = fromDashboard ? "/dashboard" : "/";
  
  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-[#FCFBF8]">

      {/* 极简导航 */}
      <nav className="flex items-center justify-between px-8 py-6 md:px-16 md:py-10">
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
          <Link to="/changelog" state={{ fromDashboard }} className="text-[#8B7355] hover:text-[#2C2825] transition-colors">日志</Link>
          <Link to="/privacy" state={{ fromDashboard }} className="text-[#2C2825] border-b border-[#2C2825] pb-1">隐私</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        
        {/* 标题区 */}
        <header className="mb-12 md:mb-20 text-center relative">
          <div className="w-16 h-[1px] bg-[#8B7355]/40 mx-auto mb-8" />
          <h1 className="font-serif text-3xl md:text-4xl tracking-[0.2em] text-[#2C2825] mb-4">隐私与安全契约</h1>
          <p className="text-[#8B7355] text-sm tracking-widest font-serif italic">最后更新于: 2026年3月 · 诚朴之约</p>
        </header>

        {/* 契约正文区 */}
        <article className="space-y-10 md:space-y-16">
          
          <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-xl text-[#420047] mb-6 flex items-center gap-3">
              <span className="font-sans text-[#8B7355] font-light text-base">Ⅰ.</span> 信息的收集与缘起
            </h2>
            <div className="pl-6 md:pl-8 space-y-4 text-[15px] leading-loose text-[#5E5855] font-light">
              <p>当您步入 NJU Match 的殿堂，为了维持高质量的匹配与真实性，我们将谨慎地记录以下线索：</p>
              <ul className="list-disc pl-5 space-y-2 mt-4 marker:text-[#8B7355]">
                <li><strong className="font-medium text-[#2C2825]">学籍信标：</strong> 南大教育邮箱地址，仅用于验证您的校友身份。</li>
                <li><strong className="font-medium text-[#2C2825]">思想卷轴：</strong> 您在探寻问卷中留下的价值观与生活方式作答，用做内核共振的评判。</li>
                <li><strong className="font-medium text-[#2C2825]">社交暗号：</strong> 您提供的微信、QQ或其他联络方式，我们将对其施加最严苛的封引。</li>
              </ul>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-xl text-[#420047] mb-6 flex items-center gap-3">
              <span className="font-sans text-[#8B7355] font-light text-base">Ⅱ.</span> 信息的流转与运用
            </h2>
            <div className="pl-6 md:pl-8 space-y-4 text-[15px] leading-loose text-[#5E5855] font-light">
              <p>您的所有数据，皆服务于一场完美的相逢，绝不挪作他用：</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-[#8B7355]">
                <li>运行复杂的兼容度算法，在全库寻找与您频率最契合的人。</li>
                <li>每周锦书中，向对方呈现一份经过<strong className="text-[#420047]">高度脱敏（隐去姓名联系方式）</strong>的特质侧写。</li>
              </ul>
              
              <div className="mt-8 p-5 bg-[#FCFBF8] border border-[#8B2323]/20 relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#8B2323]/60" />
                <p className="text-[#8B2323] text-sm tracking-wide font-serif">
                  <strong>红木印信：</strong> 您的联系方式（社交暗号）仅在双方跨越犹豫，共同签下「愿见」之约后，方才向彼此揭晓。其余时间，对任何人均处于不可见状态。
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-xl text-[#420047] mb-6 flex items-center gap-3">
              <span className="font-sans text-[#8B7355] font-light text-base">Ⅲ.</span> 数据的封存与安葬
            </h2>
            <div className="pl-6 md:pl-8 space-y-4 text-[15px] leading-loose text-[#5E5855] font-light">
              <p>我们采用行业标准的加密技术来拱卫这座数字殿堂。在数据库的深处，您的邮箱地址与问卷答案是剥离保存的，即使是后台维护者，亦无法轻易将两者拼凑。</p>

              <div className="mt-6 p-5 bg-[#F3F1ED] border-l-2 border-[#8B7355]/40 space-y-3">
                <p className="text-[13px] font-medium text-[#2C2825] tracking-wide">密码安全说明</p>
                <ul className="text-[13px] leading-relaxed space-y-2 text-[#5E5855]">
                  <li><strong className="font-medium text-[#2C2825]">传输层：</strong>登录与注册全程通过 HTTPS（TLS）加密，密码在网络上从不以明文形式存在。</li>
                  <li><strong className="font-medium text-[#2C2825]">存储层：</strong>服务端使用 bcrypt（12轮加盐哈希）对密码进行单向加密，数据库中只留有不可逆的哈希值。平台运营者在技术上无法还原您的原始密码。</li>
                  <li><strong className="font-medium text-[#2C2825]">关于前端加密的疑惑：</strong>若有朋友好奇，为何不先在前端加密密码后再发送？事实上，如果只在前端进行加密，这个加密后的值在传输中就等同于“新密码”，一旦被截获依然存在被直接利用的隐患。因此，我们选择恪守业界最严谨的安全准则：由 HTTPS 加密通道为您的传输全程保驾护航，信息抵达深处后再由 bcrypt 算法进行不可逆的深度封存。传输与存储的双保护，方为您打造真正可靠的安全堡垒。</li>
                </ul>
              </div>

              <p>我们郑重承诺，绝不将您的灵魂侧写或个人信息出售予任何第三方。</p>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-serif text-xl text-[#420047] mb-6 flex items-center gap-3">
              <span className="font-sans text-[#8B7355] font-light text-base">Ⅳ.</span> 离场与遗忘权利
            </h2>
            <div className="pl-6 md:pl-8 space-y-4 text-[15px] leading-loose text-[#5E5855] font-light">
              <p>若您找到了归宿，亦或厌倦了流浪，您随时可以在「账户设置」页，主动要求注销。一经注销，您的<strong className="font-medium text-[#2C2825]">问卷数据</strong>将被即刻匿名化处理（移除所有可识别字段）；<strong className="font-medium text-[#2C2825]">配对记录</strong>以匿名形式留存，用于算法改进；账号将无法恢复。</p>
              <p>如需完整删除全部数据，请发送邮件至{' '}
                <a href="mailto:njumatch@163.com" className="text-[#420047] underline underline-offset-2">njumatch@163.com</a>
                ，我们将在 7 个工作日内处理。
              </p>
            </div>
          </motion.section>

        </article>

        <div className="mt-16 md:mt-24 pt-8 border-t border-[#EAE7E1] text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] font-serif tracking-widest text-sm transition-colors group">
              <MaterialIcon name="west" className="text-[16px] group-hover:-translate-x-1 transition-transform" />
              返回锦书扉页
            </Link>
        </div>

      </main>
    </div>
  );
};

export default Privacy;
