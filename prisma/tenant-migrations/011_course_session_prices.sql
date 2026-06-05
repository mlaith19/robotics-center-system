-- מחיר לפי מפגש (מפתח = תאריך YYYY-MM-DD) לקורסים עם תמחור _session
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "sessionPrices" JSONB NOT NULL DEFAULT '{}'::jsonb;
