#!/bin/bash
# Двойной щелчок: обновляет проект и открывает Xcode. CocoaPods больше не нужен.
set -e
export LANG=en_US.UTF-8
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
if [ -d .git ]; then
  git pull || true
fi
open ios/App/App.xcodeproj
