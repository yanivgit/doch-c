// Shared constant data arrays used across multiple screens and modals.
// Extracted here to avoid duplication and ensure consistency.

export const PLUGOT = [
  'חפק מגד וסמגד', 'מפג״ד', 'פלס״ם', 'תאג״ד',
  'פלוגה א׳', 'פלוגה ב׳', 'פלוגה ג׳', 'פלוגה ד׳',
  'צמ״ה 7064', 'מחלקת קשר',
] as const;

export const PLUGOT_WITH_UNASSIGNED = [
  ...PLUGOT, 'ללא שיוך',
] as const;

export const EQUIPMENT_TYPES = [
  'סלולר צבאי', 'נייד 710', 'אולר', 'אולר פלוס', 'אולר רשתי',
  'נר לילה', 'טאבלט', 'טל 100', 'טל 88', 'מג״ס',
  'רוייפ מחשב ארפיטי', 'מחשב סיאף', 'סיאף', 'מבן', 'מגן מכלול',
  'מדיה נתיקה', 'אלעד ירוק', 'צרעה', 'משיב מיקום', 'מ״כ', 'מחשב 55ג',
] as const;
