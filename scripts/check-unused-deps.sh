#!/usr/bin/env bash
# Check for unused dependencies across all packages
# Usage: ./scripts/check-unused-deps.sh

set -e

echo "=== Checking for unused dependencies ==="

for pkg in common express-server next-client pipeline-worker utils; do
  echo ""
  echo "📦 $pkg:"

  cd "$pkg"
  DEPS=$(npx depcheck --json 2>/dev/null | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    const deps = [...(d.dependencies || []), ...(d.devDependencies || [])];
    console.log(deps.join('\n'));
  ")
  cd ..

  if [ -z "$DEPS" ]; then
    echo "  ✓ No unused dependencies"
  else
    echo "$DEPS" | while read -r dep; do
      if [ -n "$dep" ]; then
        echo "  - $dep"
      fi
    done
  fi
done

echo ""
echo "Note: depcheck has false positives for framework configs, dynamic imports, and peer deps."
echo "Always verify before removing."
