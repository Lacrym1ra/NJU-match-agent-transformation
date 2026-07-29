import React, { useEffect, useState } from 'react';
import {
  CircleContact,
  deleteCircleContact,
  getCircleContacts,
  updateCircleContact,
  upsertCircleContact,
} from '../api/contacts';
import {
  EditableCircleContact,
  buildCircleContactInput,
  createEmptyCircleContact,
  sortCircleContacts,
  toEditableCircleContact,
  uniqueCircleContacts,
  validateCircleContactDrafts,
} from '../modules/contacts/circleContacts';
import MaterialIcon from './MaterialIcon';
import { toast } from './Toast';

interface CircleContactsSettingsModalProps {
  circleId: string;
  circleName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CircleContactsSettingsModal({
  circleId,
  circleName,
  isOpen,
  onClose,
}: CircleContactsSettingsModalProps) {
  const [contacts, setContacts] = useState<CircleContact[]>([]);
  const [draftContacts, setDraftContacts] = useState<EditableCircleContact[]>([]);
  const [deletedContactIds, setDeletedContactIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadContacts = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getCircleContacts(circleId);
        if (!cancelled) {
          const nextContacts = sortCircleContacts(res.contacts || []);
          setContacts(nextContacts);
          setDraftContacts(nextContacts.map(toEditableCircleContact));
          setDeletedContactIds([]);
          setIsEditing(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || '加载圈内联系方式失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, [circleId, isOpen]);

  const resetDraftFromContacts = () => {
    setDraftContacts(contacts.map(toEditableCircleContact));
    setDeletedContactIds([]);
    setError('');
  };

  const startEditing = () => {
    resetDraftFromContacts();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    resetDraftFromContacts();
    setIsEditing(false);
  };

  const addContact = () => {
    setDraftContacts((prev) => [...prev, createEmptyCircleContact(prev.length)]);
  };

  const updateDraftContact = (localId: string, updates: Partial<EditableCircleContact>) => {
    setDraftContacts((prev) =>
      prev.map((contact) => (contact.localId === localId ? { ...contact, ...updates } : contact)),
    );
  };

  const removeDraftContact = (contact: EditableCircleContact) => {
    if (contact.id) {
      setDeletedContactIds((prev) => (prev.includes(contact.id!) ? prev : [...prev, contact.id!]));
    }
    setDraftContacts((prev) => prev.filter((item) => item.localId !== contact.localId));
  };

  const handleSave = async () => {
    const validation = validateCircleContactDrafts(draftContacts);
    if (!validation.valid) {
      setError(validation.message);
      toast.warning(validation.message);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await Promise.all(deletedContactIds.map((contactId) => deleteCircleContact(circleId, contactId)));

      const savedContacts: CircleContact[] = [];
      for (const [index, contact] of draftContacts.entries()) {
        const payload = buildCircleContactInput(contact, index);
        const res = contact.id
          ? await updateCircleContact(circleId, contact.id, payload)
          : await upsertCircleContact(circleId, payload);
        savedContacts.push(res.contact);
      }

      const nextContacts = sortCircleContacts(savedContacts);
      setContacts(nextContacts);
      setDraftContacts(nextContacts.map(toEditableCircleContact));
      setDeletedContactIds([]);
      setIsEditing(false);
      toast.success('圈内联系方式已保存');
    } catch (err: any) {
      setError(err.message || '保存圈内联系方式失败');
      toast.error(err.message || '保存圈内联系方式失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const closeModal = () => {
    if (saving) return;
    onClose();
  };
  const visibleContacts = uniqueCircleContacts(contacts);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm transition-all duration-200">
      <div className="relative flex max-h-[90vh] min-h-[420px] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#FCFBF8] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#8B7355]/10 bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-serif uppercase tracking-[0.25em] text-[#8B7355]">{circleName}</p>
            <h2 className="mt-1 text-lg font-serif tracking-wide text-[#2C2825]">
              {isEditing ? '编辑圈内联系方式' : '圈内联系方式'}
            </h2>
          </div>
          <button
            onClick={closeModal}
            className="rounded-full p-1.5 text-[#8B7355] transition-colors hover:bg-[#F3F1ED] hover:text-[#420047] disabled:opacity-50"
            disabled={saving}
            aria-label="关闭"
          >
            <MaterialIcon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[0, 1].map((index) => (
                <div key={index} className="rounded-lg border border-[#8B7355]/10 bg-white p-4 shadow-sm">
                  <div className="mb-3 h-4 w-20 rounded bg-[#F3F1ED]" />
                  <div className="h-10 rounded-md border border-[#8B7355]/10 bg-[#FCFBF8]" />
                </div>
              ))}
              <div className="flex items-center justify-center gap-2 pt-2 text-sm text-[#8B7355]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#420047] border-t-transparent" />
                正在展开圈内联系方式...
              </div>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#8B7355]">每一栏都需要填写方式和具体信息。</p>
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#420047]/20 bg-[#420047]/5 text-[#420047] transition-colors hover:bg-[#420047] hover:text-white"
                  aria-label="新增联系方式"
                >
                  <MaterialIcon name="add" className="text-[20px]" />
                </button>
              </div>

              {draftContacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#8B7355]/30 bg-white px-4 py-8 text-center text-sm font-serif italic text-[#8B7355]/70">
                  暂无联系方式，点右上角加号新增一栏。
                </div>
              ) : (
                draftContacts.map((contact, index) => (
                  <div
                    key={contact.localId}
                    className="rounded-lg border border-[#8B7355]/10 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-serif tracking-[0.22em] text-[#8B7355]">
                        联系方式 {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDraftContact(contact)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-serif tracking-widest text-[#B94A48] transition-colors hover:bg-[#B94A48]/6"
                      >
                        <MaterialIcon name="delete" className="text-[15px]" />
                        删除
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[150px_1fr]">
                      <label className="flex flex-col gap-1 text-[12px] font-serif tracking-widest text-[#8B7355]">
                        方式
                        <input
                          value={contact.label}
                          onChange={(event) => updateDraftContact(contact.localId, { label: event.target.value })}
                          maxLength={30}
                          placeholder="如 微信 / QQ / 邮箱"
                          className="h-10 rounded-md border border-[#8B7355]/20 bg-[#FCFBF8] px-3 text-sm tracking-normal text-[#2C2825] outline-none transition-all placeholder:text-[#8B7355]/50 focus:border-[#420047] focus:ring-1 focus:ring-[#420047]"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[12px] font-serif tracking-widest text-[#8B7355]">
                        具体信息
                        <input
                          value={contact.value}
                          onChange={(event) => updateDraftContact(contact.localId, { value: event.target.value })}
                          maxLength={120}
                          placeholder="填写账号、号码或地址"
                          className="h-10 rounded-md border border-[#8B7355]/20 bg-[#FCFBF8] px-3 text-sm tracking-normal text-[#2C2825] outline-none transition-all placeholder:text-[#8B7355]/50 focus:border-[#420047] focus:ring-1 focus:ring-[#420047]"
                        />
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : visibleContacts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#8B7355]/30 bg-white px-4 py-10 text-center text-sm font-serif italic text-[#8B7355]/70">
              还没有圈内联系方式
            </div>
          ) : (
            <div className="space-y-4">
              {visibleContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#8B7355]/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium tracking-wide text-[#2C2825]">{contact.label}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-serif tracking-widest ${
                      contact.isEnabled
                        ? 'border-[#420047]/20 bg-[#420047]/5 text-[#420047]'
                        : 'border-[#8B7355]/20 bg-[#F3F1ED] text-[#8B7355]/70'
                    }`}>
                      {contact.isEnabled ? '可开放' : '已停用'}
                    </span>
                  </div>
                  <p className="break-all text-sm text-[#5a544e]">{contact.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#8B7355]/10 bg-white px-6 py-5">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-[#8B7355] transition-colors hover:text-[#2C2825] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || loading}
                className="rounded-md bg-[#420047] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#5c0063] disabled:opacity-50"
              >
                {saving ? '正在保存...' : '保存修改'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-sm font-medium text-[#8B7355] transition-colors hover:text-[#2C2825]"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={startEditing}
                disabled={loading}
                className="rounded-md bg-[#420047] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#5c0063] disabled:opacity-50"
              >
                编辑
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
