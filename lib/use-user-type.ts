"use client"

import { useEffect, useState, useRef } from "react"
import { hasFullAccessRole } from "@/lib/permissions"

interface UserTypeData {
  isTeacher: boolean
  isStudent: boolean
  teacherId?: string
  studentId?: string
  courseIds?: string[]
  /** קורסים שהמורה משויך אליהם (לסרגל ניווט) */
  teacherCourses?: { id: string; name: string }[]
  checkedAt?: number
}

const CACHE_KEY = "user-type-cache"
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

function isAdminRole(role?: string): boolean {
  return hasFullAccessRole(role)
}

// Retry only on 429 (rate limit). On 404 returns immediately – never loops.
async function fetchWithRetry(url: string, maxRetries = 3, delayMs = 1000): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url)
    if (res.status !== 429) return res
    await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
  }
  return fetch(url)
}

function getCachedUserType(userId: string | number): UserTypeData | null {
  if (typeof window === "undefined" || userId === undefined || userId === null) return null
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY}-${userId}`)
    if (cached) {
      const parsed = JSON.parse(cached) as UserTypeData
      if (parsed.checkedAt && Date.now() - parsed.checkedAt < CACHE_DURATION) return parsed
    }
  } catch (e) {}
  return null
}

/**
 * Determines whether the current user is linked to a teacher or student record.
 *
 * Pass `role` so that admin/owner users bypass the by-user API calls entirely –
 * they are never students or teachers, so making those requests only causes
 * unnecessary latency and redirect loops.
 */
export function useUserType(userId: string | number | undefined, role?: string) {
  const adminShortCircuit = isAdminRole(role)

  const [data, setData] = useState<UserTypeData | null>(() => {
    if (adminShortCircuit) return { isTeacher: false, isStudent: false, checkedAt: Date.now() }
    return getCachedUserType(userId as string | number)
  })
  const [loading, setLoading] = useState(() => {
    if (adminShortCircuit) return false
    return !getCachedUserType(userId as string | number)
  })

  const fetchStartedRef = useRef(false)
  const lastUserIdRef = useRef<string | number | undefined>(undefined)

  useEffect(() => {
    // Admins are never teachers or students – skip all API calls immediately.
    if (isAdminRole(role)) {
      const adminResult: UserTypeData = { isTeacher: false, isStudent: false, checkedAt: Date.now() }
      setData(adminResult)
      setLoading(false)
      return
    }

    if (!userId) {
      setLoading(false)
      return
    }

    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId
      fetchStartedRef.current = false
    }

    // Use cached data immediately for fast UI, but keep revalidating in background
    // so new teacher/student links (e.g. newly assigned courses) appear without re-login.
    const cached = getCachedUserType(userId)
    if (cached) {
      setData(cached)
      setLoading(false)
    }

    if (fetchStartedRef.current) return
    fetchStartedRef.current = true

    const checkUserType = async () => {
      let result: UserTypeData = { isTeacher: false, isStudent: false, checkedAt: Date.now() }

      try {
        // Check teacher link
        const teacherRes = await fetchWithRetry(`/api/teachers/by-user/${userId}`)

        // 404 means no teacher record – not an error, just not a teacher
        if (teacherRes.ok) {
          try {
            const teacherData = await teacherRes.json()
            if (teacherData?.id) {
              const rawCourses = Array.isArray(teacherData.courses) ? teacherData.courses : []
              const teacherCourses = rawCourses
                .filter((c: { id?: string }) => c && typeof c.id === "string")
                .map((c: { id: string; name?: string }) => ({
                  id: c.id,
                  name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "קורס",
                }))
              const courseIds: string[] = Array.isArray(teacherData.courseIds)
                ? teacherData.courseIds
                : teacherCourses.map((c) => c.id)
              result = {
                isTeacher: true,
                isStudent: false,
                teacherId: teacherData.id,
                courseIds,
                teacherCourses: teacherCourses.length ? teacherCourses : undefined,
                checkedAt: Date.now(),
              }
              sessionStorage.setItem(`${CACHE_KEY}-${userId}`, JSON.stringify(result))
              setData(result)
              setLoading(false)
              return
            }
          } catch {
            // JSON parse error – continue
          }
        }

        // Check student link
        const studentRes = await fetchWithRetry(`/api/students/by-user/${userId}`)

        if (studentRes.ok) {
          try {
            const studentData = await studentRes.json()
            if (studentData?.id) {
              result = {
                isTeacher: false,
                isStudent: true,
                studentId: studentData.id,
                courseIds: studentData.courseIds || [],
                checkedAt: Date.now(),
              }
              sessionStorage.setItem(`${CACHE_KEY}-${userId}`, JSON.stringify(result))
              setData(result)
              setLoading(false)
              return
            }
          } catch {
            // JSON parse error – use default
          }
        }

        // Neither teacher nor student
        sessionStorage.setItem(`${CACHE_KEY}-${userId}`, JSON.stringify(result))
        setData(result)
        setLoading(false)
      } catch (error) {
        console.error("[useUserType] Error checking user type:", error)
        setData(result)
        setLoading(false)
      }
    }

    checkUserType()
  // Intentionally excludes `data` from deps to prevent re-trigger loop after setData.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role])

  return { data, loading }
}

// Clear cache on logout
export function clearUserTypeCache() {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY)) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (e) {}
}
