# Frontend Features

This document describes the target frontend behavior to implement during the build phases.

## Overview

- The target frontend is a plain JavaScript single-page application (Vite) for admissions and account management.
- Routing is handled client-side with protected and public routes.
- Authenticated users can log in, register, start a new application, resume draft applications, review submitted applications, and view their profile.
- Frontend integrates with Drupal via JSON:API and Drupal session-based authentication.
- The frontend needs to accommodate multiple application types
- Guardian and emergency contact workflows are built around reusable `Person` records and reusable `Address` records provided by Drupal.

## Routing And Access Control

- Public routes:
  - `/` for the landing page.
  - `/login` for account sign-in.
  - `/register` for account creation.
- Protected routes:
  - `/dashboard` for application management.
  - `/apply` and `/apply/:step` for the multi-step application flow.
  - `/profile` for account details.
  - `/application/:id` for viewing a submitted or existing application.
  - `/records/people` for viewing list of used people records.
  - `/records/addresses` for viewing list of used address records.
- Protected route wrapper redirects unauthenticated users to the login screen.
- App verifies the current Drupal-backed session on initial load.
- App re-checks session validity when the browser tab becomes visible again.

## Global Navigation

- Header shows a public login CTA when the user is logged out.
- Header shows authenticated navigation when the user is logged in.
- Authenticated navigation includes:
  - Dashboard
  - New Application
  - People
  - Addresses
  - Profile
  - Log out
- Mobile navigation uses a hamburger menu and closes automatically on route changes.
- Active navigation state is highlighted based on the current route.

## Styling and Layout

- **CSS Approach:** Vanilla CSS (no UI framework required). Global styles in `frontend/src/index.css`.
- **Layout:** Clean, minimal design with responsive mobile-first approach. Horizontal padding uses `clamp(1rem, 5vw, 3rem)` so content breathes on large screens without excessive whitespace on mobile.
- **Shell/Content containers:** `.app-shell` and `.app-content` wrapper classes constrain maximum width and center content on wide viewports.
- **Color Scheme:** Neutral, professional palette suitable for an educational institution. Primary action button color is used consistently across forms and CTAs.
- **Spacing & Typography:** Consistent spacing scale and readable typography; headings use semantic HTML hierarchy (`<h1>` through `<h6>`).
- **Form Styling:** Consistent form input styling with clear labels, focus states, and error states (via `aria-invalid` and error message display).
- **Header:** Sticky/fixed header with logo/brand name on the left and navigation on the right. Mobile hamburger menu appears at breakpoint ~768px.
- **Footer:** Simple footer with copyright and links
- **Cards/Containers:** Subtle shadows and borders to visually separate sections; adequate whitespace for readability.
- **Responsive:** Mobile-first CSS media queries for tablet and desktop layouts. All form pages stack vertically on mobile.

## Home Page

- Landing page presents the application entry point.
- Includes a primary CTA to start the application process by navigating to login.
- Includes trust/assurance messaging about a secure application process.

## Authentication Features

- Email/username plus password login form.
- Client-side validation for required login fields.
- Error display for login failures.
- Redirects authenticated users away from the login page to the dashboard.
- Supports Drupal-managed social login entry points:
  - Google
  - Microsoft
- Uses Drupal session cookies instead of frontend token management.
- Does not store auth state, identity data, or session-derived user data in `localStorage`, `sessionStorage`, or other browser storage.
- On app load, revalidates the active Drupal session against `/user/login_status` before trusting any local in-memory auth state.
- If an authenticated backend session exists but no local auth state is present (e.g. user logged in via Drupal admin UI), the frontend **bootstraps a lightweight user object** from the backend session automatically.
- If a stale Drupal session causes a login failure (403), frontend attempts a logout cleanup and retries once.
- Logout sends a GET request to `/user/logout?_format=json&token={logoutToken}` with the logout token obtained at login time.
- For backend-bootstrapped sessions (where no login response was received), the logout token is recovered at logout time via `getLogoutToken()`, which calls `GET /api/session/info?_format=json` to retrieve the logout token for the active Drupal session.
- Local auth state is only cleared after a **successful** server-side logout. If the server logout fails, local state is preserved so the user can retry.
- A CSRF token is fetched from `/session/token` and sent as `X-CSRF-Token` for all state-changing API requests.

### Session Management API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/user/login?_format=json` | POST | Authenticate; returns `current_user` and `logout_token` |
| `/user/logout?_format=json&token={token}` | GET | Invalidate Drupal session; requires `token` query param |
| `/user/login_status?_format=json` | GET | Returns `1` (authenticated) or `0`; used for session verification |
| `/session/token` | GET | Returns CSRF token for state-changing requests |
| `/api/session/info?_format=json` | GET | Returns current user data and logout token for bootstrapped sessions |

## Registration Features

- Account registration form with:
  - Email
  - Password
  - Password confirmation
- Client-side validation includes:
  - Required fields
  - Email format validation
  - Minimum password length
  - Password confirmation match
- Displays backend registration errors inline.
- Shows a success state instructing the user to check email after account creation.
- Redirects authenticated users away from registration to the dashboard.

## Dashboard Features

- Personalized welcome message using the authenticated user name when available.
- Fetches the user’s applications from Drupal.
- Loading state while application data is being fetched.
- Empty state for users with no applications yet.
- New Application CTA from the dashboard.
- Application list cards show:
  - Relative application numbering
  - Started date
  - Student name (first/last)
  - Applying for grade
  - Current status badge
- Status labels currently supported:
  - Draft
  - Submitted
  - Under Review
  - Accepted
  - Not Accepted
- Draft applications expose a Continue action.
- Draft applications expose a Delete action with a confirmation dialog.
- Non-draft applications expose a View action.
- Dashboard should support creating more than one application type.
- New application flow should let the user choose among available bundles, including:
  - Partial Programming
  - Full Early Years
  - Full Middle Years
  - Full Senior Years
- Existing applications should display their concrete application type, not just a generic application label.
- Continue action stores the selected application in frontend state and routes into the step flow.
- Draft deletion shows a success notice and removes the draft from the list.
- Leaving the dashboard clears any previously selected application from application state.


### Dashboard - Reusable Records Block

- Authenticated users should have a People block below Applications that lists reusable `Person` records.
- Authenticated users should have an Addresses block below Applications  that lists reusable `Address` records.
- Each library block should support:
  - listing existing records
  - editing an existing record
  - listing applications that reference this record
- The record library should reduce duplicate data entry across future applications.

## Person Record UX

- Guardian entry uses reusable Person cards rather than hardcoded father/mother form blocks.
- Application flows support selecting an existing person or creating a new person inline.
- Person editing prioritizes speed and clarity with:
  - card-based guardian summaries
  - inline add panels
  - typed email chips
  - typed phone chips
- The `PersonPicker` component does **not** collect a relationship type. Relationship type is collected on the step that uses the picker, because one person can have different roles across different applications.
- UI copy refers to roles such as primary guardian, secondary guardian, emergency contact, or other relationship labels instead of assuming mother/father only.
- The inner "new person" panel inside `PersonPicker` is a `<div>`, not a `<form>`, to avoid activating the outer step form's submit handler. The save button is `type="button"` with an explicit `onClick` handler.
- The same pattern applies to `AddressPicker`: inner save section is a `<div>`, save button is `type="button"`.

## Contact Entry Rules

- Email entries should be collected as `type:value`, for example `work:jdoe@contoso.com`.
- Phone entries should be collected as `type:value`, for example `mobile:2045551234`.
- Client-side validation should help users maintain the expected format, but Drupal remains authoritative.

## Address Reuse UX

- Address selection should allow a person or application to reference an existing address.
- Users should be able to create a new address inline when no suitable record exists.
- UI should clearly communicate when a person is reusing an address versus creating a new one.

## Profile Features

- Profile page displays currently known account data.
- Shows username and email when available.
- Falls back gracefully if profile information is missing.

## Multi-Step Application Flow

- The application wizard is application-type aware.
- Shared application fields are handled consistently across all application bundles.
- Bundle-specific steps are driven by the concrete application type so future full-program forms can diverge without overloading the partial-program flow.
- Application process is implemented as a multi-step wizard with the following structure:
  - **Required Steps (6):**
    - Student Info
    - Health Information
    - Parent / Guardian Information
    - Additional Support
    - Questionnaire
    - Commitment
  - **Optional/Review Steps (2):**
    - Documents (file uploads)
    - Review (summary and confirmation)
- Each step is route-addressable through `/apply/:step`.
- Step progress is rendered at the top of the page.
- Progress stepper displays:
  - Current step
  - Completed step checkmarks
  - Locked/unlocked navigation state
- User can always access step 1.
- Once step 1 is complete, top step buttons become available for jump-around navigation.
- Completed step indicators are derived from saved form data, not just navigation history.

## Step 1: Student Information

- Partial-program applications continue to capture student identity and grade details.
- Student address capture prefers reusable address selection where practical.
- Collects detailed student information including:
  - Legal first, middle, and last name
  - Preferred name
  - Gender
  - Date of birth
  - Current grade
  - Applying-for grade
  - Primary/home phone number
  - Physical address (via reusable address picker or new address entry)
  - Mailing address difference flag
  - Citizenship status
  - Previous Manitoba school attendance flag
  - Church attending
  - Denomination
- Displays admissions guidance notes above the form.
- Performs client-side validation for required fields.
- Shows inline field errors.
- Shows a summary validation note below the Next button when validation errors exist.
- Creates the related Drupal student profile when starting a brand new application.
- Skips profile creation when editing/resuming an existing draft.
- On new application creation, relationship fields (e.g. `field_physical_address`) are included in the initial POST body so the address is linked immediately without a follow-up PATCH.

## Step 2: Health Information

- Emergency contacts are modeled as reusable person references where appropriate.
- Long-form medical information remains on the concrete application bundle.
- Collects health and emergency information including:
  - Manitoba health number segments
  - Emergency contact (selected from reusable Person records or created inline)
  - Emergency contact phone (from person record or entered directly)
  - Allergies
  - Frequently used medications
  - Medical restrictions
- Performs client-side validation for required health fields.
- Shows inline field errors.
- Shows a summary validation note below the navigation buttons when validation errors exist.

## Step 3: Parent / Guardian Information

- Step focuses on selecting, reviewing, and editing reusable Person records rather than re-entering guardian fields every time.
- Required shared relationship fields such as custody and household status remain part of the application workflow.
- Primary and secondary guardian selection is obvious, reversible, and mobile-friendly.
- UI copy refers to roles such as primary guardian, secondary guardian, and other relationship labels instead of assuming mother/father only.
- Guardian person cards surface:
  - Name
  - Address (via reusable address reference)
  - Typed email contacts
  - Typed phone contacts
  - Workplace
- Collects household relationship details including:
  - Parents’ relationship status
  - Who the student lives with
  - Custody description
- Performs client-side validation for required relationship/custody fields.
- Shows inline field errors.
- Shows a summary validation note below the navigation buttons when validation errors exist.

## Step 4: Additional Support Declaration

- Collects long-form text in these areas:
  - Academic support
  - Diagnosis/assessments
  - Psychological support
- Includes a required frontend confirmation checkbox stating that the page has been reviewed, even if no additional support details apply.
- Performs client-side validation for required for support declaration
- Shows inline field errors.
- Shows a summary validation note below the navigation buttons when validation errors exist.
- Review confirmation is persisted to Drupal as a dedicated application field.

## Step 5: Parent Questionnaire

- Questionnaire and commitment data are application-specific.
- Questionnaire ownership can reference an existing person record where that improves reuse.
- Collects questionnaire responses including:
  - Parent name (or linked person reference)
  - Christian testimony
  - Reason for interest in the school
- Performs client-side validation for required questionnaire responses.
- Shows inline field errors.
- Shows a summary validation note below the navigation buttons when validation errors exist.

## Step 6: Commitment And Submission

- Displays statement-of-commitment content for review.
- Includes signature capture using an HTML canvas signature pad.
- Allows clearing and re-drawing the signature.
- Requires a signature before submission.
- Blocks submission if required earlier sections are incomplete.
- Shows a styled in-app warning modal listing incomplete required sections before submit.
- On successful submission:
  - Sends all accumulated application data in one PATCH request.
  - Marks the application as submitted.
  - Records submission timestamp.
  - Shows a success confirmation state.

## Step 7: Documents Upload (Optional)

- Allows uploading supporting documents (transcripts, immunization records, etc.).
- File upload input with drag-and-drop support.
- Client-side file validation:
  - Maximum file size: 5 MB per file.
  - File type validation before submission.
- Multiple files can be uploaded in sequence.
- Uploaded files are created as `document` entities linked to the application.
- Displays confirmation after successful upload.
- Shows error messages if upload fails.
- Optional step — users can proceed without uploading documents.
- Uploaded document metadata is displayed on the application detail page.

## Step 8: Review And Final Submission

- Summary review page displaying all collected application information.
- Allows quick navigation back to any previous step for edits.
- Final confirmation of all information before actual submission.
- Displays a final submit button to trigger application submission.
- Submission endpoint sends all accumulated application data to Drupal.
- On successful submission:
  - Application status is updated to "submitted".
  - Submission timestamp is recorded.
  - User is redirected to payment confirmation page if payment is required.
  - Confirmation state displays success messaging.

## Draft Saving And Resume Features

- New applications create a Drupal `application` draft entity when the application flow is opened so step 1 blur autosave works immediately.
- Draft applications are resumed by selecting a specific application from the dashboard.
- Application page fetches the selected application by ID on load.
- Drupal attributes are mapped back into the frontend step data model.
- Saved data hydrates each step’s `initialData` on resume.
- Draft hydration supports logout/login continuity because data is reloaded from Drupal.
- Completed step checkmarks persist after logout/login because completion is recomputed from Drupal-persisted section review fields.
- Autosave runs when a field loses focus on the supported steps.
- Autosave patches only the changed application field back to Drupal.
- Autosave supports both plain fields and Drupal `text_long` fields.

## Validation And Error Handling

- Each validated form step performs client-side validation before advancing.
- The frontend validates required UI inputs, typed contact formatting (`type:value`), and obvious record-selection gaps.
- Invalid fields are marked with `aria-invalid` and inline error messages with proper labels and `aria-describedby` relationships.
- Validation summary note appears below action buttons when a step has validation problems.
- Server-returned validation errors for person, address, or application relationships are surfaced directly to the user.
- Additional Support Declaration requires explicit review confirmation so every step in the wizard is validated.
- Step review/validation status for all pages is persisted in Drupal and rehydrated on resume.
- Submission prevents incomplete required sections from being submitted.
- Commitment step prevents submission without a signature.
- General API errors are surfaced to users using styled alert banners.
- Loading states are shown during data fetches and long-running actions.

## Application Detail View

- Dedicated detail page for an existing application.
- Fetches the application entity by ID.
- Fetches included student profile data.
- Separately fetches documents linked to the application.
- Displays:
  - Status badge
  - Started date
  - Student information summary
  - Uploaded document titles
  - Submission date when available
- Includes a back-to-dashboard action.
- Shows loading and error states.

## Payment Features

- Payment workflows are integrated after successful application submission.
- Applications can be linked to payment entities via the `field_payment` relationship.
- Payment tracking includes:
  - Receipt URL stored in `field_receipt_url` attribute on payment nodes.
  - Payment status tracked separately via backend checkout system.
- Dashboard displays a link to receipt/payment information for submitted applications.

### Payment Success Page

- Dedicated confirmation page that users are redirected to after application submission if payment is required.
- Route: `/payment-success?session_id={session_id}`.
- Polls the checkout status API endpoint (`/api/payments/checkout-status?session_id={session_id}`) to verify payment completion.
- Polling configuration:
  - Maximum 10 polling attempts.
  - 3-second interval between attempts.
  - Automatically stops after successful confirmation or max attempts reached.
- Displays:
  - Payment confirmation message once status is verified.
  - Success state showing payment and submission completion.
  - Link back to dashboard after successful payment.
- Handles polling timeout gracefully with user-friendly messaging.
- Frontend state tracks payment confirmation with receipt URL via the `paymentByApplication` state module.

### Payment And Application Linking

- Applications can include a relationship to payment entities (`field_payment`).
- Payment entities are `node--payment` type with associated metadata.
- Receipt URLs are stored as attributes on payment nodes and displayed in dashboards and detail pages.

## Drupal API Integration

- Centralized API client wraps Drupal requests.
- Supports:
  - GET
  - POST
  - PATCH
  - DELETE
  - Binary file upload
- Mutating requests fetch a fresh CSRF token before sending data.
- Requests always include Drupal session cookies.
- JSON:API errors are parsed into readable frontend error messages.
- Login/logout flows use Drupal endpoints while entity reads/writes use JSON:API.

## State Management Direction

- Plain JavaScript module state is used for auth state and application state (no external state management library).
- Frontend state tracks:
  - The selected application type
  - Reusable person records available to the user
  - Reusable address records available to the user
  - The current application draft and its referenced records
- Application state preserves references to reusable records instead of flattening guardian data into the application draft.
- Auth state module handles:
  - Login
  - Registration
  - Session bootstrap from an active backend session
  - Session verification
  - Logout
- Application state module handles:
  - Fetching application lists
  - Creating applications (with type selection)
  - Fetching a draft by ID
  - Autosaving draft changes
  - Deleting draft applications
  - Final submission patch
  - Document upload/create actions
  - Payment tracking and receipt URLs (via `paymentByApplication` state)
- Current application is tracked in state to support draft continuation.
- Payment confirmation data is cached in the state module to track receipt URLs by application ID.

## Accessibility And UX Requirements

- Semantic headings, forms, and labels are used throughout the UI.
- Record library and inline guardian editing must remain keyboard accessible.
- Person cards, dialogs, and selection controls use semantic buttons, labels, and headings.
- Reusable-record selection is optimized for low-friction editing on both desktop and mobile.
- Protected flows redirect unauthenticated users predictably.
- Loading spinners are paired with text labels.
- Inline errors use accessible relationships via `aria-describedby` and `aria-invalid` where implemented.
- Stepper buttons expose accessible labels for current and completed states.
- Modal warning uses `role="dialog"` and `aria-modal="true"`.
- Forms support keyboard submission and button-based step navigation.

## Testing Coverage Direction

- Vitest unit and integration test coverage exists for core frontend behavior.
- Tests should cover:
  - Choosing an application type.
  - Viewing reusable people and addresses from the record library.
  - Selecting an existing person for guardian fields.
  - Inline person creation and editing.
  - Typed contact-list validation (`type:value` format).
  - Address reuse and address creation flows.
  - API client behavior (GET, POST, PATCH, DELETE, file upload).
  - Protected route behavior and login redirects.
  - Progress stepper rendering and navigation state.
  - Login page behavior and authentication flow.
  - Registration form validation.
  - Dashboard application list, delete functionality, and status display.
  - Student information step validation and submission.
  - Application page flow, step transitions, auto-save, and draft hydration.
  - Review step before final submission.
  - Commitment step submission safeguards and signature validation.
  - Auth state management (login, registration, session bootstrap, logout).
- Fetch is mocked using standard test utilities (e.g., `vi.stubGlobal` or a fetch mock) during Vitest tests.
- Mock API endpoints include session management, user data, application entities, document uploads, person records, and address records.

## Frontend Boundaries

- Business rules, ownership checks, and final validation remain backend-driven through Drupal.
- Frontend provides a user-friendly reuse workflow for `Person` and `Address` records but does not become the source of truth for those records.
- Frontend renders and edits application data but does not independently decide permissions or workflow authority.
- Application detail page currently displays uploaded document metadata rather than a full document management UI.

## Environment Configuration

- Application configuration uses environment variables for all environment-specific values.
- **BACKEND_URL** – Canonical backend URL at the Compose or deployment layer. Frontend-facing Vite env values are derived from this URL rather than maintained separately.
- **VITE_BACKEND_BASE_URL** – Frontend-exposed backend base URL derived from `BACKEND_URL` for browser code.
- Session management relies entirely on HttpOnly cookies set by Drupal (not accessible from JavaScript).
- CSRF tokens are fetched fresh from the backend before each state-changing request.
- File upload validation:
  - Maximum file size per file: 5 MB (client-side pre-check for UX).
  - Server-side validation is authoritative for final validation and security checks.