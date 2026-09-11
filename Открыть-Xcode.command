#!/bin/bash
# Двойной щелчок на Mac: ставит Node/CocoaPods при необходимости,
# собирает iOS-зависимости и открывает проект в Xcode.
set -e
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

cd "$(dirname "$0")"
echo "Папка проекта: $(pwd)"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "Ставлю Node.js 22 (нужен пароль Mac)…"
  PKG="/tmp/node-v22.23.2.pkg"
  curl -fL "https://nodejs.org/dist/v22.23.2/node-v22.23.2.pkg" -o "$PKG"
  sudo installer -pkg "$PKG" -target /
  export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "Ставлю CocoaPods (нужен пароль Mac)…"
  sudo gem install cocoapods
fi

echo "npm install…"
npm install

echo "pod install…"
cd ios/App
pod install
echo
echo "Открываю Xcode…"
open App.xcworkspace
