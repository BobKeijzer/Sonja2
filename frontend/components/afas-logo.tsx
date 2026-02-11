interface AfasLogoProps {
  className?: string
  variant?: "color" | "white"
}

export function AfasLogo({ className = "", variant = "color" }: AfasLogoProps) {
  const fill = variant === "white" ? "#FFFFFF" : "#0066CC"
  const subFill = variant === "white" ? "rgba(255,255,255,0.7)" : "#004C99"

  return (
    <svg
      viewBox="0 0 120 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AFAS Software"
    >
      {/* AFAS text */}
      <text
        x="60"
        y="24"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize="22"
        letterSpacing="3"
        fill={fill}
      >
        AFAS
      </text>
      {/* software text */}
      <text
        x="60"
        y="40"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="500"
        fontSize="10"
        letterSpacing="2.5"
        fill={subFill}
      >
        SOFTWARE
      </text>
    </svg>
  )
}
