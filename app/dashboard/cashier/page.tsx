"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, Plus, Trash2, TrendingUp, TrendingDown, Calendar, CreditCard, Loader2, ChevronDown, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"

interface Expense {
  id: string
  description: string
  amount: number
  date: string
  isRecurring: boolean
  recurringDay?: number
  category: string
  paymentMethod: "cash" | "credit" | "transfer" | "check" | "bit"
  cardLastDigits?: string
  bankName?: string
  bankBranch?: string
  accountNumber?: string
  createdByUserName?: string
}

interface Payment {
  id: string
  amount: number
  paymentDate: string
  paymentType: string // This stores both payment method (cash, credit, etc.) and special types (discount, credit)
  description?: string
  studentId?: string
  schoolId?: string
  studentName?: string
  student?: { id: string; firstName: string; lastName: string }
  school?: { id: string; name: string }
  createdByUserName?: string
}

interface Student {
  id: string
  name?: string
  firstName?: string
  lastName?: string
}

interface School {
  id: string
  name: string
}

interface Course {
  id: string
  name: string
}

interface Enrollment {
  id: string
  studentId: string
  courseId: string
  studentName?: string
}

interface EnvelopeRow {
  date: string
  amount: number
  type?: "income" | "expense"
  name?: string
  notes?: string
}

interface EnvelopeBudget {
  id: string
  monthKey: string
  targetAmount: number
  rows: EnvelopeRow[]
}

/** תצוגת שם תלמיד – תומך ב-API שמחזיר name או firstName+lastName */
function getStudentDisplayName(s: Student | { studentName?: string; studentId?: string }): string {
  if (!s) return "—"
  const name = (s as { name?: string }).name ?? (s as { studentName?: string }).studentName
  if (name) return String(name).trim()
  const first = (s as { firstName?: string }).firstName
  const last = (s as { lastName?: string }).lastName
  if (first != null || last != null) return [first, last].filter(Boolean).join(" ").trim()
  return "—"
}

function formatExpenseDescription(desc: string): string {
  if (!desc) return "-"
  // Legacy auto description format:
  // [AUTO_TEACHER_ATTENDANCE] yyyy-mm-dd | courseId | teacherName | courseName
  if (desc.includes("[AUTO_TEACHER_ATTENDANCE]")) {
    const raw = desc.replace("[AUTO_TEACHER_ATTENDANCE]", "").trim()
    const parts = raw.split("|").map((p) => p.trim())
    const date = parts[0] || ""
    const teacherName = parts[2] || "מורה"
    const courseName = parts[3] || "קורס"
    return `שכר מורה אוטומטי: ${teacherName} | ${courseName} | ${date}`
  }
  return desc
}

function formatDateDDMMYYYY(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  const data = await res.json()
  // Normalise: if server wraps array in { data: [...] } or returns a non-array, unwrap safely
  return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
}



export default function CashierPage() {
  const router = useRouter()
  const [timePeriod, setTimePeriod] = useState<"day" | "week" | "month" | "quarter" | "year">("month")
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(new Date().toISOString().slice(5, 7))
  const [selectedQuarter, setSelectedQuarter] = useState("1")
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [isAddingExpense, setIsAddingExpense] = useState(false)
  const [isAddingIncome, setIsAddingIncome] = useState(false)

  // Expense form state
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0])
  const [expenseCategory, setExpenseCategory] = useState("")
  const [customExpenseCategory, setCustomExpenseCategory] = useState("")
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDay, setRecurringDay] = useState("1")
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<"cash" | "credit" | "transfer" | "check" | "bit">("cash")
  const [expenseCardLastDigits, setExpenseCardLastDigits] = useState("")
  const [expenseBankName, setExpenseBankName] = useState("")
  const [expenseBankBranch, setExpenseBankBranch] = useState("")
  const [expenseAccountNumber, setExpenseAccountNumber] = useState("")

  // Income form state
  const [incomeDescription, setIncomeDescription] = useState("")
  const [incomeAmount, setIncomeAmount] = useState("")
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split("T")[0])
  const [incomeType, setIncomeType] = useState<"student" | "course" | "school" | "other">("student")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [customName, setCustomName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | "transfer" | "check" | "bit">("cash")
  const [cardLastDigits, setCardLastDigits] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankBranch, setBankBranch] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [envelopeMonthKey, setEnvelopeMonthKey] = useState(new Date().toISOString().slice(0, 10))
  const [envelopeMonthFilter, setEnvelopeMonthFilter] = useState(new Date().toISOString().slice(5, 7))
  const [envelopeTargetAmount, setEnvelopeTargetAmount] = useState("")
  const [isAddingEnvelope, setIsAddingEnvelope] = useState(false)
  const [envelopeRowDate, setEnvelopeRowDate] = useState(new Date().toISOString().slice(0, 10))
  const [envelopeRowAmount, setEnvelopeRowAmount] = useState("")
  const [envelopeRowType, setEnvelopeRowType] = useState<"income" | "expense">("income")
  const [envelopeRowName, setEnvelopeRowName] = useState("")
  const [envelopeRowNotes, setEnvelopeRowNotes] = useState("")
  const [activeEnvelopeId, setActiveEnvelopeId] = useState("")
  const [isSavingEnvelopeRow, setIsSavingEnvelopeRow] = useState(false)
  const [isEnvelopeRowDialogOpen, setIsEnvelopeRowDialogOpen] = useState(false)
  const [openedEnvelopeId, setOpenedEnvelopeId] = useState("")
  const [editingEnvelopeRowIndex, setEditingEnvelopeRowIndex] = useState<number | null>(null)
  const [isEnvelopeEditDialogOpen, setIsEnvelopeEditDialogOpen] = useState(false)
  const [isEnvelopeCreateDialogOpen, setIsEnvelopeCreateDialogOpen] = useState(false)
  const [editEnvelopeMonthKey, setEditEnvelopeMonthKey] = useState("")
  const [editEnvelopeTargetAmount, setEditEnvelopeTargetAmount] = useState("")

  // Fetch data from API
  const { data: rawExpenses, isLoading: expensesLoading } = useSWR<Expense[]>("/api/expenses", fetcher)
  const { data: rawPayments, isLoading: paymentsLoading } = useSWR<Payment[]>("/api/payments", fetcher)
  const { data: rawStudents } = useSWR<Student[]>("/api/students", fetcher)
  const { data: rawSchools  } = useSWR<School[]>("/api/schools",   fetcher)
  const { data: rawCourses } = useSWR<Course[]>("/api/courses", fetcher)
  const { data: rawEnrollments } = useSWR<Enrollment[]>("/api/enrollments", fetcher)
  const { data: rawEnvelopes, isLoading: envelopesLoading } = useSWR<EnvelopeBudget[]>("/api/envelopes", fetcher)

  // Defensive normalisation — never let a non-array reach .map()
  const expenses = Array.isArray(rawExpenses) ? rawExpenses : []
  const payments = Array.isArray(rawPayments) ? rawPayments : []
  const students = Array.isArray(rawStudents) ? rawStudents : []
  const schools  = Array.isArray(rawSchools)  ? rawSchools  : []
  const courses  = Array.isArray(rawCourses)  ? rawCourses  : []
  const enrollments = Array.isArray(rawEnrollments) ? rawEnrollments : []
  const envelopes = Array.isArray(rawEnvelopes) ? rawEnvelopes : []
  const studentsInSelectedCourse = selectedCourseId
    ? enrollments.filter((e) => e.courseId === selectedCourseId)
    : []

  const israeliBanks = [
    "בנק לאומי",
    "בנק הפועלים",
    "בנק דיסקונט",
    "בנק מזרחי טפחות",
    "בנק מרכנתיל",
    "בנק הבינלאומי הראשון",
    "בנק אוצר החייל",
    "בנק יהב",
    "בנק ירושלים",
    "בנק מסד",
    "בנק הדואר",
    "וואן זירו (ONE ZERO)",
  ]

  const addExpense = async () => {
    if (!expenseDescription || !expenseAmount || !expenseCategory) return
    if (expenseCategory === "other" && !customExpenseCategory) return
    if (expensePaymentMethod === "credit" && !expenseCardLastDigits) return
    if ((expensePaymentMethod === "transfer" || expensePaymentMethod === "check") && (!expenseBankName || !expenseBankBranch || !expenseAccountNumber)) return

    setIsAddingExpense(true)
    try {
      const finalCategory = expenseCategory === "other" ? customExpenseCategory : expenseCategory
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseDescription,
          amount: Number.parseFloat(expenseAmount),
          date: expenseDate,
          isRecurring,
          recurringDay: isRecurring ? Number.parseInt(recurringDay) : null,
          category: finalCategory,
          paymentMethod: expensePaymentMethod,
        }),
      })

      if (response.ok) {
        mutate("/api/expenses")
        // Reset form
        setExpenseDescription("")
        setExpenseAmount("")
        setExpenseDate(new Date().toISOString().split("T")[0])
        setExpenseCategory("")
        setCustomExpenseCategory("")
        setIsRecurring(false)
        setRecurringDay("1")
        setExpensePaymentMethod("cash")
        setExpenseCardLastDigits("")
        setExpenseBankName("")
        setExpenseBankBranch("")
        setExpenseAccountNumber("")
      }
    } catch (error) {
      console.error("Failed to add expense:", error)
    }
    setIsAddingExpense(false)
  }

  const addIncome = async () => {
    console.log("[v0] addIncome called", { incomeDescription, incomeAmount, incomeType, customName, selectedStudentId, selectedSchoolId, paymentMethod })
    
    if (!incomeDescription || !incomeAmount) {
      console.log("[v0] Missing description or amount")
      return
    }

    let studentId = null
    let schoolId = null
    let sourceName = null

    if (incomeType === "student" || incomeType === "course") {
      if (!selectedStudentId) {
        console.log("[v0] Student/Course type but no student selected")
        return
      }
      studentId = selectedStudentId
    } else if (incomeType === "school") {
      if (!selectedSchoolId) {
        console.log("[v0] School type but no school selected")
        return
      }
      schoolId = selectedSchoolId
    } else if (incomeType === "other") {
      if (!customName) {
        console.log("[v0] Other type but no custom name")
        return
      }
      sourceName = customName
    }

    if (paymentMethod === "credit" && !cardLastDigits) {
      console.log("[v0] Credit but no card digits")
      return
    }
    if ((paymentMethod === "transfer" || paymentMethod === "check") && (!bankName || !bankBranch || !accountNumber)) {
      console.log("[v0] Transfer/check but missing bank details")
      return
    }

    setIsAddingIncome(true)
    try {
      const body = {
        amount: Number.parseFloat(incomeAmount),
        date: incomeDate,
        paymentMethod,
        description: incomeDescription,
        studentId,
        schoolId,
        sourceName,
      }
      console.log("[v0] Sending to API:", body)
      
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      console.log("[v0] Response status:", response.status)
      const data = await response.json()
      console.log("[v0] Response data:", data)

      if (response.ok) {
        mutate("/api/payments")
        // Reset form
        setIncomeDescription("")
        setIncomeAmount("")
        setIncomeDate(new Date().toISOString().split("T")[0])
        setIncomeType("student")
        setSelectedStudentId("")
        setSelectedCourseId("")
        setSelectedSchoolId("")
        setCustomName("")
        setPaymentMethod("cash")
        setCardLastDigits("")
        setBankName("")
        setBankBranch("")
        setAccountNumber("")
      }
    } catch (error) {
      console.error("[v0] Failed to add income:", error)
    }
    setIsAddingIncome(false)
  }

  const deleteExpense = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" })
      if (response.ok) {
        mutate("/api/expenses")
      }
    } catch (error) {
      console.error("Failed to delete expense:", error)
    }
  }

  const deleteIncome = async (id: string) => {
    try {
      const response = await fetch(`/api/payments/${id}`, { method: "DELETE" })
      if (response.ok) {
        mutate("/api/payments")
      }
    } catch (error) {
      console.error("Failed to delete income:", error)
    }
  }

  const createEnvelope = async () => {
    if (!envelopeMonthKey || !envelopeTargetAmount) return
    setIsAddingEnvelope(true)
    try {
      const response = await fetch("/api/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: envelopeMonthKey,
          targetAmount: Number(envelopeTargetAmount || 0),
          rows: [],
        }),
      })
      if (response.ok) {
        mutate("/api/envelopes")
        setEnvelopeTargetAmount("")
        setIsEnvelopeCreateDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to create envelope:", error)
    } finally {
      setIsAddingEnvelope(false)
    }
  }

  const addEnvelopeRow = async (envelope: EnvelopeBudget) => {
    if (!envelopeRowDate || !envelopeRowAmount) return
    setIsSavingEnvelopeRow(true)
    try {
      const row = {
        date: envelopeRowDate,
        amount: Number(envelopeRowAmount || 0),
        type: envelopeRowType,
        name: envelopeRowName,
        notes: envelopeRowNotes,
      }
      const existingRows = Array.isArray(envelope.rows) ? envelope.rows : []
      const nextRows =
        editingEnvelopeRowIndex === null
          ? [...existingRows, row]
          : existingRows.map((existingRow, idx) => (idx === editingEnvelopeRowIndex ? row : existingRow))
      const response = await fetch(`/api/envelopes/${envelope.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: envelope.monthKey,
          targetAmount: Number(envelope.targetAmount || 0),
          rows: nextRows,
        }),
      })
      if (response.ok) {
        mutate("/api/envelopes")
        setEnvelopeRowAmount("")
        setEnvelopeRowName("")
        setEnvelopeRowNotes("")
        setEnvelopeRowType("income")
        setEditingEnvelopeRowIndex(null)
        setIsEnvelopeRowDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to add envelope row:", error)
    } finally {
      setIsSavingEnvelopeRow(false)
    }
  }

  const deleteEnvelope = async (id: string) => {
    try {
      const response = await fetch(`/api/envelopes/${id}`, { method: "DELETE" })
      if (response.ok) mutate("/api/envelopes")
    } catch (error) {
      console.error("Failed to delete envelope:", error)
    }
  }

  const deleteEnvelopeRow = async (envelope: EnvelopeBudget, rowIndex: number) => {
    const existingRows = Array.isArray(envelope.rows) ? envelope.rows : []
    const nextRows = existingRows.filter((_, idx) => idx !== rowIndex)
    try {
      const response = await fetch(`/api/envelopes/${envelope.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: envelope.monthKey,
          targetAmount: Number(envelope.targetAmount || 0),
          rows: nextRows,
        }),
      })
      if (response.ok) mutate("/api/envelopes")
    } catch (error) {
      console.error("Failed to delete envelope row:", error)
    }
  }

  const openEditEnvelopeDialog = (envelope: EnvelopeBudget) => {
    setActiveEnvelopeId(envelope.id)
    setEditEnvelopeMonthKey(String(envelope.monthKey || ""))
    setEditEnvelopeTargetAmount(String(Number(envelope.targetAmount || 0)))
    setIsEnvelopeEditDialogOpen(true)
  }

  const saveEnvelopeDetails = async () => {
    if (!activeEnvelope) return
    try {
      const response = await fetch(`/api/envelopes/${activeEnvelope.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: editEnvelopeMonthKey,
          targetAmount: Number(editEnvelopeTargetAmount || 0),
          rows: Array.isArray(activeEnvelope.rows) ? activeEnvelope.rows : [],
        }),
      })
      if (response.ok) {
        mutate("/api/envelopes")
        setIsEnvelopeEditDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to update envelope details:", error)
    }
  }

  const filteredEnvelopesByMonth = envelopes
    .filter((e) => String(e.monthKey || "").slice(5, 7) === envelopeMonthFilter)
    .sort((a, b) => String(a.monthKey || "").localeCompare(String(b.monthKey || "")))
  const filteredEnvelopesTargetSum = filteredEnvelopesByMonth.reduce((sum, envelope) => sum + Number(envelope.targetAmount || 0), 0)
  const filteredEnvelopesIncomeSum = filteredEnvelopesByMonth.reduce((sum, envelope) => {
    const rows = Array.isArray(envelope.rows) ? envelope.rows : []
    return sum + rows.reduce((inner, row) => inner + (String(row.type || "expense") === "income" ? Number(row.amount || 0) : 0), 0)
  }, 0)
  const filteredEnvelopesExpenseSum = filteredEnvelopesByMonth.reduce((sum, envelope) => {
    const rows = Array.isArray(envelope.rows) ? envelope.rows : []
    return sum + rows.reduce((inner, row) => inner + (String(row.type || "expense") === "expense" ? Number(row.amount || 0) : 0), 0)
  }, 0)
  const filteredEnvelopesBalance = filteredEnvelopesIncomeSum - filteredEnvelopesExpenseSum
  const activeEnvelope = envelopes.find((e) => e.id === activeEnvelopeId)

  const filterByTimePeriod = <T extends { date?: string; paymentDate?: string }>(items: T[]): T[] => {
    if (!Array.isArray(items)) return []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return items.filter((item) => {
      // Support both 'date' (expenses) and 'paymentDate' (payments)
      const dateValue = (item as { date?: string }).date || (item as { paymentDate?: string }).paymentDate
      if (!dateValue) return true
      const itemDate = new Date(dateValue)

      switch (timePeriod) {
        case "day":
          return itemDate.toDateString() === today.toDateString()
        case "week":
          const weekAgo = new Date(today)
          weekAgo.setDate(today.getDate() - 7)
          return itemDate >= weekAgo && itemDate <= today
        case "month":
          return String(itemDate.getMonth() + 1).padStart(2, "0") === selectedMonthNumber && String(itemDate.getFullYear()) === selectedYear
        case "quarter":
          const quarter = Number(selectedQuarter) - 1
          const itemQuarter = Math.floor(itemDate.getMonth() / 3)
          return itemQuarter === quarter && String(itemDate.getFullYear()) === selectedYear
        case "year":
          return String(itemDate.getFullYear()) === selectedYear
        default:
          return true
      }
    })
  }

  const filteredExpenses = filterByTimePeriod(expenses)
  const filteredPayments = filterByTimePeriod(payments)

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalIncomes = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = totalIncomes - totalExpenses
  const cashBalanceForSelectedMonth = filteredEnvelopesBalance
  const yearlyCashBalance = envelopes
    .filter((envelope) => {
      const date = new Date(String(envelope.monthKey || ""))
      return !Number.isNaN(date.getTime()) && String(date.getFullYear()) === selectedYear
    })
    .reduce((sum, envelope) => {
      const rows = Array.isArray(envelope.rows) ? envelope.rows : []
      const income = rows.reduce(
        (inner, row) => inner + (String(row.type || "expense") === "income" ? Number(row.amount || 0) : 0),
        0,
      )
      const expense = rows.reduce(
        (inner, row) => inner + (String(row.type || "expense") === "expense" ? Number(row.amount || 0) : 0),
        0,
      )
      return sum + (income - expense)
    }, 0)

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case "day": return "יום"
      case "week": return "שבוע"
      case "month": return `חודש ${selectedMonthNumber}/${selectedYear}`
      case "quarter": return `רבעון ${selectedQuarter} / ${selectedYear}`
      case "year": return `שנה ${selectedYear}`
      default: return period
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "cash": return "מזומן"
      case "credit": return "אשראי"
      case "transfer": return "העברה בנקאית"
      case "check": return "שיק"
      case "bit": return "ביט"
      default: return method
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "rent": return "שכירות"
      case "salary": return "שכר"
      case "utilities": return "חשמל ומים"
      case "equipment": return "ציוד"
      case "maintenance": return "תחזוקה"
      case "other": return "אחר"
      default: return category
    }
  }

  // Get income totals by payment method (only actual payments, not discounts/credits)
  // Note: In DB, paymentType stores the payment method (cash, credit, etc.) or special types (discount, credit)
  const getIncomeByPaymentMethod = (method: "cash" | "credit" | "transfer" | "check" | "bit") => {
    return filteredPayments
      .filter((p) => p.paymentType === method)
      .reduce((sum, p) => sum + Number(p.amount), 0)
  }

  if (expensesLoading || paymentsLoading || envelopesLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center bg-background p-3 sm:p-6" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-4 bg-background p-3 sm:space-y-6 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:mb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 sm:items-center">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/dashboard")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 text-right">
            <h1 className="text-2xl font-bold sm:text-3xl">הכנסות והוצאות</h1>
            <p className="text-sm text-muted-foreground sm:text-base">ניהול תקציב ומעקב פיננסי</p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">יום</SelectItem>
              <SelectItem value="week">שבוע</SelectItem>
              <SelectItem value="month">חודש</SelectItem>
              <SelectItem value="quarter">רבעון</SelectItem>
              <SelectItem value="year">שנה</SelectItem>
            </SelectContent>
          </Select>
          {timePeriod === "month" ? (
            <>
              <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="01">01</SelectItem>
                  <SelectItem value="02">02</SelectItem>
                  <SelectItem value="03">03</SelectItem>
                  <SelectItem value="04">04</SelectItem>
                  <SelectItem value="05">05</SelectItem>
                  <SelectItem value="06">06</SelectItem>
                  <SelectItem value="07">07</SelectItem>
                  <SelectItem value="08">08</SelectItem>
                  <SelectItem value="09">09</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="11">11</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                  <SelectItem value="2029">2029</SelectItem>
                  <SelectItem value="2030">2030</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : null}
          {timePeriod === "quarter" ? (
            <>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">רבעון ראשון</SelectItem>
                  <SelectItem value="2">רבעון שני</SelectItem>
                  <SelectItem value="3">רבעון שלישי</SelectItem>
                  <SelectItem value="4">רבעון רביעי</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                  <SelectItem value="2029">2029</SelectItem>
                  <SelectItem value="2030">2030</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : null}
          {timePeriod === "year" ? (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
                <SelectItem value="2028">2028</SelectItem>
                <SelectItem value="2029">2029</SelectItem>
                <SelectItem value="2030">2030</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-base text-green-700">
              <TrendingUp className="h-4 w-4 shrink-0" />
              סך הכנסות
            </CardTitle>
            <CardDescription className="text-xs text-green-600">
              ב{getTimePeriodLabel(timePeriod)} הנוכחי
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl font-bold text-green-700">₪{totalIncomes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-base text-red-700">
              <TrendingDown className="h-4 w-4 shrink-0" />
              סך הוצאות
            </CardTitle>
            <CardDescription className="text-xs text-red-600">ב{getTimePeriodLabel(timePeriod)} הנוכחי</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl font-bold text-red-700">₪{totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className={balance >= 0 ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className={`text-base ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>יתרה</CardTitle>
            <CardDescription className={`text-xs ${balance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              ב{getTimePeriodLabel(timePeriod)} הנוכחי
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              ₪{balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className={cashBalanceForSelectedMonth >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}>
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className={`text-base ${cashBalanceForSelectedMonth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>קופה</CardTitle>
            <CardDescription className={`text-xs ${cashBalanceForSelectedMonth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              יתרת מעטפות בחודש {selectedMonthNumber}/{selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className={`text-2xl font-bold ${cashBalanceForSelectedMonth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              ₪{cashBalanceForSelectedMonth.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className={yearlyCashBalance >= 0 ? "border-teal-200 bg-teal-50" : "border-rose-200 bg-rose-50"}>
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className={`text-base ${yearlyCashBalance >= 0 ? "text-teal-700" : "text-rose-700"}`}>קופה שנתית</CardTitle>
            <CardDescription className={`text-xs ${yearlyCashBalance >= 0 ? "text-teal-600" : "text-rose-600"}`}>
              סה״כ כל החודשים בשנת {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className={`text-2xl font-bold ${yearlyCashBalance >= 0 ? "text-teal-700" : "text-rose-700"}`}>
              ₪{yearlyCashBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-sm text-purple-700">
              <CreditCard className="h-4 w-4 shrink-0" />
              מזומן
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg font-bold text-purple-700 sm:text-xl">₪{getIncomeByPaymentMethod("cash").toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-sm text-indigo-700">
              <CreditCard className="h-4 w-4 shrink-0" />
              אשראי
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg font-bold text-indigo-700 sm:text-xl">₪{getIncomeByPaymentMethod("credit").toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-sm text-cyan-700">
              <CreditCard className="h-4 w-4 shrink-0" />
              העברה
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg font-bold text-cyan-700 sm:text-xl">₪{getIncomeByPaymentMethod("transfer").toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-teal-200 bg-teal-50">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-sm text-teal-700">
              <CreditCard className="h-4 w-4 shrink-0" />
              שיק
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg font-bold text-teal-700 sm:text-xl">₪{getIncomeByPaymentMethod("check").toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-amber-200 bg-amber-50 sm:col-span-1">
          <CardHeader className="px-3 pb-2 text-right sm:px-6">
            <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-sm text-amber-700">
              <CreditCard className="h-4 w-4 shrink-0" />
              ביט
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-lg font-bold text-amber-700 sm:text-xl">₪{getIncomeByPaymentMethod("bit").toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="expenses" dir="rtl">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
          <TabsTrigger value="expenses">הוצאות</TabsTrigger>
          <TabsTrigger value="incomes">הכנסות</TabsTrigger>
          <TabsTrigger value="envelopes">מעטפות</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <Card className="border-red-200">
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <TrendingDown className="h-5 w-5 shrink-0" />
                הוספת הוצאה חדשה
              </CardTitle>
              <CardDescription>הוסף הוצאה חד-פעמית או קבועה</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-description">תיאור ההוצאה *</Label>
                  <Input
                    id="expense-description"
                    placeholder="לדוגמה: שכר משרד, חשמל, ציוד..."
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-amount">סכום *</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-category">קטגוריה *</Label>
                  <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                    <SelectTrigger id="expense-category">
                      <SelectValue placeholder="בחר קטגוריה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rent">שכירות</SelectItem>
                      <SelectItem value="salary">שכר</SelectItem>
                      <SelectItem value="utilities">חשמל ומים</SelectItem>
                      <SelectItem value="equipment">ציוד</SelectItem>
                      <SelectItem value="maintenance">תחזוקה</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {expenseCategory === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-expense-category">שם הקטגוריה *</Label>
                    <Input
                      id="custom-expense-category"
                      placeholder="הזן שם קטגוריה מותאם אישית"
                      value={customExpenseCategory}
                      onChange={(e) => setCustomExpenseCategory(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expense-date">תאריך</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-payment-method">אופן תשלום *</Label>
                <Select value={expensePaymentMethod} onValueChange={(value: any) => setExpensePaymentMethod(value)}>
                  <SelectTrigger id="expense-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">מזומן</SelectItem>
                    <SelectItem value="credit">אשראי</SelectItem>
                    <SelectItem value="transfer">העברה בנקאית</SelectItem>
                    <SelectItem value="check">שיק</SelectItem>
                    <SelectItem value="bit">ביט</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {expensePaymentMethod === "credit" && (
                <div className="space-y-2">
                  <Label htmlFor="expense-card-digits">4 ספרות אחרונות של הכרטיס *</Label>
                  <Input
                    id="expense-card-digits"
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={expenseCardLastDigits}
                    onChange={(e) => setExpenseCardLastDigits(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              )}

              {(expensePaymentMethod === "transfer" || expensePaymentMethod === "check") && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="expense-bank-name">שם הבנק *</Label>
                    <Select value={expenseBankName} onValueChange={setExpenseBankName}>
                      <SelectTrigger id="expense-bank-name">
                        <SelectValue placeholder="בחר בנק" />
                      </SelectTrigger>
                      <SelectContent>
                        {israeliBanks.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-bank-branch">סניף *</Label>
                    <Input
                      id="expense-bank-branch"
                      type="text"
                      placeholder="מס׳ סניף"
                      value={expenseBankBranch}
                      onChange={(e) => setExpenseBankBranch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-account-number">מס׳ חשבון *</Label>
                    <Input
                      id="expense-account-number"
                      type="text"
                      placeholder="מס׳ חשבון"
                      value={expenseAccountNumber}
                      onChange={(e) => setExpenseAccountNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="recurring"
                  className="mt-0.5 shrink-0"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
                />
                <Label htmlFor="recurring" className="cursor-pointer leading-snug">
                  הוצאה קבועה (חודשית)
                </Label>
              </div>

              {isRecurring && (
                <div className="space-y-2">
                  <Label htmlFor="recurring-day">יום בחודש לחיוב</Label>
                  <Select value={recurringDay} onValueChange={setRecurringDay}>
                    <SelectTrigger id="recurring-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={addExpense} className="w-full bg-red-600 hover:bg-red-700" disabled={isAddingExpense}>
                {isAddingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                הוסף הוצאה
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle>רשימת הוצאות</CardTitle>
              <CardDescription>הוצאות ב{getTimePeriodLabel(timePeriod)} הנוכחי</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {filteredExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  לא נרשמו הוצאות ב{getTimePeriodLabel(timePeriod)} הנוכחי
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 lg:hidden">
                    {filteredExpenses.map((expense) => (
                      <Card key={expense.id} className="border bg-card shadow-sm">
                        <CardContent className="space-y-3 p-4 text-right">
                          <div className="break-words font-medium">{formatExpenseDescription(expense.description)}</div>
                          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground">
                            <span>{getCategoryLabel(expense.category)}</span>
                            <span>{new Date(expense.date).toLocaleDateString("he-IL")}</span>
                            <span>{getPaymentMethodLabel(expense.paymentMethod)}</span>
                          </div>
                          <div className="text-xl font-bold text-red-600">₪{Number(expense.amount).toLocaleString()}</div>
                          <div>
                            {expense.isRecurring ? (
                              <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700">
                                קבוע - יום {expense.recurringDay}
                              </span>
                            ) : (
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">חד פעמי</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            בוצע על ידי: {expense.createdByUserName ?? "—"}
                          </div>
                          <Button
                            variant="outline"
                            className="w-full gap-2 text-red-600 hover:bg-red-50"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            מחק הוצאה
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="hidden w-full overflow-x-auto lg:block">
                    <Table className="min-w-[920px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תיאור</TableHead>
                          <TableHead className="text-right">קטגוריה</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סוג</TableHead>
                          <TableHead className="text-right">אופן תשלום</TableHead>
                          <TableHead className="text-right">בוצע על ידי</TableHead>
                          <TableHead className="text-right">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="max-w-[220px] font-medium break-words">
                              {formatExpenseDescription(expense.description)}
                            </TableCell>
                            <TableCell>{getCategoryLabel(expense.category)}</TableCell>
                            <TableCell className="font-semibold text-red-600">₪{Number(expense.amount).toLocaleString()}</TableCell>
                            <TableCell>{new Date(expense.date).toLocaleDateString("he-IL")}</TableCell>
                            <TableCell>
                              {expense.isRecurring ? (
                                <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700">
                                  קבוע - יום {expense.recurringDay}
                                </span>
                              ) : (
                                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">חד פעמי</span>
                              )}
                            </TableCell>
                            <TableCell>{getPaymentMethodLabel(expense.paymentMethod)}</TableCell>
                            <TableCell className="text-muted-foreground">{expense.createdByUserName ?? "—"}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incomes" className="space-y-4">
          <Card className="border-green-200">
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
                <TrendingUp className="h-5 w-5 shrink-0" />
                הוספת הכנסה חדשה
              </CardTitle>
              <CardDescription>רשום הכנסה מתלמיד, בית ספר או מקור אחר</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="income-type">סוג ההכנסה *</Label>
                  <Select
                    value={incomeType}
                    onValueChange={(value: any) => {
                      setIncomeType(value)
                      setSelectedStudentId("")
                      setSelectedCourseId("")
                      setSelectedSchoolId("")
                      setCustomName("")
                    }}
                  >
                    <SelectTrigger id="income-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">תלמיד</SelectItem>
                      <SelectItem value="course">קורס → תלמיד</SelectItem>
                      <SelectItem value="school">בית ספר</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {incomeType === "student" && (
                  <div className="space-y-2">
                    <Label htmlFor="student-select">בחר תלמיד *</Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger id="student-select">
                        <SelectValue placeholder="בחר תלמיד מהרשימה" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.length === 0 ? (
                          <SelectItem value="none" disabled>
                            אין תלמידים במערכת
                          </SelectItem>
                        ) : (
                          students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {getStudentDisplayName(student)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {incomeType === "course" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="course-select">בחר קורס *</Label>
                      <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setSelectedStudentId("") }}>
                        <SelectTrigger id="course-select">
                          <SelectValue placeholder="בחר קורס" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.length === 0 ? (
                            <SelectItem value="none" disabled>אין קורסים במערכת</SelectItem>
                          ) : (
                            courses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-by-course-select">בחר תלמיד משויך לקורס *</Label>
                      <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedCourseId}>
                        <SelectTrigger id="student-by-course-select">
                          <SelectValue placeholder={selectedCourseId ? "בחר תלמיד" : "בחר קורס קודם"} />
                        </SelectTrigger>
                        <SelectContent>
                          {!selectedCourseId ? (
                            <SelectItem value="none" disabled>בחר קורס קודם</SelectItem>
                          ) : studentsInSelectedCourse.length === 0 ? (
                            <SelectItem value="none" disabled>אין תלמידים רשומים בקורס זה</SelectItem>
                          ) : (
                            studentsInSelectedCourse.map((e) => (
                              <SelectItem key={`${e.courseId}-${e.studentId}`} value={e.studentId}>
                                {getStudentDisplayName(e)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {incomeType === "school" && (
                  <div className="space-y-2">
                    <Label htmlFor="school-select">בחר בית ספר *</Label>
                    <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                      <SelectTrigger id="school-select">
                        <SelectValue placeholder="בחר בית ספר מהרשימה" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.length === 0 ? (
                          <SelectItem value="none" disabled>
                            אין בתי ספר במערכת
                          </SelectItem>
                        ) : (
                          schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {incomeType === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-name">שם המקור *</Label>
                    <Input
                      id="custom-name"
                      placeholder="הזן שם..."
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="income-description">תיאור *</Label>
                  <Input
                    id="income-description"
                    placeholder="לדוגמה: תשלום עבור קורס רובוטיקה..."
                    value={incomeDescription}
                    onChange={(e) => setIncomeDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="income-amount">סכום *</Label>
                  <Input
                    id="income-amount"
                    type="number"
                    placeholder="0.00"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="income-date">תאריך</Label>
                  <Input
                    id="income-date"
                    type="date"
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">אופן תשלום *</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">מזומן</SelectItem>
                      <SelectItem value="credit">אשראי</SelectItem>
                      <SelectItem value="transfer">העברה בנקאית</SelectItem>
                      <SelectItem value="check">שיק</SelectItem>
                      <SelectItem value="bit">ביט</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {paymentMethod === "credit" && (
                <div className="space-y-2">
                  <Label htmlFor="card-digits">4 ספרות אחרונות של כרטיס *</Label>
                  <Input
                    id="card-digits"
                    placeholder="1234"
                    maxLength={4}
                    value={cardLastDigits}
                    onChange={(e) => setCardLastDigits(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              )}

              {(paymentMethod === "transfer" || paymentMethod === "check") && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">בנק *</Label>
                    <Select value={bankName} onValueChange={setBankName}>
                      <SelectTrigger id="bank-name">
                        <SelectValue placeholder="בחר בנק" />
                      </SelectTrigger>
                      <SelectContent>
                        {israeliBanks.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-branch">סניף *</Label>
                    <Input
                      id="bank-branch"
                      placeholder="מספר סניף"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number">מס׳ חשבון *</Label>
                    <Input
                      id="account-number"
                      placeholder="מספר חשבון"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button onClick={addIncome} className="w-full bg-green-600 hover:bg-green-700" disabled={isAddingIncome}>
                {isAddingIncome ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                הוסף הכנסה
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle>רשימת הכנסות</CardTitle>
              <CardDescription>הכנסות ב{getTimePeriodLabel(timePeriod)} הנוכחי</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {filteredPayments.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  לא נרשמו הכנסות ב{getTimePeriodLabel(timePeriod)} הנוכחי
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 lg:hidden">
                    {filteredPayments.map((payment) => {
                      const sourceLabel = payment.studentName
                        ? payment.studentName
                        : payment.student
                          ? `${payment.student.firstName} ${payment.student.lastName}`
                          : payment.school
                            ? payment.school.name
                            : "-"
                      return (
                        <Card key={payment.id} className="border bg-card shadow-sm">
                          <CardContent className="space-y-3 p-4 text-right">
                            <div className="break-words font-medium">{payment.description || "—"}</div>
                            <div className="text-sm text-muted-foreground">מקור: {sourceLabel}</div>
                            <div className="flex flex-wrap justify-end gap-2 text-sm text-muted-foreground">
                              <span>{getPaymentMethodLabel(payment.paymentType)}</span>
                              <span>
                                {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("he-IL") : "-"}
                              </span>
                            </div>
                            <div className="text-xl font-bold text-green-600">₪{Number(payment.amount).toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">בוצע על ידי: {payment.createdByUserName ?? "—"}</div>
                            <Button
                              variant="outline"
                              className="w-full gap-2 text-red-600 hover:bg-red-50"
                              onClick={() => deleteIncome(payment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              מחק הכנסה
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                  <div className="hidden w-full overflow-x-auto lg:block">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תיאור</TableHead>
                          <TableHead className="text-right">מקור</TableHead>
                          <TableHead className="text-right">אופן תשלום</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">בוצע על ידי</TableHead>
                          <TableHead className="text-right">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="max-w-[200px] break-words font-medium">{payment.description || "-"}</TableCell>
                            <TableCell>
                              {payment.studentName
                                ? payment.studentName
                                : payment.student
                                  ? `${payment.student.firstName} ${payment.student.lastName}`
                                  : payment.school
                                    ? payment.school.name
                                    : "-"}
                            </TableCell>
                            <TableCell>{getPaymentMethodLabel(payment.paymentType)}</TableCell>
                            <TableCell className="font-semibold text-green-600">₪{Number(payment.amount).toLocaleString()}</TableCell>
                            <TableCell>
                              {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("he-IL") : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{payment.createdByUserName ?? "—"}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteIncome(payment.id)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="envelopes" className="space-y-4">
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="order-2 sm:order-1">
                  <CardTitle>מעטפות</CardTitle>
                  <CardDescription>ניהול מעטפות חודשי לפי סכום יעד ותנועות</CardDescription>
                </div>
                <div className="order-1 flex flex-wrap items-center gap-2 sm:order-2">
                  <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-700">
                    סכום מעטפות: ₪{filteredEnvelopesTargetSum.toLocaleString()}
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                    הכנסות: ₪{filteredEnvelopesIncomeSum.toLocaleString()}
                  </div>
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-700">
                    הוצאות: ₪{filteredEnvelopesExpenseSum.toLocaleString()}
                  </div>
                  <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-sm font-semibold text-violet-700">
                    יתרה: ₪{filteredEnvelopesBalance.toLocaleString()}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEnvelopeMonthKey(new Date().toISOString().slice(0, 10))
                      setEnvelopeTargetAmount("")
                      setIsEnvelopeCreateDialogOpen(true)
                    }}
                  >
                    הוסף מעטפה
                  </Button>
                  <Label className="text-sm">חודש:</Label>
                  <Select value={envelopeMonthFilter} onValueChange={setEnvelopeMonthFilter}>
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">01</SelectItem>
                      <SelectItem value="02">02</SelectItem>
                      <SelectItem value="03">03</SelectItem>
                      <SelectItem value="04">04</SelectItem>
                      <SelectItem value="05">05</SelectItem>
                      <SelectItem value="06">06</SelectItem>
                      <SelectItem value="07">07</SelectItem>
                      <SelectItem value="08">08</SelectItem>
                      <SelectItem value="09">09</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="11">11</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              {filteredEnvelopesByMonth.length === 0 ? (
                <div className="rounded-md border p-4 text-right text-muted-foreground">אין מעטפות עדיין</div>
              ) : (
                <div className="space-y-4">
                  {filteredEnvelopesByMonth.map((env) => {
                    const rows = Array.isArray(env.rows) ? env.rows : []
                    const targetEnv = Number(env.targetAmount || 0)
                    const incomeEnv = rows.reduce((s, r) => s + (String(r.type || "expense") === "income" ? Number(r.amount || 0) : 0), 0)
                    const expenseEnv = rows.reduce((s, r) => s + (String(r.type || "expense") === "expense" ? Number(r.amount || 0) : 0), 0)
                    const rowsSumEnv = incomeEnv - expenseEnv
                    const balanceEnv = incomeEnv - expenseEnv
                    const isOpen = openedEnvelopeId === env.id
                    return (
                      <Card key={env.id}>
                        <CardHeader className="px-3 pb-2 text-right sm:px-6">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div
                              className="cursor-pointer space-y-1"
                              onClick={() => setOpenedEnvelopeId((prev) => (prev === env.id ? "" : env.id))}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="text-base">מעטפה לחודש: {formatDateDDMMYYYY(env.monthKey)}</CardTitle>
                                <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">סכום במעטפה: ₪{targetEnv.toLocaleString()}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-700">סכום בטבלה: ₪{rowsSumEnv.toLocaleString()}</span>
                                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">הכנסות: ₪{incomeEnv.toLocaleString()}</span>
                                <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">הוצאות: ₪{expenseEnv.toLocaleString()}</span>
                                <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">יתרה: ₪{balanceEnv.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setActiveEnvelopeId(env.id)
                                  setEnvelopeRowDate(new Date().toISOString().slice(0, 10))
                                  setEnvelopeRowAmount("")
                                  setEnvelopeRowType("income")
                                  setEnvelopeRowName("")
                                  setEnvelopeRowNotes("")
                                  setEditingEnvelopeRowIndex(null)
                                  setIsEnvelopeRowDialogOpen(true)
                                }}
                              >
                                הוסף שורה
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditEnvelopeDialog(env)}
                                aria-label="עריכת מעטפה"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => deleteEnvelope(env.id)}
                                aria-label="מחיקת מעטפה"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpenedEnvelopeId((prev) => (prev === env.id ? "" : env.id))}
                                aria-label={isOpen ? "סגירת מעטפה" : "פתיחת מעטפה"}
                              >
                                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isOpen ? (
                          <CardContent className="space-y-3 px-3 sm:px-6">
                            <div className="overflow-x-auto rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-right">תאריך</TableHead>
                                    <TableHead className="text-right">סוג</TableHead>
                                    <TableHead className="text-right">שם</TableHead>
                                    <TableHead className="text-right">סכום</TableHead>
                                    <TableHead className="text-right">הערות</TableHead>
                                    <TableHead className="text-right">פעולות</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center text-muted-foreground">אין שורות במעטפה זו</TableCell>
                                    </TableRow>
                                  ) : rows.map((r, idx) => (
                                    <TableRow
                                      key={`${env.id}-r-${idx}`}
                                      className={String(r.type || "expense") === "expense" ? "bg-rose-50/70" : ""}
                                    >
                                      <TableCell>{formatDateDDMMYYYY(r.date)}</TableCell>
                                      <TableCell>{String(r.type || "expense") === "income" ? "הכנסה" : "הוצאה"}</TableCell>
                                      <TableCell>{r.name || "—"}</TableCell>
                                      <TableCell>₪{Number(r.amount || 0).toLocaleString()}</TableCell>
                                      <TableCell>{r.notes || "—"}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                              setActiveEnvelopeId(env.id)
                                              setEnvelopeRowDate(r.date || new Date().toISOString().slice(0, 10))
                                              setEnvelopeRowAmount(String(Number(r.amount || 0)))
                                              setEnvelopeRowType(String(r.type || "expense") === "income" ? "income" : "expense")
                                              setEnvelopeRowName(r.name || "")
                                              setEnvelopeRowNotes(r.notes || "")
                                              setEditingEnvelopeRowIndex(idx)
                                              setIsEnvelopeRowDialogOpen(true)
                                            }}
                                            aria-label="עריכת שורה"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => deleteEnvelopeRow(env, idx)}
                                            aria-label="מחיקת שורה"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        ) : null}
                      </Card>
                    )
                  })}
                </div>
              )}

              <Dialog open={isEnvelopeRowDialogOpen} onOpenChange={setIsEnvelopeRowDialogOpen}>
                <DialogContent dir="rtl" className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingEnvelopeRowIndex === null ? "הוספת שורה למעטפה" : "עריכת שורה במעטפה"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                    <Input type="date" value={envelopeRowDate} onChange={(e) => setEnvelopeRowDate(e.target.value)} />
                    <Input type="number" min={0} placeholder="סכום" value={envelopeRowAmount} onChange={(e) => setEnvelopeRowAmount(e.target.value)} />
                    <Select value={envelopeRowType} onValueChange={(v: "income" | "expense") => setEnvelopeRowType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">הכנסה</SelectItem>
                        <SelectItem value="expense">הוצאה</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="שם" value={envelopeRowName} onChange={(e) => setEnvelopeRowName(e.target.value)} />
                    <Input placeholder="הערות" value={envelopeRowNotes} onChange={(e) => setEnvelopeRowNotes(e.target.value)} />
                  </div>
                  <Button
                    disabled={!activeEnvelope || isSavingEnvelopeRow}
                    onClick={() => activeEnvelope && addEnvelopeRow(activeEnvelope)}
                  >
                    {isSavingEnvelopeRow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingEnvelopeRowIndex === null ? "הוסף שורה" : "שמור שינויים"}
                  </Button>
                </DialogContent>
              </Dialog>

              <Dialog open={isEnvelopeEditDialogOpen} onOpenChange={setIsEnvelopeEditDialogOpen}>
                <DialogContent dir="rtl" className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>עריכת מעטפה</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>תאריך לכותרת המעטפה</Label>
                      <Input type="date" value={editEnvelopeMonthKey} onChange={(e) => setEditEnvelopeMonthKey(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>סכום מעטפה</Label>
                      <Input type="number" min={0} value={editEnvelopeTargetAmount} onChange={(e) => setEditEnvelopeTargetAmount(e.target.value)} />
                    </div>
                    <Button onClick={saveEnvelopeDetails}>שמור מעטפה</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isEnvelopeCreateDialogOpen} onOpenChange={setIsEnvelopeCreateDialogOpen}>
                <DialogContent dir="rtl" className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>הוספת מעטפה</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>תאריך לכותרת המעטפה</Label>
                      <Input type="date" value={envelopeMonthKey} onChange={(e) => setEnvelopeMonthKey(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>סכום מעטפה</Label>
                      <Input type="number" min={0} value={envelopeTargetAmount} onChange={(e) => setEnvelopeTargetAmount(e.target.value)} />
                    </div>
                    <Button disabled={isAddingEnvelope} onClick={createEnvelope}>
                      {isAddingEnvelope ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      הוסף מעטפה
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
