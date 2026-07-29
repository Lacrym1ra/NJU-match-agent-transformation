import type { CircleContact, CircleContactInput } from '../../api/contacts';

export type CircleContactLike = Pick<CircleContact, 'fieldKey' | 'label' | 'value'>;

export type EditableCircleContact = {
  localId: string;
  id?: string;
  fieldKey: string;
  label: string;
  value: string;
  isEnabled: boolean;
  displayOrder: number;
};

function normalizeContactPart(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getCircleContactDisplayKey(contact: CircleContactLike) {
  const label = normalizeContactPart(contact.label || contact.fieldKey);
  const value = normalizeContactPart(contact.value);
  return `${label}:${value}`;
}

export function uniqueCircleContacts<T extends CircleContactLike>(contacts: T[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = getCircleContactDisplayKey(contact);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortCircleContacts<T extends Pick<CircleContact, 'displayOrder' | 'createdAt'>>(contacts: T[]) {
  return [...contacts].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));
}

export function createCircleContactIdFragment(seed?: string) {
  if (seed) {
    return seed.replace(/[^A-Za-z0-9]/g, '') || 'contact';
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9]/g, '');
}

export function createCustomCircleContactFieldKey(fragment = createCircleContactIdFragment()) {
  return `contact_custom_${fragment.slice(0, 40)}`;
}

export function toEditableCircleContact(contact: CircleContact): EditableCircleContact {
  return {
    localId: contact.id,
    id: contact.id,
    fieldKey: contact.fieldKey,
    label: contact.label,
    value: contact.value,
    isEnabled: contact.isEnabled,
    displayOrder: contact.displayOrder,
  };
}

export function createEmptyCircleContact(displayOrder: number, idFragment = createCircleContactIdFragment()): EditableCircleContact {
  return {
    localId: `local_${idFragment}`,
    fieldKey: createCustomCircleContactFieldKey(idFragment),
    label: '',
    value: '',
    isEnabled: true,
    displayOrder,
  };
}

export function validateCircleContactDrafts(drafts: CircleContactLike[]) {
  const invalidContact = drafts.find((contact) => !contact.label.trim() || !contact.value.trim());
  if (invalidContact) {
    return { valid: false, message: '方式和具体信息都不能为空' };
  }

  const seenContactKeys = new Set<string>();
  const duplicatedContact = drafts.find((contact) => {
    const key = getCircleContactDisplayKey(contact);
    if (seenContactKeys.has(key)) return true;
    seenContactKeys.add(key);
    return false;
  });

  if (duplicatedContact) {
    return { valid: false, message: '同一种圈内联系方式只需要保留一条' };
  }

  return { valid: true, message: '' };
}

export function buildCircleContactInput(contact: EditableCircleContact, displayOrder: number): CircleContactInput {
  return {
    fieldKey: contact.fieldKey || createCustomCircleContactFieldKey(),
    label: contact.label.trim(),
    value: contact.value.trim(),
    isEnabled: true,
    displayOrder,
  };
}
