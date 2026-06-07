#!/usr/bin/env node
'use strict'
/**
 * scripts/start-ta.js
 *
 * Sets up the ThreatAssessor Python environment, then starts CIPHER.
 * ThreatAssessor has NO persistent server — it runs as a subprocess
 * per analysis request from within Next.js API routes.
 *
 * Run via: npm run dev:full
 *
 * Steps:
 *   1. Auto-generate THREATASSESSOR_API_KEY in .env if absent (kept for
 *      backwards compat with the ingest tab; not used for subprocess mode)
 *   2. Create Python venv under vendor/threatassessor/.venv (first run only)
 *   3. pip-install ThreatAssessor requirements (first run or when requirements.txt changes)
 *   4. Start CIPHER (Next.js dev server) — only one process, one port
 */

const { spawn, spawnSync } = require('child_process')
const fs   = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT     = path.resolve(__dirname, '..')
const TA_DIR   = path.join(ROOT, 'vendor', 'threatassessor')
const CIPHER_ENV = path.join(ROOT, '.env')
const VENV_DIR = path.join(TA_DIR, '.venv')

const isWin = process.platform === 'win32'
const VENV_PYTHON = isWin
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python3')
const DEPS_STAMP = path.join(VENV_DIR, '.deps-installed')

const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const RESET  = '\x1b[0m'
const DIM    = '\x1b[2m'

const info  = msg => console.log(`${GREEN}[setup]${RESET} ${msg}`)
const warn  = msg => console.warn(`${YELLOW}[warn]${RESET}  ${msg}`)
const fatal = msg => { console.error(`${RED}[error]${RESET} ${msg}`); process.exit(1) }

// ── .env helpers ───────────────────────────────────────────────────────────

function parseEnvFile(p) {
  if (!fs.existsSync(p)) return {}
  const out = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return out
}

function setEnvValue(filePath, key, value) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  const re = new RegExp(`^(#\\s*)?${key}=.*$`, 'm')
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`)
  } else {
    content = content.trimEnd() + (content ? '\n' : '') + `${key}=${value}\n`
  }
  fs.writeFileSync(filePath, content, 'utf8')
}

// ── Step 1: Ensure .env has TA key (backwards compat) ─────────────────────

function ensureEnvVars() {
  const env = parseEnvFile(CIPHER_ENV)
  if (!env['THREATASSESSOR_URL']) {
    setEnvValue(CIPHER_ENV, 'THREATASSESSOR_URL', 'http://localhost:8000')
  }
  if (!env['THREATASSESSOR_API_KEY']?.trim()) {
    const key = crypto.randomBytes(32).toString('hex')
    info('Generated THREATASSESSOR_API_KEY → .env')
    setEnvValue(CIPHER_ENV, 'THREATASSESSOR_API_KEY', key)
  }
}

// ── Step 2: Create Python venv ─────────────────────────────────────────────

function ensureVenv() {
  if (fs.existsSync(VENV_PYTHON)) return

  const candidates = isWin ? ['python', 'python3', 'py'] : ['python3', 'python']
  let pythonExe = null
  for (const c of candidates) {
    if (spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0) {
      pythonExe = c; break
    }
  }
  if (!pythonExe) fatal('Python 3 not found. Install from https://python.org and add to PATH.')

  info('Creating Python virtual environment at vendor/threatassessor/.venv …')
  const r = spawnSync(pythonExe, ['-m', 'venv', VENV_DIR], { cwd: TA_DIR, stdio: 'inherit' })
  if (r.status !== 0) fatal('Failed to create Python venv.')
}

// ── Step 3: Install requirements ──────────────────────────────────────────

function installRequirements() {
  const reqFile = path.join(TA_DIR, 'requirements.txt')
  if (!fs.existsSync(reqFile)) { warn('requirements.txt not found — skipping.'); return }

  const reqMtime   = fs.statSync(reqFile).mtimeMs
  const stampMtime = fs.existsSync(DEPS_STAMP) ? fs.statSync(DEPS_STAMP).mtimeMs : 0
  if (stampMtime >= reqMtime) return

  info('Installing ThreatAssessor Python dependencies (first run ~2 min)…')
  const pip = isWin
    ? path.join(VENV_DIR, 'Scripts', 'pip.exe')
    : path.join(VENV_DIR, 'bin', 'pip3')

  const r = spawnSync(pip, ['install', '-r', 'requirements.txt', '-q', '--no-warn-script-location'],
    { cwd: TA_DIR, stdio: 'inherit' })
  if (r.status !== 0) fatal('pip install failed.')

  fs.writeFileSync(DEPS_STAMP, '')
  info('Dependencies installed.')
}

// ── Step 4: Start CIPHER only ─────────────────────────────────────────────

function startCipher() {
  console.log()
  console.log(`${GREEN}[launch]${RESET} Starting CIPHER → http://127.0.0.1:3000`)
  console.log(`${DIM}ThreatAssessor runs as an in-process subprocess when you run an analysis.${RESET}`)
  console.log(`${DIM}Press Ctrl+C to stop.${RESET}\n`)

  const next = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: true })
  next.on('exit', code => process.exit(code ?? 0))

  const shutdown = () => { try { next.kill('SIGTERM') } catch {} ; setTimeout(() => process.exit(0), 1500) }
  process.on('SIGINT',  shutdown)
  process.on('SIGTERM', shutdown)
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log(`\n${GREEN}╔══════════════════════════════════════════╗`)
console.log(`║        CIPHER + ThreatAssessor           ║`)
console.log(`╚══════════════════════════════════════════╝${RESET}\n`)

ensureEnvVars()
ensureVenv()
installRequirements()
startCipher()
