# Дента для iPhone (ClinicOS)

Та же программа, что Android **2.24**.  
Идентификатор: `ru.denta.clinic`

CocoaPods, Node.js и `pod install` **не нужны**.

## Как открыть в Xcode

1. Закройте Xcode полностью (**Cmd+Q**), если он открыт.
2. В Terminal:

```bash
cd ~/Desktop/ClinicOS-ios
git pull
open Denta.xcworkspace
```

Если папки `ClinicOS-ios` нет:

```bash
cd ~/Desktop
git clone https://github.com/Apex-st/ClinicOS.git ClinicOS-ios
open ClinicOS-ios/Denta.xcworkspace
```

3. В Xcode: слева выберите target **App**.
4. **Signing & Capabilities** → галочка **Automatically manage signing** → Team: ваш Apple ID.
5. Сверху выберите симулятор **iPhone** (не «Any iOS Device»).
6. Нажмите **▶**. Первая сборка 2–5 минут.

Открывать нужно **`Denta.xcworkspace`** в корне репозитория. Не `App.xcodeproj` из старых копий на Рабочем столе.

## Если Xcode ругается на подпись

Bundle ID `ru.denta.clinic` может быть занят на вашем Apple ID. Тогда в Signing измените на `ru.denta.clinic.вашник` — только для теста на своём Mac.

## TestFlight

Нужен аккаунт Apple Developer (99 $/год): Archive → Distribute App → TestFlight.
