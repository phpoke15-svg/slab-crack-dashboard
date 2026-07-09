#!/bin/bash
set -e
cd /mnt/c/Users/phdet/Downloads/slab-crack-dashboard
git rm -f commit-msg.txt do-commit.sh 2>/dev/null || true
git add -A
if git diff --cached --quiet; then exit 0; fi
git commit -m "Remove accidental commit helper files."
git push
