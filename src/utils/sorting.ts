import type { Device } from '../types/device.types';

/**
 * Normalizes Hebrew text for reliable matching by removing quotes, dashes and extra whitespace.
 */
function normalizeHebrew(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/["״'׳\-–—_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Tactical platoon order based on battalion standard:
 * 1. חפ"ק מג"ד סמג"ד
 * 2. מפג"ד
 * 3. פתן
 * 4. תאג"ד
 * 5. פלס"ם
 * 6. מחס"ר
 * 7. פלוגה א'
 * 8. פלוגה ג'
 * 9. פלוגה ד'
 * 10. פלוגת צמ"ה
 * 11. מחלקת קשר
 */
export function getPlatoonPriority(platoonName: string | undefined | null): number {
  if (!platoonName) return 9999;
  const norm = normalizeHebrew(platoonName);

  if (norm.includes('ללא שיוך') || norm === 'ללא' || norm === 'אחר') return 9999;

  // 1. חפק מגד סמגד
  if (norm.includes('חפק') || norm.includes('סמגד')) return 10;

  // 2. מפגד
  if (norm.includes('מפגד')) return 20;

  // 3. פתן
  if (norm.includes('פתן')) return 30;

  // 4. תאגד
  if (norm.includes('תאגד')) return 40;

  // 5. פלסם
  if (norm.includes('פלסם')) return 50;

  // 6. מחסר
  if (norm.includes('מחסר')) return 60;

  // 7. פלוגה א
  if (norm.includes('פלוגה א') || norm === 'פלוגה 1' || norm === 'א') return 70;
  if (norm.includes('פלוגה ב') || norm === 'פלוגה 2' || norm === 'ב') return 75;

  // 8. פלוגה ג
  if (norm.includes('פלוגה ג') || norm === 'פלוגה 3' || norm === 'ג') return 80;

  // 9. פלוגה ד
  if (norm.includes('פלוגה ד') || norm === 'פלוגה 4' || norm === 'ד') return 90;
  if (norm.includes('פלוגה ה') || norm === 'פלוגה 5' || norm.includes('מסייעת')) return 95;
  if (norm.includes('פלוגה ו') || norm === 'פלוגה 6' || norm === 'ו') return 96;

  // 10. פלוגת צמה
  if (norm.includes('צמה') || norm.includes('7064')) return 100;

  // 11. מחלקת קשר
  if (norm.includes('מחלקת קשר') || norm.includes('קשר')) return 110;

  return 500;
}

export function comparePlatoons(a: string | undefined | null, b: string | undefined | null): number {
  const pA = getPlatoonPriority(a);
  const pB = getPlatoonPriority(b);
  if (pA !== pB) return pA - pB;
  return (a || '').localeCompare(b || '', 'he');
}

/**
 * Tactical equipment order as defined by battalion command (Noa Kashragit):
 * 1. סלולר צבאי
 * 2. כל המכשירים שקשורים בערכת שקד (ערכת שקד, טל 100, מבן, טאבלט)
 * 3. אולרים (אולר רשתי, אולר פלוס, אולר)
 * 4. 710 (נייד 710, מ.ק 710, 710)
 * 5. מגני מכלול עם מדיה (מגן מכלול, אלעד ירוק, שן בינה, מדיה)
 * 6. נרות לילה
 * 7. שאר הציוד (טל 88, מג"ס, רוייפ, סיאף, צרעה, משיב מיקום, מ"כ, מחשב 55ג...)
 */
export function getEquipmentTypePriority(typeName: string | undefined | null, device?: Device): number {
  if (device?.isKit) return 20;

  if (!typeName) return 9999;
  const norm = normalizeHebrew(typeName);

  if (norm.includes('ללא סוג') || norm === 'אחר') return 9999;

  // 1. סלולר צבאי
  if (norm.includes('סלולר')) return 10;

  // 2. כל המכשירים שקשורים בערכת שקד (ערכת שקד, טל 100, מבן, טאבלט)
  if (norm.includes('שקד')) return 20;
  if (norm.includes('טל 100')) return 21;
  if (norm.includes('מבן')) return 22;
  if (norm.includes('טאבלט')) return 23;

  // 3. אולרים
  if (norm.includes('אולר רשתי')) return 30;
  if (norm.includes('אולר פלוס')) return 31;
  if (norm.includes('אולר')) return 32;

  // 4. מכשירי 710
  if (norm.includes('710')) return 40;

  // 5. מגני מכלול עם מדיה (מגן מכלול, אלעד ירוק, שן בינה, מדיה)
  if (norm.includes('מגן מכלול')) return 50;
  if (norm.includes('אלעד ירוק')) return 51;
  if (norm.includes('שן בינה') || norm.includes('בינה')) return 52;
  if (norm.includes('מדיה')) return 53;

  // 6. נרות לילה
  if (norm.includes('נר לילה') || norm.includes('נרות לילה')) return 60;

  // 7. שאר הציוד
  if (norm.includes('טל 88') || norm.includes('טל')) return 70;
  if (norm.includes('מכ') || norm.includes('מק')) return 72;
  if (norm.includes('מגס')) return 74;
  if (norm.includes('רוייפ')) return 76;
  if (norm.includes('סיאף')) return 78;
  if (norm.includes('55ג') || norm.includes('55')) return 80;
  if (norm.includes('משיב מיקום')) return 82;
  if (norm.includes('צרעה')) return 84;

  return 500;
}

export function compareEquipmentTypes(a: string | undefined | null, b: string | undefined | null): number {
  const pA = getEquipmentTypePriority(a);
  const pB = getEquipmentTypePriority(b);
  if (pA !== pB) return pA - pB;
  return (a || '').localeCompare(b || '', 'he');
}

/**
 * Tactical category grouping for in-app display inside platoons:
 */
export function getEquipmentCategoryGroup(deviceOrType: Device | string | undefined | null): {
  id: string;
  order: number;
  title: string;
  iconName: string;
} {
  const typeName = typeof deviceOrType === 'string' ? deviceOrType : deviceOrType?.type;
  const isKit = typeof deviceOrType === 'object' && (deviceOrType?.isKit || (deviceOrType?.type || '').includes('שקד'));
  
  if (isKit) {
    return { id: 'shaked_kit', order: 20, title: 'ערכות שקד ומרכיביהן', iconName: 'toolbox' };
  }

  const priority = getEquipmentTypePriority(typeName);

  if (priority === 10) {
    return { id: 'cellular', order: 10, title: 'סלולר צבאי', iconName: 'cellphone' };
  }
  if (priority >= 20 && priority < 30) {
    return { id: 'shaked_kit', order: 20, title: 'ערכות שקד ומרכיביהן', iconName: 'toolbox' };
  }
  if (priority >= 30 && priority < 40) {
    return { id: 'pocket_knives', order: 30, title: 'אולרים', iconName: 'radio-handheld' };
  }
  if (priority >= 40 && priority < 50) {
    return { id: 'device_710', order: 40, title: 'מכשירי 710', iconName: 'walkie-talkie' };
  }
  if (priority >= 50 && priority < 60) {
    return { id: 'shields_and_media', order: 50, title: 'מגני מכלול ומדיה', iconName: 'shield-check' };
  }
  if (priority >= 60 && priority < 70) {
    return { id: 'night_candles', order: 60, title: 'נרות לילה', iconName: 'flashlight' };
  }
  return { id: 'other', order: 70, title: 'ציוד נוסף', iconName: 'devices' };
}

/**
 * Compares two devices based on display context:
 * - In 'types' mode (viewing a specific device type): orders by Platoon -> Location -> Tsadi.
 * - In 'platoons' mode (viewing a specific platoon): orders by Tactical Equipment Order -> Location -> Tsadi.
 */
export function compareDevices(a: Device, b: Device, groupBy: 'platoons' | 'types'): number {
  if (groupBy === 'types') {
    const platoonDiff = comparePlatoons(a.assignment, b.assignment);
    if (platoonDiff !== 0) return platoonDiff;
  } else {
    const pA = getEquipmentTypePriority(a.type, a);
    const pB = getEquipmentTypePriority(b.type, b);
    if (pA !== pB) return pA - pB;
    const typeDiff = compareEquipmentTypes(a.type, b.type);
    if (typeDiff !== 0) return typeDiff;
  }

  const locA = a.location?.trim() || '';
  const locB = b.location?.trim() || '';
  if (locA && !locB) return -1;
  if (!locA && locB) return 1;
  const locDiff = locA.localeCompare(locB, 'he');
  if (locDiff !== 0) return locDiff;

  return (a.tsadiNumber || '').localeCompare(b.tsadiNumber || '', undefined, { numeric: true });
}
