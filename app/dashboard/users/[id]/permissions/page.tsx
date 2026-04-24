"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { PERMISSION_CATEGORIES, ROLE_PRESETS, getRoleById, type RoleType } from "@/lib/permissions"

type UserPayload = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  username?: string | null
  role?: string | null
  permissions?: string[]
}

function isViewPermission(id: string): boolean {
  return id.startsWith("nav.") || /\.(view|read)$/.test(id)
}

function isEditPermission(id: string): boolean {
  return /\.(edit|write|send|create|modify)$/.test(id)
}

function isDeletePermission(id: string): boolean {
  return /\.(delete|remove|cancel)$/.test(id)
}

export default function UserPermissionsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const userId = String(params?.id || "")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<UserPayload | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  })
  const [selectedRole, setSelectedRole] = useState<RoleType>("other")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!userId) return
      try {
        setLoading(true)
        const res = await fetch(`/api/users/${userId}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load user")
        const data = (await res.json()) as UserPayload
        if (cancelled) return
        setUser(data)
        setFormData({
          name: String(data.name || ""),
          username: String(data.username || ""),
          email: String(data.email || ""),
          phone: String(data.phone || ""),
          password: "",
        })
        const role = ((data.role as RoleType) || "other") as RoleType
        setSelectedRole(role)
        setSelectedPermissions(Array.isArray(data.permissions) ? data.permissions : [])
      } catch {
        if (!cancelled) {
          alert("שגיאה בטעינת המשתמש")
          router.push("/dashboard/users")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, userId])

  useEffect(() => {
    if (!activeTab && PERMISSION_CATEGORIES.length > 0) {
      setActiveTab(PERMISSION_CATEGORIES[0]!.id)
    }
  }, [activeTab])

  const groupedByCategory = useMemo(() => {
    return PERMISSION_CATEGORIES.map((cat) => {
      const view = cat.permissions.filter((p) => isViewPermission(p.id))
      const edit = cat.permissions.filter((p) => isEditPermission(p.id))
      const del = cat.permissions.filter((p) => isDeletePermission(p.id))
      const misc = cat.permissions.filter((p) => !isViewPermission(p.id) && !isEditPermission(p.id) && !isDeletePermission(p.id))
      return { ...cat, view, edit, del, misc }
    })
  }, [])

  function togglePermission(id: string) {
    setSelectedPermissions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleGroup(ids: string[], checked: boolean) {
    if (ids.length === 0) return
    setSelectedPermissions((prev) => {
      if (checked) return [...new Set([...prev, ...ids])]
      return prev.filter((p) => !ids.includes(p))
    })
  }

  function applyRolePreset(roleId: RoleType) {
    setSelectedRole(roleId)
    const role = getRoleById(roleId)
    if (!role) return
    setSelectedPermissions([...role.permissions])
  }

  async function savePermissions() {
    if (!user) return
    if (!formData.name.trim() || !formData.username.trim()) {
      alert("יש למלא שם ושם משתמש")
      return
    }
    if (formData.password.trim().length > 0 && formData.password.trim().length < 4) {
      alert("סיסמה חדשה חייבת להיות לפחות 4 תווים")
      return
    }
    try {
      setSaving(true)
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        role: selectedRole,
        permissions: selectedPermissions,
      }
      if (formData.password.trim().length >= 4) {
        payload.password = formData.password.trim()
      }
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("save_failed")
      alert("ההרשאות נשמרו בהצלחה")
      router.push("/dashboard/users")
    } catch {
      alert("שגיאה בשמירת הרשאות")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card><CardContent className="py-10 text-center text-muted-foreground">טוען...</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/users")}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה למשתמשים
          </button>
          <h1 className="text-2xl font-bold">ניהול הרשאות משתמש</h1>
          <p className="text-sm text-muted-foreground">דף מלא לעריכת הרשאות לפי טאבים</p>
        </div>
        <Button onClick={savePermissions} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "שומר..." : "שמור וחזור"}
        </Button>
      </div>

      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardHeader>
          <CardTitle className="text-lg">פרטי משתמש</CardTitle>
          <CardDescription>פרטי המשתמש מסודרים עם אפשרות עריכה כולל סיסמה</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>שם</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="שם מלא"
            />
          </div>
          <div className="space-y-1.5">
            <Label>שם משתמש</Label>
            <Input
              dir="ltr"
              value={formData.username}
              onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
              placeholder="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>אימייל</Label>
            <Input
              dir="ltr"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>טלפון</Label>
            <Input
              dir="ltr"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="0500000000"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label>סיסמה חדשה</Label>
            <Input
              dir="ltr"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              placeholder="השאר ריק אם לא רוצים לשנות"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">בחירת תפקיד מהירה</CardTitle>
          <CardDescription>בחירה בתפקיד מחילה סט הרשאות מוכן</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {ROLE_PRESETS.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => applyRolePreset(role.id)}
              className={`rounded-xl border px-3 py-3 text-right transition ${
                selectedRole === role.id ? "border-indigo-500 bg-indigo-50" : "border-border hover:border-indigo-300"
              }`}
            >
              <div className="font-semibold">{role.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{role.description}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">הרשאות לפי דפים</CardTitle>
              <CardDescription>כל טאב הוא דף/מודול, ובתוכו צפייה / עריכה / מחיקה ועוד</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3.5 w-3.5" />
              {selectedPermissions.length} הרשאות פעילות
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs dir="rtl" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 h-auto w-full flex-wrap justify-start">
              {groupedByCategory.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {groupedByCategory.map((cat) => {
              const viewIds = cat.view.map((p) => p.id)
              const editIds = cat.edit.map((p) => p.id)
              const delIds = cat.del.map((p) => p.id)
              return (
                <TabsContent key={cat.id} value={cat.id} className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="border-emerald-200 bg-emerald-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">צפייה</CardTitle>
                        <CardDescription>
                          <button type="button" className="underline" onClick={() => toggleGroup(viewIds, true)}>בחר הכל</button>
                          {" · "}
                          <button type="button" className="underline" onClick={() => toggleGroup(viewIds, false)}>נקה</button>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {cat.view.length === 0 ? <div className="text-sm text-muted-foreground">אין הרשאות</div> : cat.view.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-white/60">
                            <Checkbox checked={selectedPermissions.includes(perm.id)} onCheckedChange={() => togglePermission(perm.id)} />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 bg-blue-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">עריכה / יצירה</CardTitle>
                        <CardDescription>
                          <button type="button" className="underline" onClick={() => toggleGroup(editIds, true)}>בחר הכל</button>
                          {" · "}
                          <button type="button" className="underline" onClick={() => toggleGroup(editIds, false)}>נקה</button>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {cat.edit.length === 0 ? <div className="text-sm text-muted-foreground">אין הרשאות</div> : cat.edit.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-white/60">
                            <Checkbox checked={selectedPermissions.includes(perm.id)} onCheckedChange={() => togglePermission(perm.id)} />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-rose-200 bg-rose-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">מחיקה</CardTitle>
                        <CardDescription>
                          <button type="button" className="underline" onClick={() => toggleGroup(delIds, true)}>בחר הכל</button>
                          {" · "}
                          <button type="button" className="underline" onClick={() => toggleGroup(delIds, false)}>נקה</button>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {cat.del.length === 0 ? <div className="text-sm text-muted-foreground">אין הרשאות</div> : cat.del.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-white/60">
                            <Checkbox checked={selectedPermissions.includes(perm.id)} onCheckedChange={() => togglePermission(perm.id)} />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {cat.misc.length > 0 ? (
                    <Card className="border-slate-200 bg-slate-50/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">הרשאות נוספות</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {cat.misc.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-white/60">
                            <Checkbox checked={selectedPermissions.includes(perm.id)} onCheckedChange={() => togglePermission(perm.id)} />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      <div className="sticky bottom-2 z-20 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            משתמש: {formData.name || user.name || "—"} | תפקיד: {getRoleById(selectedRole)?.name || selectedRole}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard/users")}>
              ביטול
            </Button>
            <Button onClick={savePermissions} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

