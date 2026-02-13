"use client"

import Image from "next/image"

export type SonjaMood =
  | "blij"
  | "koffie"
  | "denken"
  | "regelen"
  | "boos"
  | "verdrietig"

const MOOD_IMAGE: Record<SonjaMood, string> = {
  blij: "/sonja_blij.png",
  koffie: "/sonja_koffie.png",
  denken: "/sonja_denken.png",
  regelen: "/sonja_regelen.png",
  boos: "/sonja_boos.png",
  verdrietig: "/sonja_verdrietig.png",
}

interface SonjaAvatarProps {
  mood?: SonjaMood
  size?: "sm" | "md" | "mdLarge" | "lg" | "xl"
  className?: string
  alt?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  mdLarge: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
}

/** Sonja-avatar: uitvergroot en iets naar beneden geframed zodat het witte onder de blazer niet afgesneden zichtbaar is. */
export function SonjaAvatar({
  mood = "blij",
  size = "sm",
  className = "",
  alt = "Sonja",
}: SonjaAvatarProps) {
  const sizeClass = sizeClasses[size]
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-muted/30 flex items-center justify-center ${sizeClass} ${className}`.trim()}
    >
      <Image
        src={MOOD_IMAGE[mood]}
        alt={alt}
        fill
        className="object-cover"
        style={{ objectPosition: "center 38%" }}
        sizes={size === "sm" ? "32px" : size === "md" ? "40px" : size === "mdLarge" ? "56px" : size === "lg" ? "80px" : "112px"}
      />
    </div>
  )
}
