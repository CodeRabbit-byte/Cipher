import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Shield, LayoutDashboard, Crosshair, Library, LogOut, PenLine, Bot } from "lucide-react"
import { ThemeCustomizer } from "@/components/theme/ThemeCustomizer"
import { signOut } from "@/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-60 shrink-0 border-r flex flex-col">
        <div className="h-14 border-b flex items-center gap-2 px-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight text-lg">CIPHER</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </NavLink>
          <NavLink href="/engagements" icon={<Crosshair className="h-4 w-4" />}>
            Engagements
          </NavLink>
          <NavLink href="/library" icon={<Library className="h-4 w-4" />}>
            Finding Library
          </NavLink>
          <NavLink href="/whiteboard" icon={<PenLine className="h-4 w-4" />}>
            Whiteboard
          </NavLink>
          <NavLink href="/forum" icon={<Bot className="h-4 w-4" />}>
            Generating Forum
          </NavLink>
        </nav>

        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground px-3 mb-2 truncate">
            {session.user?.email}
          </div>
          <ThemeCustomizer />
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {icon}
      {children}
    </Link>
  )
}
