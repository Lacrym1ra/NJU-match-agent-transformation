import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#FCFBF8] pt-20 pb-10 px-6 lg:px-20 text-center md:text-left border-t border-[#EADBD8]/40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-center gap-3 mb-2">
            <img src="/icon.svg" alt="Logo" className="w-12 h-12 object-contain shrink-0 filter grayscale-[20%]" />
            <h3 className="font-serif text-2xl tracking-widest text-[#2C2825] mt-1">
              NJU Match
            </h3>
          </div>
          <p className="font-sans text-[#5E5855] text-sm tracking-wide font-light">
            独立部署的课程衍生社交实验。<br/>原有匹配能力与新增 Agent 模块分离演进。
          </p>
        </div>
        
        <div className="flex gap-8 font-sans text-sm tracking-widest text-[#8B7355]">
          <Link to="/about" className="hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300">关于我们</Link>
          <Link to="/changelog" className="hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300">更新日志</Link>
          <Link to="/privacy" className="hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300">隐私协议</Link>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-16 text-center text-xs font-sans font-light tracking-wider text-[#8B7355]/60">
        &copy; {new Date().getFullYear()} NJU Match Course Derivative. Independent data boundary; not officially affiliated with Nanjing University.
      </div>
    </footer>
  );
};

export default Footer;
