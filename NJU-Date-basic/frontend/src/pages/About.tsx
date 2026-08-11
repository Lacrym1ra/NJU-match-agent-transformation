import MaterialIcon from '../components/MaterialIcon';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FAQS = [
  {
    q: "NJU Match 的定位是什么？",
    a: "不同于快餐式的社交软件，NJU Match 是一个专注南大在校学生与校友的慢速策展社交平台。我们的设计强调真实、深度与同频，采用多维度价值观的问卷算法，帮你找到那个能产生精神共鸣的人。"
  },
  {
    q: "使用流程是怎样的？",
    a: "你需要使用南大邮箱完成注册，用一份能够反映你内心世界与生活侧写的问卷开启旅程。每周三晚，随着数字钟摆敲响 20:00，系统会将一份基于共同点洞察的「锦书」送到你的案头。"
  },
  {
    q: "为什么是每周匹配一次？",
    a: "这周太累不想匹配？一键开启「本周暂停」即可隐于人海。剥离多巴胺驱动的即时反馈，每周一次的慢节奏，是为了让你能认真对待眼前的这一份档案，在学习生活中留出一座供内心停泊的孤岛。"
  },
  {
    q: "只有南大学生可以使用吗？",
    a: "是的。为了确保社区的纯粹与安全，每一位访客都必须通过 @smail.nju.edu.cn 等南大专属认证体系进行验证。"
  },
  {
    q: "信息安全如何保障？",
    a: "未成功匹配（即双方均选择“愿见”）之前，你的全部联系方式、详细姓名与敏感要素将被严格封存。只有在命运的双选交汇时，缘分才会正式揭晓。"
  }
];

const About = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const fromDashboard = location.state?.fromDashboard === true;
  const backPath = fromDashboard ? "/dashboard" : "/";
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

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
          <Link to="/about" state={{ fromDashboard }} className="text-[#2C2825] border-b border-[#2C2825] pb-1">关于</Link>
          <Link to="/changelog" state={{ fromDashboard }} className="text-[#8B7355] hover:text-[#2C2825] transition-colors">日志</Link>
          <Link to="/privacy" state={{ fromDashboard }} className="text-[#8B7355] hover:text-[#2C2825] transition-colors">隐私</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20 md:py-32">
        {/* 序言 Header */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20 md:mb-32"
        >
          <div className="text-[#8B7355] tracking-[0.4em] text-xs font-serif uppercase mb-6">About Us</div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#420047] mb-8 tracking-widest leading-tight">
            在诚朴之间，<br />候一场明月相逢。
          </h1>
          <p className="text-base md:text-xl text-[#8B7355] font-serif max-w-xl mx-auto leading-relaxed md:leading-loose italic">
            面向校园社交场景的独立课程衍生版。<br />不代表南京大学官方，也不复用原项目运营身份。
          </p>
        </motion.section>

        {/* 缘起 Story */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-20 md:mb-32 relative"
        >
          <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-[#420047]/30 to-[#8B7355]/10" />
          <div className="pl-10 md:pl-16">
            <h2 className="font-serif text-3xl mb-8 tracking-wider">策展的初衷</h2>
            <div className="space-y-6 text-[#2C2825]/80 leading-loose text-justify font-light text-[17px]">
              <p>
                一切的起点，源于对当下滑动式社交的厌倦。我们发现：在一个只需 0.1 秒就能决定喜欢与否的机制里，缘份变得愈发易碎且廉价；在喧闹的表白墙与盲盒中，却很难找到能够静下心来探讨三观的知己。
              </p>
              <p>
                日复一日于鼓楼的中大路穿行，或是在仙林的杜厦里沉默，我们总会偶遇许多有趣的灵魂，却常常缺乏一个得体、不突兀的契机与之相识。
              </p>
              <p>
                于是，南得一见 (NJU Match) 应运而生。这不仅是一个匹配算法，更是一场大型的数字策展。我们用古典的浪漫主义封装严谨的数据拟合权重，用一整个星期的等待，换取一次深思熟虑的赴约。
              </p>
            </div>
          </div>
        </motion.section>

        {/* 答客问 FAQ (无界线设计) */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-20 md:mb-32"
        >
          <h2 className="font-serif text-3xl mb-12 tracking-wider text-center">旅人指南</h2>
          <div className="space-y-2">
            {FAQS.map((faq, idx) => (
              <div 
                key={idx} 
                className="group cursor-pointer py-6"
                onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
              >
                <div className="flex items-center gap-6">
                  <span className={`font-serif text-sm transition-opacity duration-300 ${expandedIndex === idx ? 'opacity-100 text-[#8B2323]' : 'opacity-0 group-hover:opacity-40 text-[#8B7355]'}`}>
                    ✦
                  </span>
                  <h3 className={`font-serif text-xl tracking-wide transition-colors ${expandedIndex === idx ? 'text-[#420047]' : 'text-[#2C2825]'}`}>
                    {faq.q}
                  </h3>
                </div>
                <AnimatePresence>
                  {expandedIndex === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="pl-10 mt-6 text-[#5E5855] leading-relaxed font-light text-[15px] md:text-base pr-4">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
             ))}
          </div>
        </motion.section>

        {/* 联络与信箱 Contact */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="bg-[#F3F1ED] p-12 text-center rounded-sm border border-[#EAE7E1] relative shadow-inner"
        >
          {/* 四角极微弱装饰 */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#8B7355]/40" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#8B7355]/40" />

          <MaterialIcon name="mail" className="text-[32px] text-[#420047]/60 mb-4 block" />
          <h2 className="font-serif text-2xl tracking-widest text-[#2C2825] mb-4">以纸笺相见</h2>
          <p className="text-[#8B7355] text-sm md:text-base font-light mb-8">
              本课程衍生版不沿用原项目的邮箱或社交媒体账号。<br />一般建议可提交至仓库 Issue；涉及安全或隐私的信息请使用仓库 Security 渠道，切勿公开粘贴个人数据。
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <a href="https://github.com/Lacrym1ra/NJU-match-agent-transformation/issues" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-[#8B7355]/40 text-[#420047] font-serif tracking-widest px-8 py-3 hover:bg-[#420047] hover:text-[#FCFBF8] transition-colors duration-500 w-64 justify-center">
              <MaterialIcon name="forum" className="text-[18px]" />
              仓库 Issues
            </a>
            <a href="https://github.com/Lacrym1ra/NJU-match-agent-transformation/security" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-[#8B7355]/40 text-[#420047] font-serif tracking-widest px-8 py-3 hover:bg-[#420047] hover:text-[#FCFBF8] transition-colors duration-500 w-64 justify-center">
              <MaterialIcon name="shield" className="text-[18px]" />
              安全与隐私渠道
            </a>
          </div>
        </motion.section>

      </main>

      <footer className="w-full text-center pb-8 pt-10 border-t border-[#EAE7E1] text-xs text-[#8B7355]/60 font-serif tracking-widest flex flex-col items-center gap-2">
        <p>© 2026 NJU Match Course Derivative.</p>
        <p>Independent coursework deployment · Not officially affiliated with Nanjing University.</p>
      </footer>
    </div>
  );
};

export default About;

