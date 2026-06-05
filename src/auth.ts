import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { z } from "zod"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Fail fast at startup if NEXTAUTH_SECRET is missing or too short.
// Without this, NextAuth v5 derives a predictable secret from NEXTAUTH_URL,
// which allows any attacker to forge valid session JWTs.
const _secret = process.env.NEXTAUTH_SECRET
if (!_secret || _secret.length < 32) {
  throw new Error(
    "NEXTAUTH_SECRET is not set or is shorter than 32 characters. " +
      "Generate one with: openssl rand -base64 32"
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: _secret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name ?? undefined }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
