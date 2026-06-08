#!/usr/bin/env node
/**
 * start-ta-server.js — Start the ThreatAssessor FastAPI server using the
 * venv Python already created by npm run dev:full.
 *
 * Usage:  node scripts/start-ta-server.js
 *         npm run ta:server
 */

const { spawn } = require("child_process")
const path = require("path")
const fs = require("fs")

const TA_DIR = path.join(__dirname, "..", "vendor", "threatassessor")
const VENV_PYTHON = process.platform === "win32"
  ? path.join(TA_DIR, ".venv", "Scripts", "python.exe")
  : path.join(TA_DIR, ".venv", "bin", "python3")

if (!fs.existsSync(VENV_PYTHON)) {
  console.error("ERROR: ThreatAssessor venv not found.")
  console.error("Run  npm run dev:full  once to set it up, then try again.")
  process.exit(1)
}

// Check .env has a real key
const envPath = path.join(TA_DIR, ".env")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  if (envContent.includes("REPLACE_ME")) {
    console.error("─────────────────────────────────────────────────────────────")
    console.error("  ACTION REQUIRED: Add your OpenRouter API key to:")
    console.error("  vendor/threatassessor/.env")
    console.error("")
    console.error("  Get a free key at: https://openrouter.ai/keys")
    console.error("  Then replace  sk-or-v1-REPLACE_ME  with your actual key.")
    console.error("─────────────────────────────────────────────────────────────")
    process.exit(1)
  }
}

console.log("Starting ThreatAssessor API server on http://localhost:8000 ...")
console.log("Dashboard: http://localhost:8000/dashboard")
console.log("Press Ctrl+C to stop.\n")

const proc = spawn(
  VENV_PYTHON,
  ["-m", "uvicorn", "chatbot.api.app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
  {
    cwd: TA_DIR,
    stdio: "inherit",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONPATH: TA_DIR },
  }
)

proc.on("exit", (code) => {
  if (code !== 0) console.error(`\nThreatAssessor server exited with code ${code}`)
})
