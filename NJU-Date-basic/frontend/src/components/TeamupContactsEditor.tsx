import React, { useEffect, useMemo, useState } from 'react';
import { CircleContact, getCircleContacts } from '../api/contacts';
import {
  createEmptyTeamupContactDraft,
  draftFromCircleContact,
  getCircleContactOptions,
  MAX_TEAMUP_CONTACTS,
  TeamupContactDraft,
} from '../modules/teamups/contact';
import TeamupContactPicker from './TeamupContactPicker';

interface TeamupContactsEditorProps {
  drafts: TeamupContactDraft[];
  onChange: (updater: React.SetStateAction<TeamupContactDraft[]>) => void;
  circleId: string;
  label: string;
  gridClassName?: string;
}

export default function TeamupContactsEditor({
  drafts,
  onChange,
  circleId,
  label,
  gridClassName,
}: TeamupContactsEditorProps) {
  const [circleContacts, setCircleContacts] = useState<CircleContact[]>([]);
  const [isLoadingCircleContacts, setIsLoadingCircleContacts] = useState(false);
  const canAdd = drafts.length < MAX_TEAMUP_CONTACTS;
  const circleOptions = useMemo(() => getCircleContactOptions(circleContacts), [circleContacts]);

  useEffect(() => {
    let cancelled = false;
    if (!circleId) {
      setCircleContacts([]);
      return;
    }

    setIsLoadingCircleContacts(true);
    getCircleContacts(circleId)
      .then((res) => {
        if (!cancelled) setCircleContacts(res.contacts || []);
      })
      .catch(() => {
        if (!cancelled) setCircleContacts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCircleContacts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [circleId]);

  const updateDraft = (index: number, updater: React.SetStateAction<TeamupContactDraft>) => {
    onChange((prev) => prev.map((draft, draftIndex) => {
      if (draftIndex !== index) return draft;
      return typeof updater === 'function'
        ? (updater as (current: TeamupContactDraft) => TeamupContactDraft)(draft)
        : updater;
    }));
  };

  const addDraft = () => {
    onChange((prev) => (
      prev.length >= MAX_TEAMUP_CONTACTS ? prev : [...prev, createEmptyTeamupContactDraft()]
    ));
  };

  const updateDraftSource = (index: number, source: 'manual' | 'circle') => {
    updateDraft(index, (draft) => ({
      ...draft,
      source,
      circleContactId: source === 'circle' ? '' : undefined,
      value: source === 'circle' ? '' : draft.value,
    }));
  };

  const useCircleContact = (index: number, key: string) => {
    const option = circleOptions.find((item) => item.key === key);
    if (!option) {
      updateDraft(index, (draft) => ({
        ...draft,
        source: 'circle',
        circleContactId: '',
        value: '',
      }));
      return;
    }
    updateDraft(index, draftFromCircleContact(option));
  };

  const updateManualDraft = (index: number, updater: React.SetStateAction<TeamupContactDraft>) => {
    updateDraft(index, (draft) => {
      const next = typeof updater === 'function'
        ? (updater as (current: TeamupContactDraft) => TeamupContactDraft)(draft)
        : updater;
      return {
        ...next,
        source: 'manual',
        circleContactId: undefined,
      };
    });
  };

  const removeDraft = (index: number) => {
    onChange((prev) => {
      const next = prev.filter((_, draftIndex) => draftIndex !== index);
      return next.length > 0 ? next : [createEmptyTeamupContactDraft()];
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="font-serif text-[#8B7355]">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addDraft}
            disabled={!canAdd}
            className="inline-flex items-center gap-1 rounded-full border border-[#420047]/30 bg-white px-3 py-1.5 text-xs font-serif text-[#420047] transition-colors hover:bg-[#420047]/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            新增
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {drafts.map((draft, index) => (
          <div key={index} className="rounded-lg border border-[#EAE7E1] bg-white/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[11px] font-serif tracking-[0.18em] text-[#8B7355]">
                联系方式 {index + 1}
              </span>
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDraft(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
                  aria-label="删除联系方式"
                  title="删除"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              )}
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <select
                value={draft.source ?? 'manual'}
                onChange={(event) => updateDraftSource(index, event.target.value as 'manual' | 'circle')}
                className="w-full rounded-lg border border-[#EAE7E1] bg-white px-4 py-2.5 font-serif text-sm text-[#2C2825] outline-none focus:border-[#420047]/50"
              >
                <option value="manual">手动填写</option>
                <option value="circle" disabled={circleOptions.length === 0}>从圈内联系方式选择</option>
              </select>

              {(draft.source ?? 'manual') === 'circle' ? (
                <select
                  value={draft.circleContactId ?? ''}
                  onChange={(event) => useCircleContact(index, event.target.value)}
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-4 py-2.5 font-serif text-sm text-[#2C2825] outline-none focus:border-[#420047]/50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={circleOptions.length === 0}
                >
                  <option value="">
                    {isLoadingCircleContacts ? '正在读取圈内联系方式' : '选择圈内联系方式'}
                  </option>
                  {circleOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}：{option.value}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>

            <TeamupContactPicker
              draft={draft}
              onChange={(updater) => updateManualDraft(index, updater)}
              label=""
              gridClassName={gridClassName}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
