# sequence.md — FP&A Web App Sequence Diagrams

## 1. Save changes to an existing Scenario

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Adjust levers, click "Save"
    Frontend->>Backend: PUT /api/scenarios/{id} {leverValues}
    Backend->>Database: SELECT scenarios WHERE id = {id}
    Database-->>Backend: scenario row / not found
    Backend->>Database: SELECT territory WHERE territory_key = {territory_key}
    Database-->>Backend: territory row / not found
    Backend->>Database: SELECT fiscal_years WHERE year = {fiscal_year}
    Database-->>Backend: fiscal_year row / not found

    alt Valid: edit-link confirmed AND scenario exists AND territory_key valid AND fiscal_year valid
        Backend->>Database: UPDATE scenarios SET lever values, last_saved_at WHERE id = {id}
        Database-->>Backend: update confirmed
        Backend-->>Frontend: 200 OK {updated scenario}
        Frontend-->>User: Show "Scenario saved"
    else Invalid: view-link OR scenario not found OR territory_key invalid OR fiscal_year invalid
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 2. Save as new Scenario

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Adjust levers, click "Save as new"
    Frontend->>Backend: POST /api/scenarios {name, territory_key, fiscal_year, leverValues}
    Backend->>Database: SELECT territory WHERE territory_key = {territory_key}
    Database-->>Backend: territory row / not found
    Backend->>Database: SELECT fiscal_years WHERE year = {fiscal_year}
    Database-->>Backend: fiscal_year row / not found

    alt Valid: edit-link confirmed AND territory_key valid AND fiscal_year valid
        Backend->>Database: INSERT INTO scenarios (id, name, territory_key, fiscal_year, lever values, last_saved_at)
        Database-->>Backend: insert confirmed, new id
        Backend-->>Frontend: 201 Created {new scenario}
        Frontend-->>User: Show "Scenario saved as new"
    else Invalid: view-link OR territory_key invalid OR fiscal_year invalid
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 3. Delete a Scenario

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Click "Delete" on a Scenario
    Frontend->>Backend: DELETE /api/scenarios/{id}
    Backend->>Database: SELECT scenarios WHERE id = {id}
    Database-->>Backend: scenario row / not found

    alt Valid: edit-link confirmed AND scenario exists
        Backend->>Database: DELETE FROM scenarios WHERE id = {id}
        Database-->>Backend: delete confirmed
        Backend-->>Frontend: 200 OK
        Frontend-->>User: Show "Scenario deleted"
    else Invalid: view-link OR scenario not found
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 4. Generate a Report

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Select type/period/territory/currency/sections, click "Generate"
    Frontend->>Backend: POST /api/reports {report_type, territory_key, fiscal_year, period, currency, sections}
    Backend->>Database: SELECT fiscal_years WHERE year = {fiscal_year}
    Database-->>Backend: fiscal_year row / not found
    Backend->>Database: SELECT territory WHERE territory_key = {territory_key} (skipped if null = All Territories)
    Database-->>Backend: territory row / not found
    Backend->>Backend: Validate each section is one of the 5 allowed section_name values
    Backend->>Backend: Compute live figures for the requested scope (freeze at this moment)

    alt Valid: edit-link confirmed AND fiscal_year valid AND territory_key valid-or-null AND sections all valid
        Backend->>Database: INSERT INTO reports (id, report_type, territory_key, fiscal_year, period, currency, frozen_figures, generated_at)
        Database-->>Backend: insert confirmed, new report id
        loop each selected section
            Backend->>Database: INSERT INTO report_sections (report_id, section_name)
            Database-->>Backend: insert confirmed
        end
        Backend-->>Frontend: 201 Created {report}
        Frontend-->>User: Show generated report preview
    else Invalid: view-link OR fiscal_year invalid OR territory_key invalid OR unknown section_name
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 5. Regenerate a Report

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Click "Regenerate" on an existing report
    Frontend->>Backend: POST /api/reports/{id}/regenerate
    Backend->>Database: SELECT reports WHERE id = {id}
    Database-->>Backend: original report row / not found
    Backend->>Backend: Re-validate fiscal_year, territory_key, sections from the original report
    Backend->>Backend: Recompute live figures fresh (new frozen snapshot)

    alt Valid: edit-link confirmed AND original report exists AND scope still valid
        Backend->>Database: INSERT INTO reports (new id, same scope, new frozen_figures, new generated_at)
        Database-->>Backend: insert confirmed, new report id
        loop each section from the original report
            Backend->>Database: INSERT INTO report_sections (new report_id, section_name)
            Database-->>Backend: insert confirmed
        end
        Backend-->>Frontend: 201 Created {new report} — original report unchanged
        Frontend-->>User: Show new report preview
    else Invalid: view-link OR original report not found
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 6. Save a Forecast Version

```mermaid
%% GAP: no persistence table for Forecast versions exists in design.md §4 or erd.md.
%% Shown as always-invalid until a table is defined and approved.
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Adjust drivers, click "Save Version"
    Frontend->>Backend: POST /api/forecast/versions {territory_key, fiscal_year, cutover, method, drivers}
    Backend->>Backend: Check for a Forecast persistence table

    alt Valid: table exists AND edit-link confirmed AND territory_key/fiscal_year valid
        Backend->>Database: INSERT INTO forecast_versions (not yet defined)
        Database-->>Backend: insert confirmed
        Backend-->>Frontend: 201 Created {forecast version}
        Frontend-->>User: Show "Version saved"
    else Invalid: no Forecast table defined yet
        Backend-->>Frontend: 501 error "Forecast persistence not implemented"
        Frontend-->>User: Show error message, no data written
    end
```

## 7. Trigger manual "Refresh Now" (Data Library)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Click "Refresh Now" on a dataset
    Frontend->>Backend: POST /api/data-library/{dataset_name}/refresh
    Backend->>Database: SELECT datasets WHERE name = {dataset_name}
    Database-->>Backend: dataset row / not found
    Backend->>Backend: Read source file from Google Drive, parse, validate

    alt Valid: edit-link confirmed AND dataset_name exists in datasets
        Backend->>Database: DELETE FROM dataset_issues WHERE dataset_name = {dataset_name}
        Database-->>Backend: delete confirmed
        loop each issue found during validation
            Backend->>Database: INSERT INTO dataset_issues (id, dataset_name, row_ref, message)
            Database-->>Backend: insert confirmed
        end
        Backend->>Database: UPDATE dataset_sync_status SET row_count, last_refreshed_at, validation_status WHERE dataset_name = {dataset_name}
        Database-->>Backend: update confirmed
        Backend-->>Frontend: 200 OK {sync status, issues}
        Frontend-->>User: Show updated row count / Pass-Fail / issue list
    else Invalid: view-link OR dataset_name not found
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, no data written
    end
```

## 8. Scheduled automatic refresh

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    Note over User: User is a Scheduler (system job), not a person
    User->>Backend: Scheduled interval elapsed — trigger refresh(dataset_name)
    Backend->>Database: SELECT datasets WHERE name = {dataset_name}
    Database-->>Backend: dataset row / not found
    Backend->>Backend: Read source file from Google Drive, parse, validate

    alt Valid: dataset_name exists in datasets
        Backend->>Database: DELETE FROM dataset_issues WHERE dataset_name = {dataset_name}
        Database-->>Backend: delete confirmed
        loop each issue found during validation
            Backend->>Database: INSERT INTO dataset_issues (id, dataset_name, row_ref, message)
            Database-->>Backend: insert confirmed
        end
        Backend->>Database: UPDATE dataset_sync_status SET row_count, last_refreshed_at, validation_status WHERE dataset_name = {dataset_name}
        Database-->>Backend: update confirmed
        Backend-->>Frontend: Push/next-load reflects new sync status
        Frontend-->>User: Data Library shows updated status on next view
    else Invalid: dataset_name not found (misconfigured job)
        Backend-->>Frontend: Log error, no screen update
        Frontend-->>User: Last-known sync status remains displayed, no data written
    end
```

## 9. Upload a new source file (Data Library)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Choose file, click "Upload"
    Frontend->>Backend: POST /api/data-library/{dataset_name}/upload (file)
    Backend->>Database: SELECT datasets WHERE name = {dataset_name}
    Database-->>Backend: dataset row / not found
    Backend->>Backend: Validate uploaded file matches expected schema for dataset_name

    alt Valid: edit-link confirmed AND dataset_name exists AND file schema matches
        Backend->>Backend: Write file to Google Drive shared folder (overwrite source)
        Backend->>Database: DELETE FROM dataset_issues WHERE dataset_name = {dataset_name}
        Database-->>Backend: delete confirmed
        loop each issue found during re-validation
            Backend->>Database: INSERT INTO dataset_issues (id, dataset_name, row_ref, message)
            Database-->>Backend: insert confirmed
        end
        Backend->>Database: UPDATE dataset_sync_status SET row_count, last_refreshed_at, validation_status WHERE dataset_name = {dataset_name}
        Database-->>Backend: update confirmed
        Backend-->>Frontend: 200 OK {sync status, issues}
        Frontend-->>User: Show "File uploaded and refreshed"
    else Invalid: view-link OR dataset_name not found OR file schema mismatch
        Backend-->>Frontend: 4xx error {reason}
        Frontend-->>User: Show error message, source file NOT overwritten, no data written
    end
```

## 10. "Save analysis" / "Export" (Variance Analysis)

```mermaid
%% GAP: sitemap.md Known Gaps — buttons are drawn but not wired to real output yet.
%% Shown as always-invalid until a destination table/format is defined and approved.
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Click "Save analysis" or "Export"
    Frontend->>Backend: POST /api/variance-analysis/save-or-export
    Backend->>Backend: Check for a wired destination (table or export target)

    alt Valid: destination implemented AND edit-link confirmed
        Backend->>Database: INSERT INTO (not yet defined)
        Database-->>Backend: insert confirmed
        Backend-->>Frontend: 200 OK
        Frontend-->>User: Show "Saved" / deliver export
    else Invalid: not wired to any table or export target yet
        Backend-->>Frontend: 501 error "Not implemented"
        Frontend-->>User: Show error message, no data written
    end
```
