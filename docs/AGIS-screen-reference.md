# AGIS UI reference implementation

The attached AGIS-SIH2026 reference PDF contains 12 image-only UI screens. The frontend has been refined against those screens as the visual source of truth.

| PDF | Route | Implemented focus |
|---|---|---|
| 1 | `/` before auth | Split login, role selector, password, OTP, AGIS security hero |
| 2 | `/dashboard` | KPI cards, recent transformations, quick actions, workflow |
| 3 | `/documents` | Search/filter toolbar, document table, type/status chips, secure notice |
| 4 | `/transformations/new` | Source selection, output cards, 3-step workflow |
| 5 | `/transformations/config` | Transformation settings, source preview, summary rail |
| 6 | `/transformations/:id` | Generated output editor, validation checks, summary rail |
| 7 | `/transformations/:id/review` | Review decision cards, comments, validation, activity history |
| 8 | `/audit-logs` | Filterable audit table, log detail rail, period summary |
| 9 | `/users` | User stats, user table, role distribution, access requests |
| 10 | `/system` | Configuration tabs, six settings cards, system information rail |
| 11 | `/roles` | Role list, role detail, permission matrix |
| 12 | `/templates` | Template KPIs, table, template preview rail |

## Visual tokens derived from the reference

- Dark navy left navigation with compact AGIS lock/shield branding.
- White application header with notification icon and role/profile cluster.
- Very light blue-gray page background and white bordered cards.
- Primary blue actions with small 6–7px radii.
- Compact enterprise typography, dense tables, small status pills, and restrained shadows.
- Blue active navigation state and blue underlined settings tabs.
- Right-side detail rails on workflow/admin screens.
- Green success/approval, amber review/pending, purple transformed/draft, and red rejection states.

## Functional mapping

The UI remains connected to the existing production-oriented backend:

- PostgreSQL persistence through SQLAlchemy.
- Redis-backed rate limiting.
- Celery background extraction/generation jobs.
- PDF/DOCX/XLSX extraction pipeline.
- S3/MinIO object storage.
- JWT access tokens and email OTP verification.
- Permission checks on backend endpoints.
- Role-aware frontend navigation and route gates.
- Audit logging around authentication, uploads, transformations, and review decisions.
