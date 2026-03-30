/**
 * Entity field definitions for Excel import.
 * Used to generate templates (headers = label_he / label_en) and mapping dropdowns.
 * internalKey = DB/API field name. No auto-map: user must choose mapping manually.
 */

export type EntityType = "students" | "teachers" | "payments"

export interface EntityFieldDef {
  internalKey: string
  label_he: string
  label_en: string
  required: boolean
  format_hint: string
}

export const ENTITY_FIELDS: Record<EntityType, EntityFieldDef[]> = {
  students: [
    { internalKey: "name", label_he: "שם מלא", label_en: "Full name", required: true, format_hint: "Text" },
    { internalKey: "email", label_he: "אימייל", label_en: "Email", required: false, format_hint: "email@example.com" },
    { internalKey: "phone", label_he: "טלפון", label_en: "Phone", required: false, format_hint: "050-1234567" },
    { internalKey: "idNumber", label_he: "ת.ז.", label_en: "ID number", required: false, format_hint: "9 digits" },
    { internalKey: "birthDate", label_he: "תאריך לידה", label_en: "Birth date", required: false, format_hint: "YYYY-MM-DD or DD/MM/YYYY" },
    { internalKey: "address", label_he: "כתובת", label_en: "Address", required: false, format_hint: "Text" },
    { internalKey: "city", label_he: "עיר", label_en: "City", required: false, format_hint: "Text" },
    { internalKey: "status", label_he: "סטטוס", label_en: "Status", required: false, format_hint: "e.g. מתעניין, רשום" },
    { internalKey: "father", label_he: "שם האב", label_en: "Father name", required: false, format_hint: "Text" },
    { internalKey: "mother", label_he: "שם האם", label_en: "Mother name", required: false, format_hint: "Text" },
    { internalKey: "additionalPhone", label_he: "טלפון נוסף", label_en: "Additional phone", required: false, format_hint: "050-1234567" },
    { internalKey: "healthFund", label_he: "קופת חולים", label_en: "Health fund", required: false, format_hint: "Text" },
    { internalKey: "allergies", label_he: "אלרגיות", label_en: "Allergies", required: false, format_hint: "Text" },
    { internalKey: "totalSessions", label_he: "מס' מפגשים", label_en: "Total sessions", required: false, format_hint: "Number, default 12" },
  ],
  teachers: [
    { internalKey: "name", label_he: "שם מלא", label_en: "Full name", required: true, format_hint: "Text" },
    { internalKey: "email", label_he: "אימייל", label_en: "Email", required: false, format_hint: "email@example.com" },
    { internalKey: "phone", label_he: "טלפון", label_en: "Phone", required: false, format_hint: "050-1234567" },
    { internalKey: "idNumber", label_he: "ת.ז.", label_en: "ID number", required: false, format_hint: "9 digits" },
    { internalKey: "birthDate", label_he: "תאריך לידה", label_en: "Birth date", required: false, format_hint: "YYYY-MM-DD or DD/MM/YYYY" },
    { internalKey: "city", label_he: "עיר", label_en: "City", required: false, format_hint: "Text" },
    { internalKey: "specialty", label_he: "התמחות", label_en: "Specialty", required: false, format_hint: "Text" },
    { internalKey: "status", label_he: "סטטוס", label_en: "Status", required: false, format_hint: "e.g. פעיל" },
    { internalKey: "bio", label_he: "אודות", label_en: "Bio", required: false, format_hint: "Text" },
    { internalKey: "centerHourlyRate", label_he: "שער שעתי מרכז", label_en: "Center hourly rate", required: false, format_hint: "Number (ILS)" },
    { internalKey: "travelRate", label_he: "שער נסיעות", label_en: "Travel rate", required: false, format_hint: "Number (ILS)" },
    { internalKey: "externalCourseRate", label_he: "שער קורס חיצוני", label_en: "External course rate", required: false, format_hint: "Number (ILS)" },
  ],
  payments: [
    { internalKey: "studentIdentifier", label_he: "מזהה תלמיד", label_en: "Student identifier", required: true, format_hint: "ת.ז. / טלפון / אימייל של התלמיד" },
    { internalKey: "amount", label_he: "סכום", label_en: "Amount", required: true, format_hint: "Number, e.g. 350 or 350.50" },
    { internalKey: "paymentDate", label_he: "תאריך תשלום", label_en: "Payment date", required: true, format_hint: "YYYY-MM-DD or DD/MM/YYYY" },
    { internalKey: "paymentType", label_he: "סוג תשלום", label_en: "Payment type", required: false, format_hint: "מזומן / כרטיס / העברה" },
    { internalKey: "description", label_he: "תיאור", label_en: "Description", required: false, format_hint: "Text" },
  ],
}

export function getEntityFields(entity: EntityType, lang: "he" | "en"): EntityFieldDef[] {
  return ENTITY_FIELDS[entity] ?? []
}

export function getRequiredKeys(entity: EntityType): string[] {
  return (ENTITY_FIELDS[entity] ?? []).filter((f) => f.required).map((f) => f.internalKey)
}

export function getFieldLabel(field: EntityFieldDef, lang: "he" | "en"): string {
  return lang === "he" ? field.label_he : field.label_en
}
