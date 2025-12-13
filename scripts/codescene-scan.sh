#!/bin/bash
# CodeScene full codebase scan
# Usage: ./scripts/codescene-scan.sh [--all] [--issues-only]
#
# By default, only shows files with issues.
# Use --all to show all files including healthy ones.
# Use --issues-only to suppress score output (just issues).

SHOW_ALL=false
ISSUES_ONLY=false

for arg in "$@"; do
  case $arg in
    --all)
      SHOW_ALL=true
      ;;
    --issues-only)
      ISSUES_ONLY=true
      ;;
    --help|-h)
      echo "Usage: ./scripts/codescene-scan.sh [--all] [--issues-only]"
      echo ""
      echo "By default, only shows files with issues."
      echo "  --all          Show all files including healthy ones"
      echo "  --issues-only  Only show issue details (skip 'No issues found' messages)"
      echo "  --help, -h     Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Use --help for usage information" >&2
      exit 1
      ;;
  esac
done

# Find source files, excluding node_modules, tests, stories, and .venv
find next-client/src express-server/src common pipeline-worker/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/__tests__/*" \
  ! -name "*.test.*" \
  ! -name "*.spec.*" \
  ! -name "*.stories.*" \
  2>/dev/null | sort | while IFS= read -r f; do

  # Run cs review and clean up output
  output=$(cs review "$f" 2>&1 | grep -v "^202" | grep -v "DEBUG" | grep -v "WARNING" | grep -v "^$")

  # Extract score (using -oE for portability across Linux/macOS)
  score=$(echo "$output" | grep "Overall code health score" | grep -oE '[0-9]+\.[0-9]+')

  # Check for issues (explicit if for robustness)
  if echo "$output" | grep -q "Issue:"; then
    has_issues="yes"
  else
    has_issues="no"
  fi

  if [ "$SHOW_ALL" = true ] || [ "$has_issues" = "yes" ]; then
    if [ "$ISSUES_ONLY" = true ]; then
      if [ "$has_issues" = "yes" ]; then
        echo "=== $f (Score: $score) ==="
        echo "$output" | grep -A 5 "Issue:"
        echo ""
      fi
    else
      echo "=== $f (Score: $score) ==="
      if [ "$has_issues" = "yes" ]; then
        echo "$output" | grep -A 5 "Issue:"
      else
        echo "  No issues found"
      fi
      echo ""
    fi
  fi
done
