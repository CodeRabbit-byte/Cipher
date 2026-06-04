import type { Severity } from "@/types"

const styles: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 border border-red-200",
  high: "bg-orange-100 text-orange-800 border border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  low: "bg-blue-100 text-blue-800 border border-blue-200",
  info: "bg-gray-100 text-gray-700 border border-gray-200",
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[severity as Severity] ?? styles.info}`}
    >
      {severity}
    </span>
  )
}
