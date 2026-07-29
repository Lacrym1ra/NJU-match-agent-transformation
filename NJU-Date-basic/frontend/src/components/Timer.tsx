import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Timer = ({ targetDayOfWeek = 3, targetHour = 20 }) => {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDayOfWeek, targetHour));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDayOfWeek, targetHour));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDayOfWeek, targetHour]);

  function calculateTimeLeft(targetDay, targetHour) {
    const now = new Date();
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;

    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now.getHours() >= targetHour)) {
      daysUntilTarget += 7;
    }

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    targetDate.setHours(targetHour, 0, 0, 0);

    const difference = targetDate.getTime() - now.getTime();

    if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  const formatNumber = (num) => num.toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-4 md:gap-8 text-[#2C2825] font-serif">
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-5xl font-light tabular-nums tracking-widest">
          {formatNumber(timeLeft.days)}
        </span>
        <span className="text-[10px] text-[#8B7355] uppercase tracking-[0.2em] mt-2 font-sans">Days</span>
      </div>
      <span className="text-2xl font-light text-[#8B7355]/40 pb-4">/</span>
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-5xl font-light tabular-nums tracking-widest">
          {formatNumber(timeLeft.hours)}
        </span>
        <span className="text-[10px] text-[#8B7355] uppercase tracking-[0.2em] mt-2 font-sans">Hours</span>
      </div>
      <span className="text-2xl font-light text-[#8B7355]/40 pb-4">/</span>
      <div className="flex flex-col items-center">
        <span className="text-3xl md:text-5xl font-light tabular-nums tracking-widest">
          {formatNumber(timeLeft.minutes)}
        </span>
        <span className="text-[10px] text-[#8B7355] uppercase tracking-[0.2em] mt-2 font-sans">Mins</span>
      </div>
      <span className="text-2xl font-light text-[#8B7355]/40 pb-4">/</span>
      <div className="flex flex-col items-center">
        <motion.span 
          key={timeLeft.seconds}
          initial={{ opacity: 0.3, filter: 'blur(4px)' }} 
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4 }}
          className="text-3xl md:text-5xl font-light tabular-nums tracking-widest text-[#5C3B4E]"
        >
          {formatNumber(timeLeft.seconds)}
        </motion.span>
        <span className="text-[10px] text-[#8B7355] uppercase tracking-[0.2em] mt-2 font-sans">Secs</span>
      </div>
    </div>
  );
};

export default Timer;
