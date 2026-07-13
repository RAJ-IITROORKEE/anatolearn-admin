# DESIGN.md — AnatoLearn Admin Design System

## 1. Design direction

AnatoLearn is a modern anatomy-learning product. The visual language should feel:

- Clear
- Trustworthy
- Educational
- Calm
- Medical without feeling clinical or intimidating
- Modern without becoming decorative or trendy

The mobile reference screens use a light iOS-inspired style with white surfaces, soft grey backgrounds, rounded cards, clear anatomical illustrations and module-specific accent colors. The admin panel should translate that visual language into a professional responsive web dashboard.

Do not directly imitate an iPhone screen on desktop. Preserve the brand language while using appropriate web-admin patterns.

---

## 2. Brand principles

1. **Content first**
   Anatomy illustrations, questions and learning content are the focus.

2. **One primary action per surface**
   Avoid competing buttons and unnecessary visual noise.

3. **Module color has meaning**
   Color identifies the learning mode, not decoration.

4. **Soft structure**
   Use subtle borders, gentle shadows and rounded corners rather than heavy boxes.

5. **Fast comprehension**
   Tables, status badges, charts and forms must be understandable at a glance.

6. **Accessible by default**
   Color, type, focus and interaction patterns must remain usable for keyboard and screen-reader users.

---

## 3. Color system

Use CSS variables and semantic tokens. Do not hardcode raw colors across components.

### Brand and semantic colors

- Primary blue: `#2563EB`
- Primary blue hover: `#1D4ED8`
- Primary blue soft: `#EFF6FF`
- Quiz purple: `#7C3AED`
- Quiz purple soft: `#F5F3FF`
- Test orange: `#F97316`
- Test orange soft: `#FFF7ED`
- Success/flashcard green: `#16A34A`
- Success green soft: `#F0FDF4`
- Destructive red: `#DC2626`
- Destructive soft: `#FEF2F2`
- Warning amber: `#D97706`
- Neutral page background: `#F6F8FC`
- Surface: `#FFFFFF`
- Subtle surface: `#F8FAFC`
- Border: `#E2E8F0`
- Strong text: `#0F172A`
- Body text: `#334155`
- Muted text: `#64748B`

Ensure contrast is checked in the actual implementation. Adjust shades where required for WCAG AA.

### Usage

- Blue: navigation, links, default primary actions
- Purple: quiz pages, quiz badges and quiz charts
- Orange: test pages, timers, test badges and test charts
- Green: flashcards, completion and positive performance
- Red: destructive actions and errors only
- Amber: warnings and pending states

Never communicate state by color alone. Pair color with text and/or icons.

---

## 4. Typography

Use `Inter` through `next/font` or an equivalent clean sans-serif already present in the project.

Suggested scale:

- Display: 32–36px, 700
- Page title: 26–30px, 700
- Section title: 20–24px, 650–700
- Card title: 16–18px, 600
- Body: 14–16px, 400–500
- Label: 13–14px, 500–600
- Caption: 12–13px, 400–500

Rules:

- Keep line length readable
- Use sentence case, not all caps
- Use tabular numerals for scores, timers and analytics
- Do not use tiny low-contrast labels
- Use clear hierarchy rather than many font weights

---

## 5. Layout

### Desktop shell

- Sidebar: 260px expanded, approximately 76px collapsed
- Top bar: 64px
- Content max-width: 1600px
- Page padding: 24–32px
- Grid gap: 20–24px

### Tablet

- Collapsible overlay or compact sidebar
- Page padding: 20–24px
- Dashboard cards: two columns where possible

### Mobile admin view

- Drawer navigation
- Page padding: 16px
- One-column forms and cards
- Tables may become horizontally scrollable or switch to card rows
- Sticky action bar only where it improves completion

### Spacing scale

Use a consistent 4px base scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Avoid arbitrary spacing unless the component requires it.

---

## 6. Surfaces and shape

### Cards

- Radius: 14–18px
- Border: 1px subtle neutral
- Shadow: low elevation only
- Padding: 20–24px desktop, 16px mobile

### Inputs

- Radius: 10–12px
- Minimum height: 40–44px
- Strong focus ring
- Label above input
- Helpful text below only when useful
- Error text close to the field

### Buttons

- Radius: 10–12px
- Minimum height: 40px
- Clear loading state
- Icon spacing must be consistent
- Destructive buttons should not be visually dominant until confirmation

### Dialogs and drawers

- Use dialog for focused confirmation or short forms
- Use drawer/sheet for supporting detail or mobile navigation
- Use full pages for long editors
- Trap focus and restore focus on close

---

## 7. Navigation

Sidebar groups:

- Overview
  - Dashboard
- Learning Content
  - Organ Systems
  - Topics
  - Content Review
  - Flashcards
- Assessments
  - Quiz Questions
  - Test Questions
  - Attempts
- Community
  - Users
  - Feedback
  - Notifications
- Assets
  - Media Library
- System
  - Audit Logs
  - Settings

Rules:

- Active item uses blue soft background and blue icon/text
- Quiz item may use a purple indicator
- Test item may use an orange indicator
- Keep icons consistent through Lucide
- Show tooltips in collapsed sidebar
- Breadcrumbs must reflect hierarchy

---

## 8. Page anatomy

Each main page should contain:

1. Breadcrumbs
2. Page title and concise description
3. Primary action aligned right on desktop
4. Optional summary cards
5. Search/filter toolbar
6. Main content area
7. Pagination/footer controls

Keep primary actions consistent:

- “Add organ system”
- “Create lesson”
- “Add flashcard”
- “Add quiz question”
- “Add test question”
- “Create notification”

Avoid ambiguous labels such as “Submit” where a more specific verb exists.

---

## 9. Dashboard

Use calm editorial cards rather than a crowded BI dashboard.

Recommended sections:

- Metric cards in a responsive grid
- Attempts trend
- Accuracy split: quiz vs test
- Content completeness by organ system
- Recent users
- New feedback
- Recently edited content

Metric cards should include:

- Clear label
- Large value
- Optional small trend
- Relevant icon
- Semantic accent strip or soft icon container

Charts:

- Use restrained colors
- Include tooltips and accessible text summary
- Do not use 3D effects
- Do not use pie charts when a bar chart is clearer
- Use tabular numerals

---

## 10. Data tables

Tables must support:

- Search
- Relevant filters
- Sort
- Pagination
- Row action menu
- Empty state
- Loading skeleton
- Error state
- Selected-row count for bulk actions

Rules:

- Avoid too many columns
- Keep primary identifying field on the left
- Status uses badge plus text
- Dates use readable local formatting
- Destructive action stays inside a menu and requires confirmation
- On mobile, use card rows or horizontal scrolling with sticky first column only when necessary

---

## 11. Forms

Use sectioned forms with concise helper text.

### Long editors

For content, questions and notification creation:

- Use a full page
- Keep a sticky footer or header action area
- Show Save draft and Publish separately
- Show autosave only if it is genuinely implemented
- Warn about unsaved changes
- Keep preview accessible without losing edits

### Question editor

Visual order:

1. Assessment type badge
2. Topic/concept/difficulty
3. Question text
4. Image
5. Options
6. Correct answer
7. Explanation
8. Publication state

Quiz editor accent: purple
Test editor accent: orange

Correct answer selection must be obvious and accessible.

### Content block editor

Each block:

- Has drag handle or move controls
- Shows block type
- Can be duplicated
- Can be deleted with confirmation when non-empty
- Has clear image alt-text requirements
- Can be previewed

Avoid unrestricted raw HTML.

---

## 12. Status design

Recommended badges:

- Draft: neutral
- Published: green
- Archived: slate
- Active: green
- Inactive: neutral/red text as appropriate
- New feedback: blue
- Reviewed: amber
- Resolved: green
- Scheduled: purple
- Sent: green
- Cancelled: neutral/red
- Quiz: purple
- Test: orange

Every badge includes readable text.

---

## 13. Feedback and motion

Interaction feedback:

- Toast after successful mutations
- Inline error near failed field
- Page-level retry for fetch failures
- Button spinner or progress state
- Skeleton only when content structure is known
- Empty state with one useful next action

Motion:

- 120–220ms for common transitions
- Use opacity/transform only
- Respect `prefers-reduced-motion`
- No decorative bouncing, parallax or constant animation

---

## 14. Authentication pages

Use a centered card on a soft neutral background.

Include:

- AnatoLearn logo/mark
- Clear title
- Short instruction
- Email/password fields
- Password visibility toggle
- Forgot password link
- Primary blue button
- Error handling
- Small security/help copy

Use anatomical imagery subtly. Do not make the form secondary to decoration.

---

## 15. Anatomy media

- Prefer high-quality PNG/WebP illustrations with transparent or clean backgrounds
- Preserve aspect ratio
- Require alt text
- Use captions for educational diagrams
- Avoid using copyrighted imagery without permission
- Do not stretch or crop anatomical labels
- Preview uploaded images before saving
- Show file size and dimensions in media library

---

## 16. Accessibility checklist

- Keyboard-accessible navigation and menus
- Visible focus ring
- Label every control
- Use headings in order
- Minimum comfortable touch target
- Sufficient contrast
- Text alternatives for images
- Error summaries for long forms
- Focus moved to error summary where appropriate
- Dialog focus trapping
- Reduced-motion support
- Do not use placeholder text as the only label
- Do not rely on color alone

---

## 17. Anti-patterns

Do not use:

- Excessive gradients
- Glassmorphism across the dashboard
- Neon colors
- Huge shadows
- Random border radii
- Dense dashboards with no hierarchy
- Multiple primary buttons in one area
- Unlabeled icon-only actions
- Raw database IDs as primary user-facing labels
- Fake analytics
- Fake success states
- Skeletons that never resolve
- Modal forms for long content editing
- Low-contrast grey text
- Decorative anatomy images that obstruct content

---

## 18. Definition of visually complete

A page is visually complete only when it has:

- Responsive layout
- Loading state
- Empty state
- Error state
- Hover state
- Focus state
- Disabled state
- Validation state
- Success feedback
- Consistent spacing and typography
- No clipped text at common breakpoints
- No placeholder lorem ipsum in final production paths
