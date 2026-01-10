# FEAT-005: LLM Parsing mit LangChain

## Summary

LangChain-Integration für strukturierte Extraktion von Aktivitätsdaten aus Transkript.

## Acceptance Criteria

- [ ] LangChain mit Claude und OpenAI konfiguriert
- [ ] Provider wechselbar via Settings
- [ ] Structured Output gibt typisiertes Objekt zurück
- [ ] Bekannte Auftraggeber/Themen werden erkannt
- [ ] Fehlende Pflichtfelder werden markiert

## Technical Details

### Dependencies

```json
{
  "@langchain/core": "^0.3",
  "@langchain/anthropic": "^0.3",
  "@langchain/openai": "^0.3",
  "zod": "^3.22"
}
```

### Activity Schema (Zod)

```typescript
import { z } from 'zod';

export const ActivitySchema = z.object({
  auftraggeber: z.string().nullable(),
  thema: z.string().nullable(),
  beschreibung: z.string(),
  stunden: z.number().nullable(),
  km: z.number().default(0),
  auslagen: z.number().default(0),
  datum: z.string().nullable() // ISO date or null for today
});

export type Activity = z.infer<typeof ActivitySchema>;
```

### LLM Service (main/services/llm.ts)

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

const systemPrompt = `
Du extrahierst Aktivitätsdaten aus Spracheingaben.
Bekannte Auftraggeber: {clients}
Bekannte Themen: {themes}

Extrahiere: auftraggeber, thema, beschreibung, stunden, km, auslagen, datum.
Setze null wenn nicht erkannt. Datum null = heute.
"halbe Stunde" = 0.5, "Viertelstunde" = 0.25, etc.
`;

export async function parseActivity(
  transcript: string,
  clients: string[],
  themes: string[]
): Promise<Activity> {
  const llm = getLLM(); // Claude or OpenAI based on settings
  const structured = llm.withStructuredOutput(ActivitySchema);

  return await structured.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: transcript }
  ]);
}
```

## Test Plan

1. "Neuer Eintrag IDT, Thema Lotus, halbe Stunde" → { auftraggeber: "IDT", thema: "Lotus", stunden: 0.5 }
2. "Telefonat mit Müller" → { stunden: null } (Rückfrage nötig)
3. Provider-Wechsel Claude ↔ OpenAI funktioniert
4. Unbekannter Auftraggeber → Wird trotzdem extrahiert
