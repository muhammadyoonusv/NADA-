# Alphabetical Student Ordering & Roll Number Synchronization

Arrange all class members in strict alphabetical order (A to Z) and automatically assign their Roll Numbers sequentially (`1, 2, 3, ... N`) to match their alphabetical position across every table, folder drive, bulk entry matrix, and roster view.

## User Review & Critical Decisions

> [!IMPORTANT]
> Roll numbers will now always reflect the live alphabetical order (A to Z) of enrolled students while preserving each student's payment history and campaign dues records.

- **Confirmed Decision 1**: Student names are sorted alphabetically (A to Z) as the primary master sequence, and Roll Numbers (`1, 2, 3, ...`) are assigned directly from that alphabetical sequence.
- **Confirmed Decision 2**: Existing student payment records and campaign balances remain safely linked to each student even when a new student is enrolled or a name is edited, dynamically updating the alphabetical roll sequence without losing any financial data.

## 1. Overview & Core Concept

- **What It Does**: Ensures that the student list is always ordered alphabetically by student name (A to Z) and that the **Roll No** column displays sequential numbers (`1, 2, 3, ...`) corresponding to that exact alphabetical rank across all views.
- **Target Audience / Persona**: Class union treasurers, administrators, and viewers tracking student contribution drives and master rosters.
- **Key Value**: Eliminates mismatched or out-of-sequence roll numbers when new students are added or names are updated, providing a clean, predictable `1..N` alphabetical roll register everywhere in the app.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Program Drive Dues Table (Desktop & Mobile)**: Opening any program drive displays students sorted A to Z with Roll Numbers `1, 2, 3...` aligned to their alphabetical position.
  2. **Column Sorting**: Clicking the **Roll No** or **Member Name (A-Z)** column header toggles ascending (`1 → N` / `A → Z`) and descending (`N → 1` / `Z → A`) order while keeping each student's assigned alphabetical roll number intact.
  3. **Quick Spreadsheet Matrix Bulk Entry**: Opening the bulk entry grid lists all active students in alphabetical order with their corresponding `1..N` alphabetical roll numbers and compact modal header spacing.
  4. **Enrolling or Renaming Students**: Adding a new student or editing an existing student's name automatically recalculates the alphabetical sequence so every student's roll number immediately reflects the updated A–Z order.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density financial ledger and SaaS data grid clarity.
  - *Color Palette & Mood*: Clean white (`#FFFFFF`) and cool slate (`#F8FAFC`) structural surfaces with high-contrast slate typography (`#0F172A`) and semantic status indicators (emerald `#16A34A` for settled, amber `#D97706` for partial, rose `#E11D48` for pending).
  - *Typography & Hierarchy*: Crisp sans-serif labels for student names paired with monospace tabular numerals (`font-mono tabular-nums`) for Roll Numbers and currency balances so digits align vertically.
  - *Component Styling & Layout*: Compact single-elevation table rows with subtle hairline dividers and refined modal header padding.
- **Interactive Feedback & Motion**: Instantaneous client-side sorting transitions (`<150ms`) with clear sort direction indicators (`↑` / `↓`) on active table headers.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dynamic Alphabetical Roll Mapping vs. Static ID Parsing**
  - *Chosen Approach*: Compute a master alphabetical roll lookup from the A–Z sorted student roster and use it for all roll displays, sorting, bulk paste matching, and receipt narrations, supplemented by safe Firestore ID synchronization.
  - *Why*: Previously, the table sorted students alphabetically by name but extracted the Roll Number from the static document ID (e.g., `ROLL-15` appearing on row 1), causing roll numbers to appear scrambled (`15, 2, 9, 1...`). Dynamic alphabetical mapping guarantees `1, 2, 3...` always matches `A, B, C...` immediately.
  - *Alternatives Considered*: Relying solely on manual database renumbering was passed over because adding a single student mid-alphabet would immediately put roll numbers out of order until a manual renumber was triggered.
- **Decision 2: Safe Record Preservation Across Renumbering**
  - *Chosen Approach*: Decouple the displayed alphabetical roll number (`1..N`) from destructive ID overwrites during routine viewing, while keeping the one-click database synchronization clean and lossless.
  - *Why*: Guarantees zero risk of orphaned payment records in program drive folders.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Master Student Roster State                      │
│        (Filtered by Academic Year & Sorted Alphabetically A→Z)       │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Alphabetical Roll Number Resolver                   │
│     Maps Student ID ──► 1-Based Alphabetical Rank (1, 2, 3 ... N)    │
└─────────┬────────────────────────┬─────────────────────────┬─────────┘
          │                        │                         │
          ▼                        ▼                         ▼
┌───────────────────┐    ┌───────────────────┐     ┌───────────────────┐
│ Program Dues View │    │ Master Roster Dir │     │ Bulk Matrix Modal │
│ • Desktop Table   │    │ • A-Z Roll Column │     │ • Grid Row #1..N  │
│ • Mobile Cards    │    │ • Search & Sort   │     │ • Paste Roll Map  │
│ • Receipt Notes   │    │ • Profile Editor  │     │ • Compact Header  │
└───────────────────┘    └───────────────────┘     └───────────────────┘
```

- **Data Model & State**:
  - `classStudentsList`: Master array of students sorted alphabetically by `name` (`localeCompare` with base sensitivity).
  - `alphabeticalRollMap`: Memoized `Record<string, number>` mapping each student's `id` to their 1-based index (`idx + 1`) in `classStudentsList`.
- **Interactive Component & State Mapping**:
  - **Roll Display Helper**: Resolves a student's roll number via `alphabeticalRollMap[student.id]` first so every table row, filtered search result, mobile card, and bulk spreadsheet row displays the exact alphabetical roll number (`1, 2, 3...`).
  - **Table Sorting (`sortBy: 'id' | 'name'`)**: Sorting by Roll No (`id`) or Member Name (`name`) uses the alphabetical rank so ascending order is always `1, 2, 3...` (A to Z) and descending order is `N...3, 2, 1` (Z to A).
  - **Bulk Paste & Payment Narration**: Bulk text paste by roll number resolves against the alphabetical roll number (`1..N`), and payment journal narrations record `ROLL-<alphaRoll>` to match the visible table.
