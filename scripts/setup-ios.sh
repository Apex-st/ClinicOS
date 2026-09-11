#!/bin/sh
# Сборка iOS-проекта Денты. Запускать на Mac, в корне репозитория ClinicOS.
set -eu
cd "$(dirname "$0")/.."
if ! command -v npm >/dev/null 2>&1; then
  echo "Нужен Node.js 22: https://nodejs.org/"
  exit 1
fi
if ! command -v pod >/dev/null 2>&1; then
  echo "Нужен CocoaPods: sudo gem install cocoapods"
  exit 1
fi
npm install
npm run build:native
if [ -f dist-apk/client/_shell.html ]; then
  cp dist-apk/client/_shell.html dist-apk/client/index.html
fi
rm -f dist-apk/client/*.apk dist-apk/client/*.zip
npx cap sync ios
cd ios/App
pod install
echo
echo "Откройте в Xcode файл:"
echo "  $(pwd)/App.xcworkspace"
echo "Не открывайте App.xcodeproj."
