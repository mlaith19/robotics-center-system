-- Preview only (no UPDATE):
-- Find legacy payments without courseId that can be linked safely to a course
-- using exact description pattern + student enrollment in that course.

WITH payment_course_name AS (
  SELECT
    p.id AS payment_id,
    p."studentId",
    p.amount,
    p."paymentDate",
    p.description,
    CASE
      WHEN p.description LIKE 'תשלום לקורס: %' THEN btrim(substr(p.description, length('תשלום לקורס: ') + 1))
      WHEN p.description LIKE 'Payment for course: %' THEN btrim(substr(p.description, length('Payment for course: ') + 1))
      ELSE NULL
    END AS parsed_course_name
  FROM "Payment" p
  WHERE p."courseId" IS NULL
    AND p."studentId" IS NOT NULL
    AND p.description IS NOT NULL
    AND (
      p.description LIKE 'תשלום לקורס: %'
      OR p.description LIKE 'Payment for course: %'
    )
),
candidate_matches AS (
  SELECT
    pc.payment_id,
    pc."studentId",
    pc.amount,
    pc."paymentDate",
    pc.description,
    pc.parsed_course_name,
    c.id AS candidate_course_id,
    c.name AS candidate_course_name
  FROM payment_course_name pc
  JOIN "Course" c
    ON c.name = pc.parsed_course_name
  JOIN "Enrollment" e
    ON e."studentId" = pc."studentId"
   AND e."courseId" = c.id
),
match_stats AS (
  SELECT
    cm.payment_id,
    COUNT(*) AS candidate_count
  FROM candidate_matches cm
  GROUP BY cm.payment_id
)

-- 1) Safe link candidates (exactly one match)
SELECT
  cm.payment_id,
  cm."studentId",
  cm.amount,
  cm."paymentDate",
  cm.description,
  cm.candidate_course_id AS suggested_course_id,
  cm.candidate_course_name AS suggested_course_name
FROM candidate_matches cm
JOIN match_stats ms
  ON ms.payment_id = cm.payment_id
WHERE ms.candidate_count = 1
ORDER BY cm."paymentDate" DESC, cm.payment_id;

-- 2) Ambiguous rows (more than one possible course)
SELECT
  cm.payment_id,
  cm."studentId",
  cm.amount,
  cm."paymentDate",
  cm.description,
  ms.candidate_count,
  string_agg(cm.candidate_course_name || ' [' || cm.candidate_course_id || ']', ', ' ORDER BY cm.candidate_course_name) AS candidate_courses
FROM candidate_matches cm
JOIN match_stats ms
  ON ms.payment_id = cm.payment_id
WHERE ms.candidate_count > 1
GROUP BY cm.payment_id, cm."studentId", cm.amount, cm."paymentDate", cm.description, ms.candidate_count
ORDER BY cm."paymentDate" DESC, cm.payment_id;

-- 3) Legacy rows with pattern but no enrollment-based match
SELECT
  pc.payment_id,
  pc."studentId",
  pc.amount,
  pc."paymentDate",
  pc.description,
  pc.parsed_course_name
FROM payment_course_name pc
LEFT JOIN candidate_matches cm
  ON cm.payment_id = pc.payment_id
WHERE cm.payment_id IS NULL
ORDER BY pc."paymentDate" DESC, pc.payment_id;

-- 4) Distinct students list by matching status
SELECT DISTINCT
  s.id AS student_id,
  s.name AS student_name,
  'safe_match' AS match_status
FROM candidate_matches cm
JOIN match_stats ms
  ON ms.payment_id = cm.payment_id
JOIN "Student" s
  ON s.id = cm."studentId"
WHERE ms.candidate_count = 1

UNION

SELECT DISTINCT
  s.id AS student_id,
  s.name AS student_name,
  'ambiguous_match' AS match_status
FROM candidate_matches cm
JOIN match_stats ms
  ON ms.payment_id = cm.payment_id
JOIN "Student" s
  ON s.id = cm."studentId"
WHERE ms.candidate_count > 1

UNION

SELECT DISTINCT
  s.id AS student_id,
  s.name AS student_name,
  'no_match' AS match_status
FROM payment_course_name pc
LEFT JOIN candidate_matches cm
  ON cm.payment_id = pc.payment_id
JOIN "Student" s
  ON s.id = pc."studentId"
WHERE cm.payment_id IS NULL
ORDER BY match_status, student_name;
