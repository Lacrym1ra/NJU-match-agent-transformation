import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCard, updateCard, getCardModules, CardModule, PredefinedModule } from '../api/card';
import PublicCardModal from '../components/PublicCardModal';
import { ApiError } from '../api/client';
import MaterialIcon from '../components/MaterialIcon';

export default function CardBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/dashboard';
  const { user } = useAuth();
  const [modules, setModules] = useState<CardModule[]>([]);
  const [availableTypes, setAvailableTypes] = useState<PredefinedModule[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([getCard(), getCardModules()])
      .then(([cardData, predefData]) => {
        setModules(cardData.modules || []);
        setAvailableTypes(predefData.modules || []);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setSaveError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex === dropIndex) return;

    const newModules = [...modules];
    const [draggedItem] = newModules.splice(dragIndex, 1);
    newModules.splice(dropIndex, 0, draggedItem);
    setModules(newModules);
  };

  const handleUpdateModule = (index: number, updates: Partial<CardModule>) => {
    const newModules = [...modules];
    newModules[index] = { ...newModules[index], ...updates };
    setModules(newModules);
  };

  const handleRemoveModule = (index: number) => {
    const newModules = [...modules];
    const moduleToRem = newModules[index];
    const predef = availableTypes.find(t => t.key === moduleToRem.moduleKey);
    // Don't allow removing system modules manually maybe? For now allow it, UI level
    if (predef?.isSystem) {
       setSaveError(`${predef.name} 是基础信息，不可被移除`);
       setTimeout(() => setSaveError(''), 2000);
       return;
    }
    newModules.splice(index, 1);
    setModules(newModules);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveMsg('');
    try {
      // update displayOrders
      const payloadToSave = modules.map((m, i) => ({ ...m, displayOrder: i }));
      await updateCard(payloadToSave);
      setModules(payloadToSave);
      setSaveMsg('名片变更已归档');
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError('保存失败，请重试');
      }
    } finally {
      setSaving(false);
    }
  };

  const getPredefInfo = (key: string) => availableTypes.find(t => t.key === key);

  if (loading) {
    return <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center text-[#8B7355]">载入卷宗中...</div>;
  }

  // Extract avatar initial
  const avatarLetter = user?.nickname ? user.nickname.charAt(0) : (user?.email ? user.email.charAt(0).toUpperCase() : 'N');

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex flex-col items-center md:py-20 px-5 md:px-8 relative overflow-x-hidden selection:bg-[#420047] selection:text-[#FCFBF8]"
      style={{
        backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)',
        backgroundSize: '100% 48px',
      }}
    >
      <header className="w-full max-w-3xl flex justify-between items-center mb-12 md:mb-16 relative z-10 pt-10 md:pt-0">
        <button
          onClick={() => navigate(backTo, { replace: true })}
          className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors group"
        >
          <MaterialIcon name="west" className="text-[18px] group-hover:-translate-x-1 transition-transform" />
          <span className="font-serif tracking-widest text-sm">返回</span>
        </button>
        <div className="font-serif tracking-widest text-lg text-[#2C2825] opacity-50">初见名片编辑</div>
      </header>

      <main className="w-full max-w-3xl flex flex-col gap-10 relative z-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl text-[#2C2825] tracking-widest">排版你的相遇</h1>
          <p className="text-[#8B7355] font-serif text-sm tracking-wide">
            每一张名片，皆是你的一面。选择你愿展露的信息，等待有缘人翻阅。
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {modules.map((mod, index) => {
              const info = getPredefInfo(mod.moduleKey);
              if (!info) return null;
              
              const isContact = info.category === 'contact';
              const isSystem = info.isSystem;

              return (
                <motion.div
                  key={mod.moduleKey}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e as unknown as React.DragEvent, index)}
                  className="flex items-center gap-4 p-4 border border-[#EAE7E1] bg-white rounded-lg shadow-sm group hover:border-[#8B7355]/40 transition-colors"
                >
                  <div className="cursor-grab text-[#8B7355]/30 group-hover:text-[#8B7355]/60 hover:text-[#2C2825] active:cursor-grabbing px-2 py-4 -my-4 -ml-2 transition-colors">
                    <MaterialIcon name="drag_indicator" className="text-[20px]" />
                  </div>
                  
                  <div className="w-24 shrink-0">
                    <span className="font-serif text-[#2C2825] font-medium tracking-wide">{info.name}</span>
                  </div>
                  
                  {isSystem && info.category === 'basic' ? (
                    <div className="flex-1 px-3 py-2 bg-[#F3F1ED]/50 text-[#2C2825] text-sm font-serif border-b border-[#EAE7E1] cursor-not-allowed italic">
                      同步自基础档案 (不可改)
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={mod.value}
                      onChange={(e) => handleUpdateModule(index, { value: e.target.value })}
                      placeholder={info.description || '填写...'}
                      className="flex-1 bg-transparent px-3 py-2 text-[#2C2825] border-b border-[#8B7355]/20 focus:border-[#420047] focus:outline-none transition-colors font-serif placeholder:text-[#8B7355]/30"
                    />
                  )}

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <select
                      value={mod.visibilityLevel}
                      onChange={(e) => handleUpdateModule(index, { visibilityLevel: e.target.value as any })}
                      disabled={isContact}
                      className="bg-transparent text-sm text-[#8B7355] font-serif border-b border-transparent hover:border-[#8B7355]/40 outline-none cursor-pointer focus:text-[#2C2825] disabled:opacity-50 disabled:cursor-not-allowed w-20 text-center pb-1"
                    >
                      <option value="public">公开可见</option>
                      <option value="friends">仅好友</option>
                      <option value="hidden">隐藏</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveModule(index)}
                      className="p-2 text-[#8B7355]/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-0 focus:opacity-100"
                    >
                      <MaterialIcon name="close" className="text-[18px]" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mb-32" />
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 right-4 md:bottom-8 md:right-8 flex flex-col items-end gap-3 z-50">
        {saveError && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-2 rounded-lg shadow-sm">
            {saveError}
          </motion.div>
        )}
        {saveMsg && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-[#FCFBF8] px-4 py-2 border border-[#EAE7E1] shadow-sm text-[#8B7355] text-xs tracking-widest">
            <MaterialIcon name="cloud_done" className="text-[14px]" />
            {saveMsg}
          </motion.div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="bg-[#FCFBF8] text-[#8B7355] border border-[#EAE7E1] px-6 py-3 rounded-[3rem] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm tracking-widest font-medium group"
          >
            <MaterialIcon name="visibility" className="text-sm group-hover:scale-110 transition-transform" />
            预览公开层
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-br from-[#611066] to-[#420047] text-[#FCFBF8] px-8 py-3 rounded-[3rem] shadow-[0_8px_24px_rgba(66,0,71,0.2)] hover:shadow-[0_12px_32px_rgba(66,0,71,0.3)] hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm tracking-widest font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <MaterialIcon name="refresh" className="animate-spin text-sm" /> : <MaterialIcon name="save" className="text-sm" />}
            {saving ? '保存卷宗...' : '保存排版'}
          </button>
        </div>
      </div>

      {showPreview && (
        <PublicCardModal 
          onClose={() => setShowPreview(false)}
          overrideData={{
            nickname: user?.nickname || '未命名',
            avatarLetter: avatarLetter,
            modules: modules.filter(m => m.visibilityLevel === 'public').map(m => {
              const info = getPredefInfo(m.moduleKey);
              return { moduleKey: m.moduleKey, label: info?.name || '', value: m.value };
            }),
            isFriend: false,
            pendingRequest: null
          }}
        />
      )}
    </div>
  );
}
