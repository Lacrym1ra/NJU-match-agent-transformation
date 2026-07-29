import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans flex flex-col items-center justify-center px-6">
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'linear-gradient(transparent 47px, rgba(234,231,225,0.6) 48px)',
          backgroundSize: '100% 48px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="relative z-10 text-center max-w-sm w-full">
        <p className="font-sans text-xs tracking-[0.3em] uppercase text-[#8B7355] mb-6">
          NJU Match
        </p>

        <h1 className="font-serif text-7xl md:text-8xl text-[#420047] tracking-widest mb-4 font-light">
          404
        </h1>

        <div className="w-12 h-px bg-[#D4C9B8] mx-auto mb-6" />

        <p className="font-serif text-lg tracking-widest text-[#2C2825] mb-2">
          此页不存在
        </p>
        <p className="font-sans text-sm text-[#8B7355] tracking-wide leading-relaxed mb-10">
          你所寻觅的角落，尚未在这里留下痕迹
        </p>

        <Link
          to="/"
          className="inline-block font-sans text-sm tracking-[0.2em] text-[#420047] border border-[#420047] px-8 py-3 hover:bg-[#420047] hover:text-[#FCFBF8] transition-colors duration-300"
        >
          返回主页
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
