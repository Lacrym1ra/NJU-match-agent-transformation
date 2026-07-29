import React, { useState, useEffect } from 'react';
import { X, Eye, Users, EyeOff } from 'lucide-react';
import { 
  CardModule, 
  flattenEditableGroups, 
  buildGroupedPayload,
  RawEditableCardResponse
} from '../api/card';
import { getCircleDetail, Question } from '../api/circles';
import { api } from '../api/client';

type EditableCircleModule = CardModule & {
  promptOptions?: string[];
  inputType?: Question['type'];
};

function formatModuleValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(' / ');
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function mergeSuggestedValue(currentValue: unknown, suggestion: string): string {
  const current = formatModuleValue(currentValue).trim();
  if (!current) return suggestion;

  const tokens = current
    .split(/[\/,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (tokens.includes(suggestion)) {
    return current;
  }

  return `${current} / ${suggestion}`;
}

export default function CircleCardOverrideModal({
  circleId,
  circleName = '圈子',
  isOpen = true,
  onClose,
  onSuccess
}: {
  // 直接在这里内联声明类型，绝不额外创造或修改类名/接口名
  circleId: string;
  circleName?: string;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [modules, setModules] = useState<EditableCircleModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError('');
    setModules([]);
    Promise.all([
      api.get<RawEditableCardResponse>(`/card/circle/${circleId}/me`),
      getCircleDetail(circleId),
    ])
      .then(([data, detail]) => {
        const circleGroups = data.card?.circle || { public: [], hidden: [], deleted: [] };
        const flatModules = flattenEditableGroups(circleGroups, true);
        const componentMap = new Map((detail.components ?? []).map((component) => [component.key, component]));

        setModules(flatModules.map((module) => {
          const component = componentMap.get(module.moduleKey);
          return {
            ...module,
            name: component?.prompt || module.name,
            promptOptions: Array.isArray(component?.options) ? component.options.map(String) : undefined,
            inputType: component?.type,
          };
        }));
      })
      .catch((err: any) => {
        setError(err.message || '加载名片失败');
      })
      .finally(() => setLoading(false));
  }, [circleId, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = buildGroupedPayload(modules);
      await api.put(`/card/circle/${circleId}/me`, payload);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const updateModule = (index: number, updates: Partial<EditableCircleModule>) => {
    const next = [...modules];
    next[index] = { ...next[index], ...updates };
    setModules(next);
  };

  const applySuggestion = (index: number, suggestion: string) => {
    const nextValue = mergeSuggestedValue(modules[index]?.value, suggestion);
    updateModule(index, { value: nextValue });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm transition-all duration-200 p-4">
      <div className="relative flex w-full max-w-lg max-h-[90vh] min-h-[420px] flex-col overflow-hidden rounded-xl bg-[#FCFBF8] shadow-xl">
        
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#8B7355]/10 bg-white">
          <h2 className="text-lg font-serif text-[#2C2825] tracking-wide">编辑 {circleName} 同好名片</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 text-[#8B7355] hover:text-[#420047] transition-colors rounded-full hover:bg-[#F3F1ED]"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
    
        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          
          <p className="text-sm text-[#8B7355] leading-relaxed">
            在这里完善你在该圈子的展示信息。你可以控制每一项是完全公开、仅对互相结识的好友展示，或是暂不展示。
          </p>
    
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-lg border border-[#8B7355]/10 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="h-4 w-24 rounded bg-[#F3F1ED]" />
                    <div className="h-8 w-40 rounded-md bg-[#F3F1ED]" />
                  </div>
                  <div className="h-10 rounded-md bg-[#FCFBF8] border border-[#8B7355]/10" />
                </div>
              ))}
              <div className="flex items-center justify-center gap-2 pt-2 text-sm text-[#8B7355]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#420047] border-t-transparent" />
                正在展开这张圈内名片...
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((mod, index) => (
                <div 
                  key={mod.moduleKey} 
                  className={`flex flex-col space-y-3 p-4 bg-white rounded-lg shadow-sm transition-all duration-300 border ${
                    mod.visibilityLevel === 'hidden' ? 'border-transparent opacity-75' : 'border-[#8B7355]/10 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-[#2C2825] tracking-wide">
                      {mod.name || mod.moduleKey}
                    </label>
                    
                    {/* 状态选择器 */}
                    <div className="flex items-center bg-[#F3F1ED] rounded-md p-1">
                      <button
                        onClick={() => updateModule(index, { visibilityLevel: 'public' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all duration-300 ${
                          mod.visibilityLevel === 'public' 
                            ? 'bg-[#420047] text-white shadow-sm' 
                            : 'text-[#8B7355] hover:text-[#2C2825] hover:bg-black/5'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" /> 公开
                      </button>
                      <button
                        onClick={() => updateModule(index, { visibilityLevel: 'friends' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all duration-300 ${
                          mod.visibilityLevel === 'friends' 
                            ? 'bg-[#8B7355] text-white shadow-sm' 
                            : 'text-[#8B7355] hover:text-[#2C2825] hover:bg-black/5'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" /> 好友可见
                      </button>
                      <button
                        onClick={() => updateModule(index, { visibilityLevel: 'hidden' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all duration-300 ${
                          mod.visibilityLevel === 'hidden' 
                            ? 'bg-[#2C2825] text-white shadow-sm' 
                            : 'text-[#8B7355] hover:text-[#2C2825] hover:bg-black/5'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" /> 隐藏
                      </button>
                    </div>
                  </div>
                  
                  {mod.visibilityLevel !== 'hidden' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formatModuleValue(mod.value)}
                        onChange={(e) => updateModule(index, { value: e.target.value })}
                        placeholder={`请输入${mod.name || mod.moduleKey}...`}
                        className="w-full px-3 py-2.5 text-sm bg-[#FCFBF8] border border-[#8B7355]/20 rounded-md text-[#2C2825] placeholder:text-[#8B7355]/50 outline-none focus:border-[#420047] focus:ring-1 focus:ring-[#420047] transition-all"
                      />
                      {mod.promptOptions && mod.promptOptions.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-[#8B7355]/70">
                            参考选项：点一下可快速带入，你也可以完全自由填写。
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {mod.promptOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => applySuggestion(index, option)}
                                className="rounded-full border border-[#8B7355]/20 bg-[#F8F4EE] px-3 py-1.5 text-xs text-[#6E5E52] transition-colors hover:border-[#420047]/30 hover:text-[#420047]"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 text-sm text-[#8B7355]/60 bg-[#FCFBF8] border border-transparent rounded-md italic">
                      此字段当前已隐藏，不会在你的名片上展示。
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    
        {/* 底栏 */}
        <div className="px-6 py-5 border-t border-[#8B7355]/10 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-[#8B7355] hover:text-[#2C2825] transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2.5 text-sm font-medium text-white bg-[#420047] rounded-md hover:bg-[#5c0063] transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? '正在保存...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
