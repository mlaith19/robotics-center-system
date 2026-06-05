import { existsSync } from "fs"
import { join } from "path"

export async function GET() {
  // Optional manual toggle:
  // touch .updating   (remove when deployment finished)
  const manualFlag = existsSync(join(process.cwd(), ".updating"))
  const envFlag = process.env.MAINTENANCE_MODE === "1"
  const updating = manualFlag || envFlag
  const message =
    process.env.MAINTENANCE_MESSAGE?.trim() ||
    "המערכת מתעדכנת. אנא המתן כמה דקות ובצע רענון לדף."

  return Response.json({ updating, message })
}

