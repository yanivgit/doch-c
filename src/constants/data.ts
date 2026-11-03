// Shared constant data arrays used across multiple screens and modals.
// Extracted here to avoid duplication and ensure consistency.

export const PLUGOT = [
  'חפק מגד סמגד',
  'מפג״ד',
  'פתן',
  'תאג״ד',
  'פלס״ם',
  'מחס״ר',
  'פלוגה א׳',
  'פלוגה ג׳',
  'פלוגה ד׳',
  'פלוגת צמ״ה',
  'מחלקת קשר',
] as const;

export const PLUGOT_WITH_UNASSIGNED = [
  ...PLUGOT, 'ללא שיוך',
] as const;

export const EQUIPMENT_TYPES = [
  // 1. סלולר צבאי
  'סלולר צבאי',
  // 2. כל המכשירים שקשורים בערכת שקד
  'ערכת שקד', 'טל 100', 'מבן', 'טאבלט',
  // 3. אולרים
  'אולר', 'אולר פלוס', 'אולר רשתי',
  // 4. מכשירי 710
  'נייד 710',
  // 5. מגני מכלול עם מדיה
  'מגן מכלול', 'אלעד ירוק', 'שן בינה', 'מדיה', 'מדיה נתיקה',
  // 6. נרות לילה
  'נר לילה',
  // 7. שאר הציוד
  'טל 88', 'מג״ס', 'רוייפ מחשב ארפיטי', 'מחשב סיאף', 'סיאף',
  'צרעה', 'משיב מיקום', 'מ״כ', 'מחשב 55ג',
] as const;
