-- Apply only safe matches (no ambiguous updates):
-- Updates Payment.courseId for legacy rows (courseId IS NULL)
-- when there is exactly one valid match by:
-- 1) parsed course name from description
-- 2) student is enrolled in that course

WITH payment_course_name AS (
  SELECT
    p.id AS payment_id,
    p."studentId",
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
    c.id AS candidate_course_id
  FROM payment_course_name pc
  JOIN "Course" c
    ON c.name = pc.parsed_course_name
  JOIN "Enrollment" e
    ON e."studentId" = pc."studentId"
   AND e."courseId" = c.id
),
safe_matches AS (
  SELECT
    cm.payment_id,
    MIN(cm.candidate_course_id) AS course_id
  FROM candidate_matches cm
  GROUP BY cm.payment_id
  HAVING COUNT(*) = 1
)
UPDATE "Payment" p
SET "courseId" = sm.course_id
FROM safe_matches sm
WHERE p.id = sm.payment_id
  AND p."courseId" IS NULL;
