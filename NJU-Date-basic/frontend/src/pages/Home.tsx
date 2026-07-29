import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Timer from '../components/Timer';
import Footer from '../components/Footer';
import Announcement from '../components/Announcement';
import GuestFeatureModal from '../components/GuestFeatureModal';
import { api } from '../api/client';
import MaterialIcon from '../components/MaterialIcon';

const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } }
};

const FAQ = [
  { q: "为何仅限南大在校生？", a: "为了维持高质量、真实的匹配环境，我们将用户池严格限定为通过 smail.nju.edu.cn 邮箱认证的南大学子。" },
  { q: "匹配机制是怎样的？", a: "采用“先过边界，再算兼容”的策略。系统不苛求所有选项一致，而是在互相过滤掉“硬性不可接受项”后，综合评价生活、兴趣与价值观的契合度。每周三晚 20:00 仅对分数达标者发放匹配结果，宁缺毋滥。" },
  { q: "如果我不满意本周的匹配结果，或想休息一下？", a: "你可以选择“止步”，你的决定对对方是匿名的保护。若想短暂休息，你也可在仪表盘开启「本周暂停」，下周系统会自动为你寻找新的同行者，灵活控制自己的社交节奏。" },
  { q: "对方会看到我的真实身份吗？", a: "在匹配初显阶段，你们只能看到彼此的系别、脱敏的年级（如“本科三年级”）与基于共同点生成的性格洞察。只有双方都在规定时间内签下“愿见”之约时，联系方式才会向彼此交换。" },
  { q: "算法真的能找到对的人吗？", a: "算法通过多维度加权与稳定匹配，为你筛除硬性不合，并引入了「最低契合度门槛」——宁缺毋滥。但这只是指路明灯，真正的羁绊仍取决于真实的相处。" }
];

const Home = () => {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacityParallax = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const yBgParallax = useTransform(scrollYProgress, [0, 1], [0, 150]);

  const [faqExpanded, setFaqExpanded] = useState<number | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  const [stats, setStats] = useState({ totalUsers: 0, surveyCompletionRate: 0, successfulMatches: 0 });
  useEffect(() => {
    api.get<{ totalUsers: number; surveyCompletionRate: number; successfulMatches: number }>('/stats')
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FCFBF8] selection:bg-[#5C3B4E]/20 selection:text-[#5C3B4E] overflow-hidden font-sans">
      <NavBar />
      <Announcement />
      <GuestFeatureModal />
      
      {/* 1. Poetic Atmospheric Hero */}
      <section className="relative min-h-[100vh] flex flex-col justify-center items-center px-6 pt-24 overflow-hidden">
        {/* Background Environment - Ethereal Campus Feel */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Soft tint overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(252,251,248,0.92)_0%,rgba(252,251,248,0.5)_35%,transparent_70%)] z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FCFBF8]/30 to-[#FCFBF8] z-20"></div>

            {/* Hero Image */}
             <motion.img
               style={{ y: yBgParallax }}
               initial={{ opacity: 0 }}
               animate={{ opacity: bgLoaded ? 0.4 : 0 }}
               transition={{ duration: 1.5, ease: "easeOut" }}
               onLoad={() => setBgLoaded(true)}
               src="/images/hero-bg.webp"
               className="w-full h-full object-cover mix-blend-multiply filter grayscale-[20%] object-top"
               alt="Campus Atmosphere"
             />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#EADBD8]/40 to-[#D5C2C4]/20 rounded-full blur-[120px] mix-blend-multiply opacity-50 z-10"></div>
        </div>

        <motion.div 
          style={{ y: yParallax, opacity: opacityParallax }}
          className="z-30 relative text-center flex flex-col items-center max-w-4xl mx-auto w-full"
        >
          {/* Subtle Connection Indicator */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-8 flex items-center justify-center gap-3"
          >
             <span className="h-[1px] w-8 md:w-16 bg-[#8B7355]/40 block"></span>
             <span className="font-serif text-base md:text-lg tracking-[0.3em] text-[#6A5A45] font-medium drop-shadow-sm">于此间，已有 {stats.totalUsers.toLocaleString()} 人加入</span>
             <span className="h-[1px] w-8 md:w-16 bg-[#8B7355]/40 block"></span>
          </motion.div>

          {/* Main Typography - Serif Elegance */}
          <motion.h1 
            initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
            className="font-serif text-[2rem] sm:text-[3.5rem] md:text-[5rem] lg:text-[6rem] leading-[1.15] tracking-[0.04em] sm:tracking-[0.1em] text-[#2C2825] mb-8 text-center whitespace-normal"
          >
            <motion.span className="block" variants={fadeUpVariant}>在诚朴之间</motion.span>
            <motion.span className="block italic text-[#5C3B4E]" variants={fadeUpVariant}>候一场明月相逢</motion.span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }}
            className="font-serif text-base md:text-xl text-[#2C2825]/90 leading-relaxed max-w-[calc(100vw-3rem)] md:max-w-2xl tracking-wide mb-12 drop-shadow-sm text-center"
          >
            褪去浮躁标签，抛弃无效社交。<br className="hidden md:block"/>
            以一纸问卷诉说内心，将余下的机缘，交托于时间与南大的夜风。
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col md:flex-row items-center gap-6"
          >
            <Link 
              to="/login"
              className="relative overflow-hidden group bg-[#6A005F] text-[#F3EFE9] px-12 py-5 rounded-sm font-serif tracking-[0.2em] transition-transform active:scale-95 duration-500 shadow-lg shadow-[#6A005F]/20 hover:shadow-[#6A005F]/40"
            >
              <div className="absolute inset-0 w-full h-full bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
              <span className="relative z-10 flex items-center gap-3">
                寄出信笺
                <MaterialIcon name="east" className="text-sm font-light" />
              </span>
            </Link>
          </motion.div>

          {/* Integrated Elegant Timer */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.8 }}
            className="mt-12 md:mt-20 flex flex-col items-center"
          >
             <span className="text-sm md:text-base text-[#8B7355] font-serif tracking-[0.4em] mb-4 uppercase font-medium drop-shadow-sm">距离下一次锦书揭晓</span>
             <div className="bg-white/40 backdrop-blur-xl px-8 md:px-12 py-4 md:py-6 border border-white/50 rounded-sm shadow-[0_10px_40px_rgba(44,40,37,0.05)] opacity-90 hover:opacity-100 transition-opacity duration-700">
               <Timer targetDayOfWeek={3} targetHour={20} />
               <p className="text-center font-serif text-xs md:text-sm text-[#8B7355] mt-4 tracking-[0.2em] font-medium">每周三 20:00 统一发放</p>
             </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Flowing Stats Ribbon */}
      <section className="py-16 md:py-24 border-y border-[#EADBD8]/40 bg-[#FCFBF8]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } }}
            className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-[#EADBD8]/60"
          >
            <motion.div variants={fadeUpVariant} className="flex flex-col items-center pt-8 md:pt-0">
              <span className="font-serif text-5xl md:text-6xl text-[#2C2825] mb-4">{stats.totalUsers.toLocaleString()}</span>
              <span className="font-sans text-sm tracking-[0.3em] text-[#8B7355]">已参与学子</span>
            </motion.div>
            <motion.div variants={fadeUpVariant} className="flex flex-col items-center pt-8 md:pt-0">
              <span className="font-serif text-5xl md:text-6xl text-[#5C3B4E] mb-4 italic">{stats.surveyCompletionRate}<span className="text-4xl">%</span></span>
              <span className="font-sans text-sm tracking-[0.3em] text-[#8B7355]">深度问卷完成率</span>
            </motion.div>
            <motion.div variants={fadeUpVariant} className="flex flex-col items-center pt-8 md:pt-0">
              <span className="font-serif text-5xl md:text-6xl text-[#2C2825] mb-4">{stats.successfulMatches.toLocaleString()}</span>
              <span className="font-sans text-sm tracking-[0.3em] text-[#8B7355]">次双向奔赴</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 3. The Philosophy (Features / Editorial Layout) */}
      <section className="py-20 md:py-32 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[#EADBD8]/40">
        <div className="flex flex-col lg:flex-row gap-20 items-start">
          <motion.div 
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
            className="lg:w-1/3 lg:sticky lg:top-32"
          >
            <p className="font-serif text-[#8B7355] text-sm tracking-[0.5em] mb-6">WHY NJU MATCH</p>
            <h2 className="font-serif text-4xl md:text-5xl tracking-[0.1em] text-[#2C2825] leading-tight mb-8">
              重建大学时代<br/>的深度联结。
            </h2>
            <p className="text-[#5E5855] leading-loose font-light">
              在快餐式交友的喧嚣外，我们构建了一个只属于南大人的乌托邦。没有无尽的浏览，没有轻率的评判，唯有基于灵魂共振的静默推演。
            </p>
          </motion.div>

          <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 md:gap-y-16">
            {[
              { icon: 'calendar_month', title: '慢速策展', desc: '系统仅在每周三晚 20:00 遣送一份唯一的锦书。剥离高频多巴胺，让每一次相遇都值得被郑重对待。' },
              { icon: 'psychology', title: '宽容且守序的推演', desc: '不苛求选项的绝对完美重合。我们在过滤双方的硬性底线后，通过多维度智能加权，为你寻找能长期相处的同频灵魂。' },
              { icon: 'school', title: '纯粹之境', desc: '严格限定需验证 smail.nju.edu.cn 邮箱方可踏入。在真正的同学圈层里，邂逅你的同行者。' },
              { icon: 'visibility_off', title: '隐匿与保护', desc: '没有公开的主页大厅，你的信息永远不会被随意检索。只有在缘分交汇时，才会向那个 Ta 脱敏显露。' }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: idx * 0.1 }}
                className="group relative"
              >
                <MaterialIcon name={feature.icon} className="text-[32px] text-[#8B7355] mb-6 block opacity-80 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-serif text-2xl text-[#2C2825] mb-4 tracking-wide">{feature.title}</h3>
                <p className="font-sans text-[#5E5855] leading-relaxed font-light text-justify">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Journey (How it works - Horizontal Scroll/Block Style) */}
      <section className="py-20 md:py-32 px-6 overflow-hidden bg-[#F8F7F4]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-24">
             <p className="font-serif text-[#8B7355] text-sm tracking-[0.5em] mb-4">THE JOURNEY</p>
             <h2 className="font-serif text-4xl tracking-[0.1em] text-[#2C2825]">三步，与回声相遇</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-10 md:gap-6 relative">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#EADBD8]/60 hidden md:block -z-10" />

            {[
              { num: '01', title: '诉说内心', img: '/images/step1.jpg', desc: '完成一份能反映你价值观深度的问卷测试。' },
              { num: '02', title: '静候推演', img: '/images/step2.jpg', desc: '交出选择权，让算法在南大星系中寻找最契合的一员。' },
              { num: '03', title: '落笔签收', img: '/images/step3.jpg', desc: '阅读对方的性格侧写报告，决定是否要跨出第一步。' }
            ].map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.15 }}
                className="flex-1 flex flex-col items-center group cursor-default bg-[#FCFBF8] p-8 md:p-10 rounded-sm hover:-translate-y-2 transition-transform duration-500 shadow-sm"
              >
                <span className="font-serif text-6xl md:text-7xl italic text-[#EADBD8] group-hover:text-[#8B7355]/20 transition-colors duration-500 mb-6">{step.num}</span>
                <div className="w-full aspect-[4/3] rounded-sm overflow-hidden mb-8 shadow-sm">
                  <img src={step.img} className="w-full h-full object-cover filter grayscale-[15%] group-hover:scale-105 group-hover:grayscale-0 transition-all duration-700" alt={step.title} />
                </div>
                <h3 className="font-serif text-2xl text-[#2C2825] mb-4">{step.title}</h3>
                <p className="font-sans text-[#5E5855] leading-relaxed font-light text-center px-4 max-w-sm">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5. Personality Test Teaser */}
      <section className="py-20 md:py-24 px-6 border-y border-[#EADBD8]/40 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <motion.div 
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="md:w-1/2"
            >
              <div className="aspect-[4/3] w-full rounded-sm overflow-hidden shadow-sm relative group bg-[#F8F7F4] flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(92,59,78,0.05)_0%,transparent_70%)]"></div>
                <div className="relative z-10 flex flex-wrap gap-4 justify-center p-8 opacity-90 max-w-[80%]">
                  {['🎲 DDL 踩点艺术家', '☕ 续命天使', '📐 性感书呆子', '💡 智性天菜', '🦊 校园活人', '🎨 文艺青年'].map((t, i) => (
                    <motion.span 
                      key={i} 
                      initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className="px-5 py-2.5 bg-white rounded-full text-xs font-serif text-[#6A5A45] shadow-[0_4px_12px_rgba(44,40,37,0.04)] border border-[#EADBD8]/40"
                    >
                      {t}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="md:w-1/2 flex flex-col justify-center text-center md:text-left items-center md:items-start"
            >
              <p className="font-serif text-[#8B7355] text-sm tracking-[0.5em] mb-6 uppercase">Personality Match</p>
              <h2 className="font-serif text-3xl md:text-4xl text-[#2C2825] mb-6 leading-snug tracking-wide">
                寻找你的<span className="italic text-[#5C3B4E] ml-2">南大人格</span>
              </h2>
              <p className="font-sans text-[#5E5855] leading-relaxed font-light mb-10 text-justify max-w-lg">
                即使尚未登录，你也可体验我们专为南大人定制的性格推演。
                通过 26 道直指内心的测试题，探索你在南大星系中的灵魂坐标。测试完毕后，该结果将为你匹配最契合的人格类型。
              </p>
              <Link 
                to="/personality-test"
                className="inline-flex items-center justify-center gap-3 bg-transparent text-[#2C2825] border border-[#2C2825] px-8 py-4 rounded-sm font-serif tracking-[0.1em] hover:bg-[#2C2825] hover:text-[#F3EFE9] transition-colors duration-500 shadow-sm"
              >
                进入测试
                <MaterialIcon name="east" className="text-sm font-light" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. Elegant Minimal FAQ (Accordion) */}
      <section className="py-20 md:py-32 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl text-[#2C2825] tracking-[0.2em]">解惑</h2>
        </div>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <div key={i} className="border-b border-[#EADBD8]/40 overflow-hidden">
              <button 
                onClick={() => setFaqExpanded(faqExpanded === i ? null : i)}
                className="w-full text-left py-6 flex items-center justify-between group"
              >
                <h4 className={`font-serif text-[17px] tracking-widest transition-colors ${faqExpanded === i ? 'text-[#8B7355]' : 'text-[#2C2825] group-hover:text-[#8B7355]'}`}>
                  {item.q}
                </h4>
                <motion.span animate={{ rotate: faqExpanded === i ? 45 : 0 }}>
                  <MaterialIcon name="add" className="text-[#8B7355] font-light" />
                </motion.span>
              </button>
              <AnimatePresence>
                {faqExpanded === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="font-sans text-[#5E5855] leading-loose font-light text-[15px] pb-6 text-justify">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Minimalist Poetic CTA */}
      <section className="pt-16 md:pt-20 pb-32 md:pb-40 px-6 text-center">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.h2 variants={fadeUpVariant} className="font-serif text-3xl md:text-5xl text-[#2C2825] tracking-[0.1em] mb-10 leading-snug">
            愿所有的等待，<br className="md:hidden"/>终不被辜负。
          </motion.h2>
          <motion.div variants={fadeUpVariant}>
            <Link 
              to="/login"
              className="inline-flex items-center justify-center bg-[#6A005F] text-white px-10 py-4 font-serif tracking-[0.2em] text-sm hover:bg-[#4E0046] transition-colors duration-500 rounded-sm shadow-lg shadow-[#6A005F]/20 hover:shadow-[#6A005F]/40"
            >
              缘起于此
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
