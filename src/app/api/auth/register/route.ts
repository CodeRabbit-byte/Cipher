import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

const registerSchema = z.object({
  email: z.string().email(),
  // max(128) prevents bcrypt DoS via excessively long passwords
  password: z.string().min(8).max(128),
  name: z.string().optional(),
})

// ---------------------------------------------------------------------------
// In-memory IP-based rate limiter for registration
// Allows at most REGISTER_MAX_ATTEMPTS per REGISTER_WINDOW_MS per IP.
// ---------------------------------------------------------------------------
const REGISTER_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const REGISTER_MAX_ATTEMPTS = 10

const registerAttempts = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = registerAttempts.get(ip)
  if (!entry || now - entry.windowStart > REGISTER_WINDOW_MS) {
    registerAttempts.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > REGISTER_MAX_ATTEMPTS) return true
  return false
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      // Return the same response as success to prevent email enumeration.
      // The caller should show "If this email is new, an account has been created."
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const hashed = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: { email, password: hashed, name: name ?? null },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Race-condition duplicate — return same opaque response
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
