---
description: Create a T3C report via browser automation
user-invocable: true
---

# Create Report

Automate report creation using Playwright browser automation.

## Prerequisites

- Local dev server running (`pnpm dev` in next-client)
- User must be logged into T3C in the browser session (skill will check and prompt if needed)

## Usage

```
/create-report [csv_path] [options]
```

### Arguments

- `csv_path`: Path to CSV file (default: `next-client/public/Talk-to-the-City-Sample.csv`)

### Options

- `--name "Report Name"`: Report title (default: derived from filename)
- `--description "..."`: Report description (default: "Generated via automation")
- `--cruxes`: Enable crux extraction (default: enabled)
- `--no-cruxes`: Disable crux extraction
- `--bridging`: Enable bridging scores (default: disabled)
- `--url <base_url>`: Base URL (default: `http://localhost:3000`)

## Examples

```
/create-report                                              # Uses Talk-to-the-City-Sample.csv
/create-report examples/sample_csv_files/pets.csv           # Custom CSV
/create-report data.csv --name "My Analysis" --bridging     # With options
/create-report --url https://staging.tttc.dev               # Against staging
```

## Workflow

When the user invokes `/create-report`, follow these steps:

### 1. Parse Arguments

Extract from the user's command:
- CSV file path (positional, or default to `next-client/public/Talk-to-the-City-Sample.csv`)
- Report name (from `--name` or derive from CSV filename, e.g., `pets.csv` → "Pets Report")
- Description (from `--description` or default to "Generated via automation")
- Cruxes enabled (default true unless `--no-cruxes`)
- Bridging enabled (only if `--bridging` specified)
- Base URL (from `--url` or default `http://localhost:3000`)

### 2. Verify CSV File Exists

Use the Read tool to verify the CSV file exists at the specified path. Convert relative paths to absolute. If not found, inform the user and stop.

### 3. Navigate and Check Auth

```
browser_navigate to {base_url}/create
browser_snapshot to check page state
```

**Detecting auth state in the snapshot:**
- **Logged in**: You'll see the form with "Report title" and "General description" textboxes
- **Not logged in**: The "Generate the report" button will be disabled, or you'll see a sign-in modal/prompt

If not logged in:
1. Tell the user: "Please log in to T3C in the browser window. Let me know when you're ready."
2. Wait for user confirmation
3. `browser_snapshot` again to verify the form is now accessible

### 4. Fill Report Details

The snapshot will show textboxes. Use `browser_type` to fill them:

1. Find the textbox for "Report title" and type the report name
2. Find the textbox for "General description" and type the description

Example:
```
browser_type element="Report title input" ref="<ref from snapshot>" text="My Report"
browser_type element="Description input" ref="<ref from snapshot>" text="Generated via automation"
```

### 5. Upload CSV File

1. Click the "Choose file" button:
   ```
   browser_click element="Choose file button" ref="<ref from snapshot>"
   ```

2. Upload the file (this fulfills the file chooser dialog):
   ```
   browser_file_upload paths=["<absolute_path_to_csv>"]
   ```

3. `browser_snapshot` to check the result. Three possible outcomes:

   **A. Success**: You'll see the filename displayed and a "Reset" button. Continue to step 6.

   **B. Warning modal** ("Non-Standard CSV Format Detected"): The CSV has non-standard column names but can be processed. Click "Proceed with Upload" to continue:
   ```
   browser_click element="Proceed with Upload button" ref="<ref>"
   ```
   Then `browser_snapshot` again to confirm the file is now shown.

   **C. Error**: You'll see an error banner (file too large, invalid format, missing required columns). Report the error to the user and stop.

### 6. Configure Advanced Settings

Since cruxes and bridging both default to OFF in the UI, you need to expand advanced settings if either is requested.

**If cruxes are enabled (the skill's default) OR bridging is enabled:**

1. Click to expand:
   ```
   browser_click element="Show advanced settings button" ref="<ref>"
   ```

2. `browser_snapshot` to see the switches

3. **For cruxes** (if enabled, which is the default):
   - Find the switch labeled "Extract cruxes to distill conflicting opinions"
   - Click it to turn it ON

4. **For bridging** (only if `--bridging` was specified):
   - Find the switch labeled "Score claims and quotes using Perspective API bridging attributes"
   - Click it to turn it ON

**If `--no-cruxes` and no `--bridging`:** Skip this step entirely.

### 7. Submit the Form

```
browser_click element="Generate the report button" ref="<ref>"
```

### 8. Wait for Completion

After clicking submit, the URL changes immediately to `/report/{id}` and shows processing progress.

Monitor for completion:
```
browser_snapshot every 15-20 seconds
```

**What to look for:**
- **Still processing**: Page shows progress bar with status messages like:
  - "Your report is queued..."
  - "Clustering arguments..."
  - "Extracting claims..."
- **Success**: Page shows the full report with topics, claims, outline navigation, etc.
- **Error**: Error message appears

Processing typically takes 1-5 minutes depending on CSV size. Keep checking until the report content appears.

### 9. Report Results

**On success:**
- The browser will be on the report page (URL like `/report/...`)
- Take a screenshot: `browser_take_screenshot`
- Tell the user: "Report created successfully! View it at: {current_url}"

**On error:**
- Report the error message shown in the UI
- Suggest: "Try a smaller CSV file or check the format matches the expected columns (id, comment, optional interview)"

## Accessibility Snapshot Reference

The `browser_snapshot` returns an accessibility tree. Here's what to look for:

| Element | What to find in snapshot |
|---------|-------------------------|
| Title input | textbox with name containing "Report title" or "title" |
| Description input | textbox with name containing "description" |
| Choose file button | button with text "Choose file" |
| Reset button | button with text "Reset" (appears after file upload) |
| CSV warning modal | alertdialog with title "Non-Standard CSV Format Detected" |
| Proceed with Upload | button with text "Proceed with Upload" (in warning modal) |
| Advanced settings | button with text "Show advanced settings" or "Hide advanced settings" |
| Cruxes switch | switch with name containing "cruxes" or "conflicting opinions" |
| Bridging switch | switch with name containing "bridging" or "Perspective API" |
| Submit button | button with text "Generate the report" |

## Troubleshooting

**"Please log in" keeps appearing**: The browser session doesn't persist between Claude Code sessions. Log in once at the start of your session.

**File upload fails**: Ensure the path is absolute. Use the full path like `/home/user/project/data.csv`.

**Processing takes forever**: Large CSVs (>100KB) can take several minutes. The skill will keep checking. If it exceeds 10 minutes, there may be a server issue.

**Cruxes/bridging switches not visible**: Make sure "Show advanced settings" was clicked first.

**Button is disabled**: User is not logged in or email is not verified. Check the browser for sign-in prompts.

## Batch Usage Notes

For creating multiple reports in sequence:
- Use explicit `--name` to give each report a unique title
- The browser stays logged in within a Claude Code session
- Consider smaller CSV files for faster iteration
