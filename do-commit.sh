#!/bin/bash
set -e
cd /mnt/c/Users/phdet/Downloads/slab-crack-dashboard
git add -A
git status --short
git commit -F commit-msg.txt
git push
rm -f commit-msg.txt
