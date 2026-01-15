export type GlossarKategorie = 'Auftraggeber' | 'Thema' | 'Kunde' | 'Sonstiges'

export type GlossarEintrag = {
  kategorie: GlossarKategorie
  begriff: string
  synonyme: string[]
}

export type Glossar = {
  eintraege: GlossarEintrag[]
  byKategorie: Map<GlossarKategorie, GlossarEintrag[]>
  lookupMap: Map<string, string>
}
