"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  UserPlus,
  Edit,
  Trash2,
  Power,
  Lock,
  BookOpen,
  GraduationCap,
  School,
  User as UserIcon,
  FileText,
  Rocket,
  BarChart,
  DollarSign,
  Calendar,
  ClipboardCheck,
  Settings,
  Users,
  Tent,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  PERMISSION_CATEGORIES,
  type PermissionCategory,
  ROLE_PRESETS,
  type RoleType,
  getRoleById,
  getAllKaytanaCampPermissionIds,
  getKaytanaCampViewEditPermissionIds,
  getAllSchoolTabPermissionIds,
} from "@/lib/permissions"
import { PageHeader } from "@/components/page-header"
import { useLanguage } from "@/lib/i18n/context"

type User = {
  id: string
  name: string
  username?: string
  email: string
  phone?: string | null
  status: "active" | "disabled"
  role?: RoleType
  permissions?: string[]
  createdAt: string
}

const categoryIcons: Record<string, any> = {
  courses: BookOpen,
  students: GraduationCap,
  schools: School,
  teachers: UserIcon,
  registration: FileText,
  gafan: Rocket,
  reports: BarChart,
  cashier: DollarSign,
  schedule: Calendar,
  attendance: ClipboardCheck,
  settings: Settings,
  users: Users,
  myProfile: UserIcon,
  kaytana: Tent,
}

const colorClasses: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200",
  pink: "bg-pink-50 border-pink-200",
  orange: "bg-orange-50 border-orange-200",
  green: "bg-green-50 border-green-200",
  cyan: "bg-cyan-50 border-cyan-200",
  rose: "bg-rose-50 border-rose-200",
  yellow: "bg-yellow-50 border-yellow-200",
  emerald: "bg-emerald-50 border-emerald-200",
  sky: "bg-sky-50 border-sky-200",
  purple: "bg-purple-50 border-purple-200",
  slate: "bg-slate-50 border-slate-200",
  indigo: "bg-indigo-50 border-indigo-200",
  violet: "bg-violet-50 border-violet-200",
  teal: "bg-teal-50 border-teal-200",
}

type QuickAction = "view" | "edit" | "delete"

type QuickPermissionRow = {
  id: string
  label: string
  view?: string[]
  edit?: string[]
  delete?: string[]
}

const QUICK_PERMISSION_ROWS: QuickPermissionRow[] = [
  { id: "courses", label: "קורסים", view: ["nav.courses", "courses.view"], edit: ["courses.edit"], delete: ["courses.delete"] },
  { id: "students", label: "תלמידים", view: ["nav.students", "students.view"], edit: ["students.edit"], delete: ["students.delete"] },
  { id: "schools", label: "בתי ספר", view: ["nav.schools", "schools.view"], edit: ["schools.edit"], delete: ["schools.delete"] },
  { id: "teachers", label: "מורים", view: ["nav.teachers", "teachers.view"], edit: ["teachers.edit"], delete: ["teachers.delete"] },
  { id: "registration", label: "רישום", view: ["nav.registration", "registration.view"], edit: ["registration.send"] },
  { id: "gafan", label: "גפ\"ן", view: ["nav.gafan", "gafan.view"], edit: ["gafan.edit"], delete: ["gafan.delete"] },
  { id: "users", label: "משתמשים", view: ["nav.users", "users.view"], edit: ["users.edit"], delete: ["users.delete"] },
  { id: "cashier", label: "קופה", view: ["nav.cashier", "cashier.view"], edit: ["cashier.income", "cashier.expense"], delete: ["cashier.delete"] },
  { id: "reports", label: "דוחות", view: ["nav.reports", "reports.view"], edit: ["reports.export"] },
  { id: "attendance", label: "נוכחות", view: ["nav.attendance", "attendance.view"], edit: ["attendance.edit"], delete: ["attendance.teacher.delete"] },
  { id: "schedule", label: "לוח זמנים", view: ["nav.schedule", "schedule.view"], edit: ["schedule.edit"] },
  { id: "settings", label: "הגדרות", view: ["nav.settings", "settings.view"], edit: ["settings.edit"] },
]

export default function UsersPage() {
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<"__all__" | "active" | "disabled">("__all__")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [pendingAction, setPendingAction] = useState<{ type: "edit" | "toggle" | "delete"; user: User } | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
  })

  const [selectedRole, setSelectedRole] = useState<RoleType>("other")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [initialPermissions, setInitialPermissions] = useState<string[]>([])
  const selectedPermissionsRef = useRef<string[]>([])
  useEffect(() => {
    selectedPermissionsRef.current = selectedPermissions
  }, [selectedPermissions])

  // פונקציה לשינוי תפקיד ומילוי הרשאות אוטומטי — רק כשעוברים לתפקיד *אחר*, כדי לא לדרוס שינויים ידניים בצ'קבוקסים
  const handleRoleChange = (roleId: RoleType) => {
    if (roleId === selectedRole) return
    setSelectedRole(roleId)
    const role = getRoleById(roleId)
    if (role) {
      setSelectedPermissions([...role.permissions])
    }
  }

  const isAdminUser = (u: User) => u.email === "admin@test.com"

  const [noPermission, setNoPermission] = useState(false)

  async function loadUsers() {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (statusFilter !== "__all__") params.set("status", statusFilter)

    const res = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" })
    if (res.status === 403) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (data?.error === "TENANT_MISMATCH") {
        window.location.href = "/login?reason=tenant_mismatch"
        return
      }
      setNoPermission(true)
      setUsers([])
      return
    }
    if (!res.ok) throw new Error("Failed to load users")
    const data = (await res.json()) as User[]
    setUsers(data)
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        await loadUsers()
      } catch (e) {
        console.error(e)
        alert(t("errors.loadUsers"))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      loadUsers().catch((e) => console.error(e))
    }, 350)
    return () => clearTimeout(t)
  }, [q, statusFilter])

  function resetForm() {
    setFormData({ name: "", email: "", phone: "", username: "", password: "" })
    setSelectedRole("other")
    setSelectedPermissions([])
    setInitialPermissions([])
    setEditingUser(null)
  }

  function openCreate() {
    resetForm()
    setInitialPermissions([])
    setIsDialogOpen(true)
  }

  async function openEdit(user: User & { username?: string }) {
    setEditingUser(user)
    setFormData({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      username: user.username ?? "",
      password: "",
    })
    const role = (user.role as RoleType) || "other"
    setSelectedRole(role)
    const dbPerms = Array.isArray(user.permissions) ? user.permissions : []
    if (dbPerms.length > 0) {
      setSelectedPermissions(dbPerms)
      setInitialPermissions(dbPerms)
    } else {
      const preset = getRoleById(role)
      const rolePerms = preset ? [...preset.permissions] : []
      setSelectedPermissions(rolePerms)
      setInitialPermissions(rolePerms)
    }
    setIsDialogOpen(true)
    if (user.id) {
      try {
        const res = await fetch(`/api/users/${user.id}`, { cache: "no-store" })
        if (res.ok) {
          const data = (await res.json()) as User & { permissions?: string[]; role?: string }
          setFormData({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            username: data.username ?? "",
            password: "",
          })
          const freshRole = (data.role as RoleType) || "other"
          setSelectedRole(freshRole)
          const freshPerms = Array.isArray(data.permissions) ? data.permissions : []
          if (freshPerms.length > 0) {
            setSelectedPermissions(freshPerms)
            setInitialPermissions(freshPerms)
          } else {
            const preset = getRoleById(freshRole)
            const rolePerms = preset ? [...preset.permissions] : []
            setSelectedPermissions(rolePerms)
            setInitialPermissions(rolePerms)
          }
          setEditingUser(data)
        }
      } catch (_) {}
    }
  }

  async function createUser() {
    const name = formData.name.trim()
    const email = formData.email.trim()
    const username = formData.username.trim()
    const password = formData.password

    if (!name || !email) {
      alert("יש למלא שם ואימייל")
      return
    }

    if (!username || !password) {
      alert("יש למלא שם משתמש וסיסמה")
      return
    }

    if (password.length < 4) {
      alert("הסיסמה חייבת להכיל לפחות 4 תווים")
      return
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        username,
        password,
        phone: formData.phone.trim() || null,
        role: selectedRole,
        permissions: selectedPermissions,
        status: "active",
      }),
    })

    if (res.status === 409) {
      alert("האימייל כבר קיים")
      return
    }
    if (!res.ok) {
      alert("שגיאה ביצירת משתמש")
      return
    }

    setIsDialogOpen(false)
    resetForm()
    await loadUsers()
  }

  async function updateUser(id: string) {
    const name = formData.name?.trim()
    const email = formData.email?.trim()
    const username = formData.username?.trim()
    if (!name || !email) {
      alert("יש למלא שם מלא ואימייל")
      return
    }
    if (!username) {
      alert("יש למלא שם משתמש")
      return
    }
    const permsToSave = selectedPermissionsRef.current.length ? selectedPermissionsRef.current : selectedPermissions
    const payload: Record<string, unknown> = {
      name,
      email: email || null,
      username,
      phone: formData.phone?.trim() || null,
      role: selectedRole,
      permissions: permsToSave,
    }
    if (formData.password && formData.password.trim().length >= 4) {
      payload.password = formData.password.trim()
    }
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = typeof data?.error === "string" && data.error.startsWith("errors.") ? t(data.error) : (data?.error || t("errors.updateUser"))
      alert(msg)
      return
    }

    const updated = data as User & { permissions?: string[]; role?: string }
    const savedPerms = Array.isArray(updated.permissions) ? updated.permissions : (updated.permissions ?? [])
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated, permissions: savedPerms } : u)))
    setIsDialogOpen(false)
    resetForm()
    setEditingUser(null)
    await loadUsers()
    const requestedSet = new Set((permsToSave || []).map((p) => String(p)))
    const savedSet = new Set((savedPerms || []).map((p) => String(p)))
    const missingAfterSave = Array.from(requestedSet).filter((p) => !savedSet.has(p))
    const extraAfterSave = Array.from(savedSet).filter((p) => !requestedSet.has(p))
    if (missingAfterSave.length > 0 || extraAfterSave.length > 0) {
      alert(
        `הפרטים נשמרו, אך נמצאה אי-התאמה בהרשאות.\n` +
          `חסרות אחרי שמירה: ${missingAfterSave.length}\n` +
          `נוספו בשרת: ${extraAfterSave.length}\n` +
          `פתח שוב את המשתמש לבדיקה.`,
      )
      return
    }
    alert("ההרשאות והפרטים נשמרו בהצלחה.")
  }

  async function toggleUser(user: User) {
    const nextStatus = user.status === "active" ? "disabled" : "active"

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (!res.ok) {
      alert("שגיאה בעדכון סטטוס משתמש")
      return
    }
    await loadUsers()
  }

  async function deleteUser(user: User) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      alert("שגיאה במחיקת משתמש")
      return
    }
    await loadUsers()
  }

  function requireAdminPassword(action: { type: "edit" | "toggle" | "delete"; user: User }) {
    setPendingAction(action)
    setIsPasswordDialogOpen(true)
  }

  function verifySuperAdminPassword() {
    if (passwordInput === "admin123") {
      setIsPasswordDialogOpen(false)
      setPasswordInput("")

      if (pendingAction) {
        if (pendingAction.type === "edit") openEdit(pendingAction.user)
        if (pendingAction.type === "toggle") toggleUser(pendingAction.user).catch(console.error)
        if (pendingAction.type === "delete") deleteUser(pendingAction.user).catch(console.error)
      }
      setPendingAction(null)
    } else {
      alert("סיסמה שגויה")
      setPasswordInput("")
    }
  }

  const MUTUAL_EXCLUSIVE_HOME_PROFILE = ["nav.myProfile", "settings.home"] as const

  function togglePermission(permissionId: string) {
    setSelectedPermissions((prev) => {
      const arr = Array.isArray(prev) ? prev : []
      const isAdding = !arr.includes(permissionId)
      let next = isAdding ? [...arr, permissionId] : arr.filter((p) => p !== permissionId)
      if (isAdding && MUTUAL_EXCLUSIVE_HOME_PROFILE.includes(permissionId as any)) {
        next = next.filter((p) => !MUTUAL_EXCLUSIVE_HOME_PROFILE.includes(p as any) || p === permissionId)
      }
      return next
    })
  }

  function toggleCategoryAll(category: PermissionCategory) {
    const categoryPermissionIds = category.permissions.map((p) => p.id)
    const current = Array.isArray(selectedPermissions) ? selectedPermissions : []
    const allSelected = categoryPermissionIds.every((id) => current.includes(id))

    if (allSelected) {
      setSelectedPermissions(current.filter((p) => !categoryPermissionIds.includes(p)))
    } else {
      let next = [...new Set([...current, ...categoryPermissionIds])]
      if (category.id === "myProfile" && categoryPermissionIds.includes("nav.myProfile")) {
        next = next.filter((p) => p !== "settings.home")
      }
      if (category.id === "settings" && categoryPermissionIds.includes("settings.home")) {
        next = next.filter((p) => p !== "nav.myProfile")
      }
      setSelectedPermissions(next)
    }
  }

  function applyCategoryMacro(category: PermissionCategory, mode: "read" | "edit" | "full" | "clear") {
    const ids = category.permissions.map((p) => p.id)
    const navIds = ids.filter((id) => id.startsWith("nav."))
    const viewIds = ids.filter((id) => /\.(view|read)$/.test(id))
    const editIds = ids.filter((id) => /\.(edit|write|send)$/.test(id))
    const deleteIds = ids.filter((id) => /\.delete$/.test(id))

    setSelectedPermissions((prev) => {
      const current = Array.isArray(prev) ? prev : []
      const withoutCategory = current.filter((p) => !ids.includes(p))
      if (mode === "clear") return withoutCategory
      if (mode === "full") return [...new Set([...withoutCategory, ...ids])]
      if (mode === "read") return [...new Set([...withoutCategory, ...navIds, ...viewIds])]
      return [...new Set([...withoutCategory, ...navIds, ...viewIds, ...editIds, ...deleteIds])]
    })
  }

  function setQuickPermission(row: QuickPermissionRow, action: QuickAction, enabled: boolean) {
    const ids = row[action] ?? []
    if (ids.length === 0) return
    setSelectedPermissions((prev) => {
      const current = Array.isArray(prev) ? prev : []
      if (enabled) return [...new Set([...current, ...ids])]
      return current.filter((p) => !ids.includes(p))
    })
  }

  function isQuickPermissionEnabled(row: QuickPermissionRow, action: QuickAction): boolean {
    const ids = row[action] ?? []
    if (ids.length === 0) return false
    return ids.every((id) => selectedPermissions.includes(id))
  }

  const [roleTab, setRoleTab] = useState("__all__")

  const roleTabDefs = useMemo(() => {
    const tabs = [
      { id: "__all__", label: "הכל", roles: null as string[] | null },
      { id: "student", label: "תלמידים", roles: ["student"] },
      { id: "teacher", label: "מורים", roles: ["teacher"] },
      { id: "management", label: "הנהלה", roles: ["admin", "secretary", "coordinator"] },
      { id: "other", label: "אחר", roles: ["other"] },
    ]
    return tabs
  }, [])

  const filteredByRole = useMemo(() => {
    if (roleTab === "__all__") return users
    const def = roleTabDefs.find((t) => t.id === roleTab)
    if (!def || !def.roles) return users
    return users.filter((u) => def.roles!.includes(u.role || "other"))
  }, [users, roleTab, roleTabDefs])

  const filteredCount = useMemo(() => filteredByRole.length, [filteredByRole])
  const permissionDiff = useMemo(() => {
    const initial = new Set((initialPermissions || []).map((p) => String(p)))
    const selected = new Set((selectedPermissions || []).map((p) => String(p)))
    const added = Array.from(selected).filter((p) => !initial.has(p)).sort()
    const removed = Array.from(initial).filter((p) => !selected.has(p)).sort()
    return { added, removed }
  }, [initialPermissions, selectedPermissions])

  if (noPermission) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-3 sm:p-6" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-lg text-red-600">אין הרשאה</CardTitle>
            <CardDescription>אין לך הרשאה לצפות בדף המשתמשים. פנה למנהל המערכת.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>חזרה לדף הבית</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowRight className="h-4 w-4 shrink-0" />
              חזרה
            </button>
            <PageHeader title="משתמשים" description="ניהול משתמשים והרשאות" />
          </div>

          <Button className="w-full gap-2 sm:w-auto" onClick={openCreate}>
            <UserPlus className="h-4 w-4 shrink-0" />
            הוסף משתמש
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">סינון וחיפוש</CardTitle>
            <CardDescription>חיפוש לפי שם/אימייל/טלפון וסינון לפי סטטוס</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 space-y-2 sm:min-w-[200px]">
              <Label>חיפוש</Label>
              <Input value={q ?? ""} onChange={(e) => setQ(e.target.value)} placeholder="חפש משתמש..." className="w-full" />
            </div>

            <div className="w-full space-y-2 sm:w-48 md:w-64">
              <Label>סטטוס</Label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="הכל" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">הכל</SelectItem>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="disabled">מושבת</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 pt-2 text-sm text-gray-600 sm:pt-0">
              {loading ? "טוען..." : `${filteredCount} משתמשים`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>רשימת משתמשים</CardTitle>
            <CardDescription>עריכה: טלפון + הרשאות | פעולה: השבת/הפעל/מחק. לכניסה למערכת: הזן את &quot;שם משתמש&quot; או אימייל + סיסמה.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <Tabs dir="rtl" value={roleTab} onValueChange={setRoleTab} className="w-full">
              <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-0.5 p-1">
                {roleTabDefs.map((tab) => {
                  const count = tab.roles ? users.filter((u) => tab.roles!.includes(u.role || "other")).length : users.length
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                      {tab.label} ({count})
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
            {loading ? (
              <div className="py-10 text-center text-gray-500">טוען...</div>
            ) : filteredByRole.length === 0 ? (
              <div className="py-10 text-center text-gray-500">אין משתמשים</div>
            ) : (
              <div className="-mx-2 overflow-x-auto sm:mx-0">
                <Table className="min-w-[880px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap text-right">שם</TableHead>
                    <TableHead className="whitespace-nowrap text-right" title="לכניסה למערכת יש להזין שם משתמש או אימייל">
                      שם משתמש
                    </TableHead>
                    <TableHead className="text-right">אימייל</TableHead>
                    <TableHead className="whitespace-nowrap text-right">טלפון</TableHead>
                    <TableHead className="whitespace-nowrap text-right">תפקיד</TableHead>
                    <TableHead className="whitespace-nowrap text-right">סטטוס</TableHead>
                    <TableHead className="whitespace-nowrap text-right">נוצר</TableHead>
                    <TableHead className="whitespace-nowrap text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredByRole.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[140px] align-top font-medium sm:max-w-none">
                        <div className="flex items-center gap-2">
                          {isAdminUser(u) && <Lock className="h-4 w-4 shrink-0 text-purple-600" />}
                          <span className="break-words">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top font-mono text-sm text-indigo-600" title="לכניסה: הזן ערך זה בשדה שם משתמש">
                        <span className="break-all">{u.username ?? "—"}</span>
                      </TableCell>
                      <TableCell className="max-w-[160px] break-all align-top text-right sm:max-w-none">{u.email}</TableCell>
                      <TableCell className="whitespace-nowrap align-top text-right" dir="ltr">
                        {u.phone || "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline">{getRoleById(u.role || "other")?.name || u.role || "אחר"}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          className={u.status === "active" ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}
                        >
                          {u.status === "active" ? "פעיל" : "מושבת"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm text-gray-600">
                        {new Date(u.createdAt).toLocaleDateString("he-IL")}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title={isAdminUser(u) ? "דורש אימות" : "ערוך"}
                            onClick={() =>
                              isAdminUser(u) ? requireAdminPassword({ type: "edit", user: u }) : openEdit(u)
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title={u.status === "active" ? "השבת" : "הפעל"}
                            onClick={() =>
                              isAdminUser(u)
                                ? requireAdminPassword({ type: "toggle", user: u })
                                : toggleUser(u).catch(console.error)
                            }
                          >
                            {u.status === "active" ? (
                              <Power className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Power className="h-4 w-4 text-emerald-600" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="מחק"
                            onClick={() =>
                              isAdminUser(u)
                                ? requireAdminPassword({ type: "delete", user: u })
                                : deleteUser(u).catch(console.error)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogContent
            className="!max-w-[min(1400px,calc(100vw-1rem))] max-h-[85dvh] overflow-y-auto p-4 sm:p-6"
            dir="rtl"
          >
            <DialogHeader>
              <DialogTitle>{editingUser ? "עריכת משתמש" : "משתמש חדש"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "הגדר את פרטי המשתמש והרשאותיו במערכת" : "יצירת משתמש חדש (שם + אימייל חובה)"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>שם מלא *</Label>
                  <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="הזן שם מלא"
                  />
                </div>

                <div className="space-y-2">
                  <Label>אימייל *</Label>
                  <Input
                    type="email"
                    value={formData.email ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="example@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>טלפון</Label>
                  <Input
                    value={formData.phone ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="מספר טלפון"
                  />
                </div>

                <div className="space-y-2">
                  <Label>שם משתמש *</Label>
                  <Input
                    value={formData.username ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                    placeholder="שם משתמש להתחברות"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{editingUser ? "סיסמה חדשה" : "סיסמה *"}</Label>
                  <Input
                    type="password"
                    value={formData.password ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    placeholder={editingUser ? "השאר ריק לשמירת הסיסמה הנוכחית" : "סיסמה (לפחות 4 תווים)"}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* בחירת תפקיד */}
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <Label className="text-lg font-semibold">תפקיד</Label>
                  <span className="text-sm text-muted-foreground sm:max-w-[70%] sm:text-left">
                    מעבר לתפקיד אחר ממלא הרשאות אוטומטית. שינויים בצ&apos;קבוקסים נשמרים בלחיצה על שמור.
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  {ROLE_PRESETS.map((role) => (
                    <div
                      key={role.id}
                      onClick={() => handleRoleChange(role.id)}
                      className={`cursor-pointer rounded-xl border-2 p-4 text-center transition-all hover:shadow-md ${
                        selectedRole === role.id
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold text-base">{role.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <Label className="text-lg font-semibold">הרשאות</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedPermissions.length} הרשאות נבחרו</Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setSelectedPermissions((prev) => [
                          ...new Set([...prev, ...getAllSchoolTabPermissionIds()]),
                        ])
                      }
                    >
                      + בית ספר: כל הטאבים
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setSelectedPermissions((prev) => [
                          ...new Set([...prev, ...getKaytanaCampViewEditPermissionIds()]),
                        ])
                      }
                    >
                      + קייטנה: צפייה+עריכה לכל הטאבים
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setSelectedPermissions((prev) => [
                          ...new Set([...prev, ...getAllKaytanaCampPermissionIds()]),
                        ])
                      }
                    >
                      + קייטנה מלא (כולל מחיקות)
                    </Button>
                  </div>
                </div>

                <Card className="border-dashed border-indigo-300 bg-indigo-50/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">הרשאות מהירות לפי פעולה</CardTitle>
                    <CardDescription>הפעל/בטל צפייה, עריכה ומחיקה לכל מודול בלחיצה אחת</CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-4">
                    <div className="-mx-2 overflow-x-auto sm:mx-0">
                      <Table className="min-w-[680px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">מודול</TableHead>
                            <TableHead className="text-center">צפייה</TableHead>
                            <TableHead className="text-center">עריכה</TableHead>
                            <TableHead className="text-center">מחיקה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {QUICK_PERMISSION_ROWS.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.label}</TableCell>
                              <TableCell className="text-center">
                                {row.view?.length ? (
                                  <Checkbox
                                    checked={isQuickPermissionEnabled(row, "view")}
                                    onCheckedChange={(checked) => setQuickPermission(row, "view", Boolean(checked))}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {row.edit?.length ? (
                                  <Checkbox
                                    checked={isQuickPermissionEnabled(row, "edit")}
                                    onCheckedChange={(checked) => setQuickPermission(row, "edit", Boolean(checked))}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {row.delete?.length ? (
                                  <Checkbox
                                    checked={isQuickPermissionEnabled(row, "delete")}
                                    onCheckedChange={(checked) => setQuickPermission(row, "delete", Boolean(checked))}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-dashed border-amber-300 bg-amber-50/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">סיכום שינויים לפני שמירה</CardTitle>
                    <CardDescription>
                      נוספו: {permissionDiff.added.length} | הוסרו: {permissionDiff.removed.length}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                      <div className="mb-1 text-sm font-semibold text-emerald-700">נוספו</div>
                      <div className="max-h-28 overflow-y-auto text-xs text-emerald-800">
                        {permissionDiff.added.length === 0 ? "ללא" : permissionDiff.added.join(", ")}
                      </div>
                    </div>
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                      <div className="mb-1 text-sm font-semibold text-rose-700">הוסרו</div>
                      <div className="max-h-28 overflow-y-auto text-xs text-rose-800">
                        {permissionDiff.removed.length === 0 ? "ללא" : permissionDiff.removed.join(", ")}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {PERMISSION_CATEGORIES.map((category) => {
                    const Icon = categoryIcons[category.id] || BookOpen
                    const allSelected = category.permissions.every((p) => selectedPermissions.includes(p.id))

                    return (
                      <Card
                        key={category.id}
                        className={`min-w-0 w-full border-2 ${colorClasses[category.color] || "bg-gray-50 border-gray-200"}`}
                      >
                        <CardHeader className="px-3 pb-3 pt-4 sm:px-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <Icon className="h-6 w-6 shrink-0" />
                              <CardTitle className="text-base font-semibold sm:text-lg">{category.name}</CardTitle>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => applyCategoryMacro(category, "read")}
                              >
                                קריאה בלבד
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => applyCategoryMacro(category, "edit")}
                              >
                                קריאה+עריכה
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => applyCategoryMacro(category, "full")}
                              >
                                מלא
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => applyCategoryMacro(category, "clear")}
                              >
                                נקה
                              </Button>
                              <Badge
                                variant="secondary"
                                className="w-fit shrink-0 cursor-pointer px-2 py-1 text-[11px]"
                                onClick={() => toggleCategoryAll(category)}
                              >
                                {allSelected ? "ביטול הכל" : "בחר הכל"}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 px-3 sm:space-y-5 sm:px-5">
                          {category.permissions.map((perm) => (
                            <div key={perm.id} className="flex items-start gap-4 p-2 rounded-lg hover:bg-black/5 transition-colors">
                              <Checkbox
                                id={perm.id}
                                checked={selectedPermissions.includes(perm.id)}
                                onCheckedChange={() => togglePermission(perm.id)}
                                className="mt-1 flex-shrink-0 h-5 w-5"
                              />
                              <div className="grid gap-2 leading-none min-w-0 flex-1">
                                <label htmlFor={perm.id} className="text-base font-medium leading-tight cursor-pointer">
                                  {perm.name}
                                </label>
                                <p className="text-sm text-muted-foreground leading-relaxed">{perm.description}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => (editingUser ? updateUser(editingUser.id) : createUser())}
              >
                {editingUser ? "שמור שינויים" : "צור משתמש"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-600" />
                אימות סיסמה
              </AlertDialogTitle>
              <AlertDialogDescription>פעולה על ADMIN מוגנת. הזן סיסמה כדי להמשיך.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label>סיסמת ADMIN</Label>
              <Input
                type="password"
                value={passwordInput ?? ""}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="admin123"
                onKeyDown={(e) => {
                  if (e.key === "Enter") verifySuperAdminPassword()
                }}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setPasswordInput("")
                  setPendingAction(null)
                }}
              >
                ביטול
              </AlertDialogCancel>
              <AlertDialogAction onClick={verifySuperAdminPassword}>אמת</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
