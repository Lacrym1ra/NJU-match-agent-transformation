import React from 'react';
import {
  getTeamupContactOption,
  TEAMUP_CONTACT_OPTIONS,
  TeamupContactDraft,
  TeamupContactKind,
} from '../modules/teamups/contact';

interface TeamupContactPickerProps {
  draft: TeamupContactDraft;
  onChange: (updater: React.SetStateAction<TeamupContactDraft>) => void;
  label: string;
  gridClassName?: string;
}

export default function TeamupContactPicker({
  draft,
  onChange,
  label,
  gridClassName = 'grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)] gap-3',
}: TeamupContactPickerProps) {
  return (
    <div>
      {label && <label className="block font-serif text-[#8B7355] mb-2">{label}</label>}

      <div className={gridClassName}>
        <select
          value={draft.kind}
          onChange={e => onChange((prev) => ({ ...prev, kind: e.target.value as TeamupContactKind }))}
          className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-serif"
        >
          {TEAMUP_CONTACT_OPTIONS.map((option) => (
            <option key={option.kind} value={option.kind}>{option.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={draft.value}
          onChange={e => onChange((prev) => ({ ...prev, value: e.target.value }))}
          className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-sans"
          placeholder={getTeamupContactOption(draft.kind).placeholder}
        />
      </div>

      {draft.kind === 'other' && (
        <input
          type="text"
          value={draft.customLabel}
          onChange={e => onChange((prev) => ({ ...prev, customLabel: e.target.value }))}
          className="mt-3 w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-sans"
          placeholder="联系方式名称，例如 Discord / Telegram"
        />
      )}
    </div>
  );
}
