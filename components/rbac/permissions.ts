import {
  BookOpen,
  GraduationCap,
  Users,
  School,
  Rocket,
  FileText,
  DollarSign,
  Calendar,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react"

export type Permission = {
  id: string
  name: string
  description: string
}

export type PermissionCategory = {
  id: string
  name: string
  icon: LucideIcon
  color: string
  permissions: Permission[]
}

export const permissionCategories: PermissionCategory[] = [
  {
    id: "courses",
    name: "קורסים",
    icon: BookOpen,
    color: "bg-blue-50 border-blue-200",
    permissions: [
      { id: "courses-view", name: "צפייה בקורסים", description: "צפייה ברשימת קורסים" },
      { id: "courses-edit", name: "עריכת קורסים", description: "יצירה ועריכת קורסים" },
      { id: "courses-delete", name: "מחיקת קורסים", description: "מחיקת קורסים" },
    ],
  },
  {
    id: "students",
    name: "תלמידים",
    icon: GraduationCap,
    color: "bg-purple-50 border-purple-200",
    permissions: [
      { id: "students-view", name: "צפייה בתלמידים", description: "צפייה ברשימת תלמידים" },
      { id: "students-edit", name: "עריכת תלמידים", description: "יצירה ועריכת תלמידים" },
      { id: "students-delete", name: "מחיקת תלמידים", description: "מחיקת תלמידים" },
    ],
  },
  {
    id: "teachers",
    name: "מורים",
    icon: Users,
    color: "bg-green-50 border-green-200",
    permissions: [
      { id: "teachers-view", name: "צפייה במורים", description: "צפייה ברשימת מורים" },
      { id: "teachers-edit", name: "עריכת מורים", description: "יצירה ועריכת מורים" },
      { id: "teachers-delete", name: "מחיקת מורים", description: "מחיקת מורים" },
    ],
  },
  {
    id: "schools",
    name: "בתי ספר",
    icon: School,
    color: "bg-orange-50 border-orange-200",
    permissions: [
      { id: "schools-view", name: "צפייה בבתי ספר", description: "צפייה ברשימת בתי ספר" },
      { id: "schools-edit", name: "עריכת בתי ספר", description: "יצירה ועריכת בתי ספר" },
      { id: "schools-delete", name: "מחיקת בתי ספר", description: "מחיקת בתי ספר" },
    ],
  },
  {
    id: "gafan",
    name: 'תוכניות גפ"ן',
    icon: Rocket,
    color: "bg-pink-50 border-pink-200",
    permissions: [
      { id: "gafan-view", name: 'צפייה בתוכניות גפ"ן', description: 'צפייה ברשימת תוכניות גפ"ן' },
      { id: "gafan-edit", name: 'עריכת תוכניות גפ"ן', description: 'יצירה ועריכת תוכניות גפ"ן' },
      { id: "gafan-delete", name: 'מחיקת תוכניות גפ"ן', description: 'מחיקת תוכניות גפ"ן' },
    ],
  },
  {
    id: "registration",
    name: "רישום",
    icon: FileText,
    color: "bg-cyan-50 border-cyan-200",
    permissions: [
      { id: "registration-view", name: "צפייה ברישומים", description: "צפייה ברשימת רישומים" },
      { id: "registration-send", name: "שליחת טופס רישום", description: "שליחת טפסי רישום" },
    ],
  },
  {
    id: "cashier",
    name: "קופה",
    icon: DollarSign,
    color: "bg-emerald-50 border-emerald-200",
    permissions: [
      { id: "cashier-view", name: "צפייה בקופה", description: "צפייה בהכנסות והוצאות" },
      { id: "cashier-income", name: "הוספת הכנסה", description: "רישום הכנסות" },
      { id: "cashier-expense", name: "הוספת הוצאה", description: "רישום הוצאות" },
      { id: "cashier-delete", name: "מחיקת תנועות", description: "מחיקת הכנסות והוצאות" },
    ],
  },
  {
    id: "reports",
    name: "דוחות",
    icon: FileText,
    color: "bg-amber-50 border-amber-200",
    permissions: [
      { id: "reports-view", name: "צפייה בדוחות", description: "צפייה בדוחות" },
      { id: "reports-export", name: "ייצוא דוחות", description: "ייצוא דוחות לקבצים" },
    ],
  },
  {
    id: "attendance",
    name: "נוכחות",
    icon: Calendar,
    color: "bg-indigo-50 border-indigo-200",
    permissions: [
      { id: "attendance-view", name: "צפייה בנוכחות", description: "צפייה בנוכחות" },
      { id: "attendance-edit", name: "עריכת נוכחות", description: "עדכון נוכחות תלמידים ומורים" },
    ],
  },
  {
    id: "schedule",
    name: "לוח זמנים",
    icon: Calendar,
    color: "bg-teal-50 border-teal-200",
    permissions: [
      { id: "schedule-view", name: "צפייה בלוח זמנים", description: "צפייה בלוח הזמנים" },
      { id: "schedule-edit", name: "עריכת לוח זמנים", description: "עדכון לוח הזמנים" },
    ],
  },
  {
    id: "users",
    name: "משתמשים",
    icon: Users,
    color: "bg-violet-50 border-violet-200",
    permissions: [
      { id: "users-view", name: "צפייה במשתמשים", description: "צפייה ברשימת משתמשים" },
      { id: "users-edit", name: "עריכת משתמשים", description: "יצירה ועריכת משתמשים" },
      { id: "users-disable", name: "השבת/הפעל משתמשים", description: "השבתה/הפעלה (לא מחיקה)" },
    ],
  },
  {
    id: "settings",
    name: "הגדרות",
    icon: SettingsIcon,
    color: "bg-slate-50 border-slate-200",
    permissions: [
      { id: "dashboard", name: "דף הבית", description: "גישה לדף הבית" },
      { id: "settings-view", name: "צפייה בהגדרות", description: "צפייה בהגדרות המערכת" },
      { id: "settings-edit", name: "עריכת הגדרות", description: "עדכון הגדרות המערכת" },
    ],
  },
]

export const allPermissions = permissionCategories.flatMap((c) => c.permissions)
