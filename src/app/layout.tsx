import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme/ThemeProvider"

export const metadata: Metadata = {
  title: "CIPHER",
  description: "Capture-first engagement workspace for security professionals",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint — sets dark/light class from localStorage to prevent flash */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('cipher-theme')||'{}');if(t.mode==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
