# Cross-list gradebooks — shared vs split

**Audience:** Registrars and instructors  
**Related:** [REMAINING_5_PHASES.md](./REMAINING_5_PHASES.md) Phase 3

---

## Two modes

| Mode | `sharedGradebook` | What happens |
|------|-------------------|--------------|
| **Shared** (default) | `true` | All member sections set `lmsCourseId` → primary section’s content course. One gradebook / one content shell. Enrollments stay on `Enrollment.sectionId` per section. |
| **Split** | `false` | Each section keeps its own `lmsCourseId`. Organizational cross-list only. Open each course’s gradebook separately. |

Remount **never merges** historical grades into the shared course. Secondary content courses become archives.

---

## Before creating a shared cross-list

1. Call `POST /api/academic-structure/cross-lists/preview` with `{ sectionIds, primarySectionId, sharedGradebook: true }`.
2. If `requiresConfirm` / `orphans` is non-empty:
   - **Export archives first** (`exportArchivesFirst: true`) — queues `export.gradebook` jobs for each orphan course, **or**
   - **Confirm remount** (`confirmRemount: true`) after you understand archives won’t merge.
3. Create with the same flags: `POST /api/academic-structure/cross-lists`.

After remount, each remounted section stores `previousLmsCourseId` (archive pointer). Open that course URL for the historical gradebook.

---

## Teaching UX (split)

- Registrar Sections: **Open course** / **Gradebook** links per linked section.
- Teachers: on a split cross-listed course, sibling chips list other sections’ gradebooks via  
  `GET /api/academic-structure/courses/:courseId/cross-list-siblings`.

---

## Enrollment methods (section)

| Method | Catalog / self-enroll |
|--------|------------------------|
| `open` | Students can join / waitlist as usual |
| `approval` | Request queues for instructor approval |
| `registrar_only` | No student self-enroll |
| `sis_only` | SIS or registrar only |

Waitlist promote from Sections uses the linked content course’s waitlist (`POST /api/registrar/sections/:sectionId/waitlist/promote`).
