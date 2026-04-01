"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/i18n/context"
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle, XCircle } from "lucide-react"
import { ENTITY_FIELDS, getFieldLabel, type EntityType } from "@/lib/import/entity-fields"

const ENTITY_OPTIONS: { value: EntityType; labelKey: string }[] = [
  { value: "students", labelKey: "import.students" },
  { value: "teachers", labelKey: "import.teachers" },
  { value: "payments", labelKey: "import.payments" },
]

const IGNORE_KEY = "__ignore__"
const MAX_FILE_SIZE = 20 * 1024 * 1024

export function ImportFromExcel() {
  const { t, locale } = useLanguage()
  const { toast } = useToast()
  const lang = locale === "en" ? "en" : "he"

  const [entity, setEntity] = useState<EntityType>("students")
  const [file, setFile] = useState<File | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>("")
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [parseLoading, setParseLoading] = useState(false)
  const [validation, setValidation] = useState<{
    valid: boolean
    missingRequiredMappings: string[]
    duplicateMappings: string[]
    rowValidations: { rowIndex: number; errors: string[] }[]
  } | null>(null)
  const [importMode, setImportMode] = useState<"create" | "upsert">("create")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    created: number
    updated: number
    skipped: number
    failed: number
    errorFileUrl?: string
  } | null>(null)

  const systemFields = ENTITY_FIELDS[entity]
  const mappingOptions = [
    { value: IGNORE_KEY, label: t("import.ignoreColumn") },
    ...systemFields.map((f) => ({ value: f.internalKey, label: getFieldLabel(f, lang) })),
  ]

  const downloadTemplate = useCallback(
    (langTemplate: "he" | "en") => {
      const url = `/api/import/templates?entity=${entity}&lang=${langTemplate}`
      window.open(url, "_blank")
    },
    [entity]
  )

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: t("import.fileTooLarge"), variant: "destructive" })
      return
    }
    const name = f.name.toLowerCase()
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      toast({ title: t("import.onlyExcelCsv"), variant: "destructive" })
      return
    }
    setFile(f)
    setSheetNames([])
    setColumns([])
    setRows([])
    setMapping({})
    setValidation(null)
    setImportResult(null)
  }, [t, toast])

  const parseFile = useCallback(async () => {
    if (!file) return
    setParseLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      if (selectedSheet) form.append("selectedSheet", selectedSheet)
      const res = await fetch("/api/import/parse", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = (data.message && typeof data.message === "string") ? data.message : (data.error ? t(data.error as "errors.forbidden") : t("import.parseError"))
        toast({ title: msg, variant: "destructive" })
        return
      }
      setSheetNames(data.sheetNames || [])
      setColumns(data.columns || [])
      setRows(data.rows || [])
      if (data.sheetNames?.length && !selectedSheet) setSelectedSheet(data.sheetNames[0])
      setMapping({})
      setValidation(null)
      setImportResult(null)
    } finally {
      setParseLoading(false)
    }
  }, [file, selectedSheet, t, toast])

  const setMappingForColumn = useCallback((excelCol: string, value: string) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (value === IGNORE_KEY) {
        delete next[excelCol]
      } else {
        next[excelCol] = value
      }
      return next
    })
    setValidation(null)
  }, [])

  const validatePreview = useCallback(async () => {
    if (rows.length === 0) {
      toast({ title: t("import.uploadAndParseFirst"), variant: "destructive" })
      return
    }
    const res = await fetch("/api/import/validate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, mapping, rows }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || "Validation failed", variant: "destructive" })
      return
    }
    setValidation({
      valid: data.valid,
      missingRequiredMappings: data.missingRequiredMappings || [],
      duplicateMappings: data.duplicateMappings || [],
      rowValidations: data.rowValidations || [],
    })
  }, [entity, mapping, rows, t, toast])

  const runImport = useCallback(async () => {
    if (!file || rows.length === 0) {
      toast({ title: t("import.uploadAndParseFirst"), variant: "destructive" })
      return
    }
    if (validation && !validation.valid) {
      toast({ title: t("import.fixValidationFirst"), variant: "destructive" })
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("entity", entity)
      form.append("mode", importMode)
      form.append("mapping", JSON.stringify(mapping))
      if (selectedSheet) form.append("selectedSheet", selectedSheet)
      form.append("lang", lang)
      const res = await fetch("/api/import/execute", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || t("import.importFailed"), variant: "destructive" })
        return
      }
      setImportResult({
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        errorFileUrl: data.errorFileUrl,
      })
      toast({ title: t("import.importDone") })
    } finally {
      setImporting(false)
    }
  }, [file, rows.length, validation, entity, importMode, mapping, selectedSheet, lang, t, toast])

  return (
    <Card>
      <CardHeader className="px-3 text-right sm:px-6">
        <CardTitle className="flex flex-row-reverse items-center justify-end gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          {t("import.tabTitle")}
        </CardTitle>
        <CardDescription className="text-right">{t("import.tabDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-3 sm:px-6" dir={locale === "en" ? "ltr" : "rtl"}>
        {/* A) Entity + Template download */}
        <div className="space-y-2">
          <Label>{t("import.importType")}</Label>
          <Select value={entity} onValueChange={(v) => setEntity(v as EntityType)}>
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("import.downloadTemplate")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => downloadTemplate("he")}>
              <Download className="ml-2 h-4 w-4" />
              {t("import.templateHebrew")}
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => downloadTemplate("en")}>
              <Download className="ml-2 h-4 w-4" />
              {t("import.templateEnglish")}
            </Button>
          </div>
        </div>

        {/* C) Upload */}
        <div className="space-y-2">
          <Label>{t("import.uploadFile")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="w-full min-w-0 text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
            />
            {file && (
              <span className="break-all text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
          {sheetNames.length > 1 && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <Label className="text-muted-foreground">{t("import.selectSheet")}</Label>
              <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheetNames.map((s, i) => (
                    <SelectItem key={s ? `sheet-${s}` : `sheet-idx-${i}`} value={s}>
                      {s || `(גיליון ${i + 1})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="button" className="w-full sm:w-auto" onClick={parseFile} disabled={!file || parseLoading}>
            {parseLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            {t("import.parseFile")}
          </Button>
        </div>

        {/* D) Manual mapping */}
        {columns.length > 0 && (
          <div className="space-y-2">
            <Label>{t("import.columnMapping")}</Label>
            <p className="text-sm text-muted-foreground">{t("import.columnMappingHint")}</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[300px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-2">{t("import.excelColumn")}</th>
                    <th className="text-right p-2">{t("import.mapToSystemField")}</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, colIdx) => (
                    <tr key={`col-${colIdx}`} className="border-b">
                      <td className="p-2 font-medium" dir="ltr">{col || "\u00A0"}</td>
                      <td className="p-2">
                        <Select
                          value={mapping[col] ?? IGNORE_KEY}
                          onValueChange={(v) => setMappingForColumn(col, v)}
                        >
                          <SelectTrigger className="w-full min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mappingOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={validatePreview}>
              {t("import.validatePreview")}
            </Button>
          </div>
        )}

        {/* Validation errors */}
        {validation && !validation.valid && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            {validation.missingRequiredMappings.length > 0 && (
              <p className="text-destructive">
                {t("import.missingRequired")}: {validation.missingRequiredMappings.join(", ")}
              </p>
            )}
            {validation.duplicateMappings.length > 0 && (
              <p className="text-destructive">
                {t("import.duplicateMappings")}: {validation.duplicateMappings.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* E) Preview */}
        {rows.length > 0 && validation && (
          <div className="space-y-2">
            <Label>{t("import.preview")} (10)</Label>
            <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-md border">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="border-b">
                    <th className="p-2 w-12">#</th>
                    {systemFields.filter((f) => Object.values(mapping).includes(f.internalKey)).map((f) => (
                      <th key={f.internalKey} className="p-2 text-right">{getFieldLabel(f, lang)}</th>
                    ))}
                    <th className="p-2 text-right">{t("import.errors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const rowVal = validation.rowValidations[i]
                    const errs = rowVal?.errors ?? []
                    return (
                      <tr key={i} className={errs.length ? "bg-destructive/10" : ""}>
                        <td className="p-2">{i + 1}</td>
                        {systemFields.filter((f) => Object.values(mapping).includes(f.internalKey)).map((f) => {
                          const excelCol = Object.entries(mapping).find(([, v]) => v === f.internalKey)?.[0]
                          const val = excelCol ? row[excelCol] : ""
                          return (
                            <td key={f.internalKey} className="p-2" dir="ltr">
                              {String(val ?? "")}
                            </td>
                          )
                        })}
                        <td className="p-2 text-destructive text-xs">{errs.join("; ")}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* F) Import mode + Execute */}
        {columns.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("import.importMode")}</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as "create" | "upsert")}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">{t("import.createOnly")}</SelectItem>
                  <SelectItem value="upsert">{t("import.upsert")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={runImport}
              disabled={importing || (validation !== null && !validation.valid)}
            >
              {importing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              {t("import.runImport")}
            </Button>
          </div>
        )}

        {/* Summary */}
        {importResult && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <h4 className="font-medium">{t("import.summary")}</h4>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" /> {t("import.created")}: {importResult.created}
              </span>
              <span className="flex items-center gap-1 text-blue-600">
                {t("import.updated")}: {importResult.updated}
              </span>
              <span className="text-muted-foreground">{t("import.skipped")}: {importResult.skipped}</span>
              {(importResult.failed ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" /> {t("import.failed")}: {importResult.failed}
                </span>
              )}
            </div>
            {importResult.errorFileUrl && (
              <a
                href={importResult.errorFileUrl}
                download
                className="text-sm text-primary underline"
              >
                {t("import.downloadErrorFile")}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
