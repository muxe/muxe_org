---
inclusion: fileMatch
fileMatchPattern: 'src/data.ts'
---

# Editing content

All content lives in `src/data.ts`; routes derive from it.

## Voice
Plain, dry, nerdy/laid-back. No LinkedIn lingo — no "spearheading",
"high-performing", "championed", "passionate". State what was done, plainly.

## Data shapes
- Dates: `YYYY-MM` strings, nullable `end` (`null` = current). Not free text.
- Computed values (e.g. `experienceYears`) go in the route handler, not `data.ts`.

## Adding a route (do all five)
1. Add data to `data.ts`.
2. Add the handler in `routes.ts`.
3. Add it to the root `_links`.
4. Add it to the 404 `availableRoutes` list.
5. Update the README API table.
