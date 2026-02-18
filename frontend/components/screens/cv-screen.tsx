"use client"

import { Badge } from "@/components/ui/badge"
import { SonjaAvatar } from "@/components/sonja-avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Lightbulb,
  BarChart3,
  Palette,
  TrendingUp,
  CalendarCheck,
} from "lucide-react"

const skills = [
  "Content Creatie",
  "Concurrent Analyse",
  "SEO Optimalisatie",
  "Email Campagnes",
  "Data Analyse",
  "Social Media",
  "Brand Strategy",
  "Marketing Automation",
  "Agenda & Planning",
]

// Display-label namen voor Sonja’s tools (zelfde teksten als in denkstappen)
const toolDisplayLabels = [
  "Op het internet zoeken",
  "Website-inhoud ophalen",
  "Bestand uit kennis of geheugen lezen",
  "Doorzoeken van kennis en geheugen",
  "Herinnering opslaan",
  "Concurrentie-onderzoek",
  "E-mail versturen",
  "Agenda-item toevoegen",
  "Agenda-item ophalen",
  "Agenda bekijken",
  "Agenda-item bijwerken",
  "Agenda-item verwijderen",
]

const personalityTraits = [
  {
    title: "Proactief",
    description:
      "Kan proactief werken wanneer je haar agenda-taken geeft. Zo signaleert ze kansen en voert ze terugkerende analyses vanzelf uit.",
    icon: Lightbulb,
  },
  {
    title: "Analytisch",
    description:
      "Onderbouwt elke aanbeveling met data en bronnen. Laat altijd haar stappen zien.",
    icon: BarChart3,
  },
  {
    title: "Creatief",
    description:
      "Genereert verrassende content ideeen en campagne concepten die bij AFAS passen.",
    icon: Palette,
  },
  {
    title: "Zelflerend",
    description:
      "Groeit mee over de tijd heen door interactie. Hoe meer je met Sonja samenwerkt, hoe beter ze jouw voorkeuren, stijl en doelen begrijpt.",
    icon: TrendingUp,
  },
]

export function CvScreen() {
  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Profile hero */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-8 py-10">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 ring-4 ring-card rounded-full shadow-lg w-fit">
                  <SonjaAvatar mood="blij" size="xl" alt="Sonja - Digitale Marketeer" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Sonja</h1>
                <p className="mt-1 text-sm font-medium text-primary">
                  Digitale Marketeer - AFAS Software
                </p>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Ik ben Sonja, jullie digitale marketeer bij AFAS Software.
                  Ik help het marketing team met content creatie, concurrent
                  analyses, SEO optimalisatie en strategische planning. Via mijn
                  agenda kun je taken schedulen zodat ik proactief aan de slag ga.
                  Ik ben 24/7 beschikbaar en onderbouw al mijn aanbevelingen met
                  data en bronnen. Daarnaast ben ik zelflerend: hoe meer we
                  samenwerken, hoe beter ik jouw voorkeuren en werkstijl begrijp
                  en meeneem in mijn suggesties.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Vaardigheden
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="px-3 py-1.5 text-xs font-medium"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tools
          </h2>
          <div className="flex flex-wrap gap-2">
            {toolDisplayLabels.map((label) => (
              <Badge
                key={label}
                variant="secondary"
                className="px-3 py-1.5 text-xs font-medium"
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Persoonlijkheid
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {personalityTraits.map((trait) => (
              <Card key={trait.title}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <trait.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-card-foreground">
                      {trait.title}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {trait.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
