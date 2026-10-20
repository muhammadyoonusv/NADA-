# Implementation Plan: NADA Smart AI Assistant Integration

## 1. Goal
Replace the conversational `AIChatBot.tsx` with an embedded "NADA Smart AI Assistant" for auto-filling journal entry forms.

## 2. Tasks
- [ ] Remove `AIChatBot.tsx` and all references to it in `App.tsx`.
- [ ] Redesign `JournalSheet.tsx` (Record Entry modal):
    - [ ] Add "AI Magic Auto-Fill Bar" at the top of the entry form.
    - [ ] Implement "✨ Auto-Fill Form" button using `@google/genai` (Gemini Flash).
    - [ ] Implement "📷 Scan Receipt" (placeholder or basic integration).
    - [ ] Add "Simple Explanation" callout box.
    - [ ] Implement logic to auto-create missing accounts in Firebase (`isNewAccount: true` handler).
    - [ ] Highlight missing fields in amber.
- [ ] Create/Update Server-side Gemini integration:
    - [ ] Define JSON schema for Gemini response.
    - [ ] Inject strict system instructions (Accounting Brain).
- [ ] Global UI Cleanup:
    - [ ] Update `App.tsx` navigation to add a "Gemini AI" button that opens the Record Entry modal.
    - [ ] Apply CSS in `index.html` to hide Netlify badge.
    - [ ] Normalize legacy `QURAN-` prefixes to `NADA-`.

## 3. Risk Mitigation
- Ensuring strict JSON schema adherence.
- Handling Firebase atomicity (save account first if `isNewAccount`).
- Maintaining double-entry bookkeeping integrity.
