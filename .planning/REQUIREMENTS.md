# Requirements: Kaheeta Notes

**Defined:** 2026-06-30
**Core Value:** Users can capture private, richly-formatted notes knowing the server stores only ciphertext — their content is readable only on their own device.

## v1 Requirements

### Notes Management

- [ ] **NOTE-01**: User can create a note with a title and a rich-text body (Tiptap WYSIWYG editor)
- [ ] **NOTE-02**: User can open and edit an existing note
- [ ] **NOTE-03**: User can delete a note with a confirmation dialog
- [ ] **NOTE-04**: Note changes auto-save — no explicit save button required

### Encryption

- [x] **ENC-01**: Note body is encrypted client-side (AES-GCM, 256-bit) before writing to PocketBase — server never stores plaintext
- [x] **ENC-02**: Encryption key is derived from the user's session via PBKDF2 + per-user salt — transparent to the user, no extra password prompt
- [x] **ENC-03**: Decryption happens in-browser on read — body is never sent in plaintext over the wire

### Notes List

- [ ] **LIST-01**: Notes displayed in a flat list sorted by last-modified (newest first)
- [ ] **LIST-02**: Each list item shows: title, created date, and a plaintext preview snippet of the body
- [ ] **LIST-03**: User can search notes by title (client-side filter, instant)

### Navigation

- [ ] **NAV-01**: Notes section accessible from the main wallet navigation (KaheetaNavBar)

## v2 Requirements

### Search

- **SRCH-01**: Full-text body search (decrypt all notes in memory, search content)
- **SRCH-02**: Highlight matched text within search results

### Organisation

- **ORG-01**: User can pin/favourite notes (appear at top of list)
- **ORG-02**: Tag system for notes
- **ORG-03**: Folder/category grouping

### Cross-Feature

- **XREF-01**: Attach a note to an expense, group, or membership record
- **XREF-02**: View attached notes from within expense/group detail views

### Display

- **DISP-01**: Word / character count in the editor

## Out of Scope

| Feature | Reason |
|---------|--------|
| Note sharing | Personal journal only — explicitly excluded forever |
| Collaborative/real-time editing | Personal-only; architecture would need full rework |
| Server-side encryption | Client-side AES-GCM is sufficient; keeps backend simple |
| OAuth / separate encryption password | User session is the key derivation source; no second password |
| Mobile app (native) | Web PWA only |
| Rich media (images, attachments) in notes | Scope creep; text-only v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTE-01 | Phase 1 | Pending |
| NOTE-02 | Phase 1 | Pending |
| NOTE-03 | Phase 1 | Pending |
| NOTE-04 | Phase 1 | Pending |
| ENC-01 | Phase 2 | Complete |
| ENC-02 | Phase 2 | Complete |
| ENC-03 | Phase 2 | Complete |
| LIST-01 | Phase 1 | Pending |
| LIST-02 | Phase 1 | Pending |
| LIST-03 | Phase 3 | Pending |
| NAV-01 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 after initial definition*
