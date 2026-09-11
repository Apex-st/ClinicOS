# ClinicOS — Дента для iPhone

Это **та же программа**, что Android-версия **2.24**: запись, карточки, зубная формула, фотоархив, планы, касса, скидки, резервная копия.

Идентификатор приложения: `ru.denta.clinic`  
Версия: **2.24** (build 44)

Репозиторий Android: [Apex-st/denta-cabinet](https://github.com/Apex-st/denta-cabinet)

---

## Важно сразу

Файл `.ipa` в этом репозитории **не лежит**. Его нельзя собрать на Linux и нельзя поставить на iPhone так же просто, как APK на Android.

Apple ставит приложение только так:

1. **Свой iPhone с Mac и Xcode** — бесплатный Apple ID, подпись живёт 7 дней.
2. **TestFlight** — нужен аккаунт Apple Developer (99 $ / год). Тогда тестировщики ставят приложение по ссылке, без Mac.

Ниже оба пути по шагам.

---

## Что нужно на Mac

- Mac с **Xcode** из App Store (бесплатно).
- При первом запуске Xcode: Agree, дождаться компонентов, Xcode → Settings → Accounts → Apple ID.

**Node.js и CocoaPods больше не нужны.** Проект открывается сразу в Xcode.

---

---

## Шаг 1. Скачать проект

В Terminal:

```bash
cd ~/Desktop
git clone https://github.com/Apex-st/ClinicOS.git
cd ClinicOS
```

Или GitHub → Code → Download ZIP → распаковать на Рабочий стол → папка `ClinicOS`.

Если раньше уже клонировали **пустой** ClinicOS из Xcode — закройте Xcode и скачайте заново (этот репозиторий больше не шаблон SwiftUI).

---

## Шаг 2. Открыть в Xcode

CocoaPods (`pod install`) **не нужен**.

1. Закройте Xcode (Cmd+Q), если он открыт.
2. В Finder: `ClinicOS-ios` → `ios` → `App`.
3. Дважды щёлкните **`App.xcodeproj`** (синяя иконка). Можно и `App.xcworkspace`.
4. Подождите 1–2 минуты: Xcode сам скачает пакет Capacitor.
5. Сверху выберите симулятор **iPhone** → нажмите **▶**.

Если проект уже был скачан раньше:

```bash
cd ~/Desktop/ClinicOS-ios
git pull
open ios/App/App.xcodeproj
```

---

В той же папке `ClinicOS`:

```bash
npm install
npx cap sync ios
cd ios/App
pod install
cd ../..
```

Появится файл `ios/App/App.xcworkspace`. **Его** и открывают. Файл `.xcodeproj` открывать нельзя — без CocoaPods программа не соберётся.

Если `pod install` пишет, что не найден `pod`:

```bash
sudo gem install cocoapods
cd ios/App
pod install
```

### Если Xcode уже открылся с ошибкой Podfile.lock

Закройте Xcode полностью (**Cmd+Q**). Вставьте в Terminal **весь блок целиком** и нажмите Return. Если спросит пароль — это пароль Mac, буквы не отображаются:

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export LANG=en_US.UTF-8
if ! command -v npm >/dev/null; then
  curl -fL https://nodejs.org/dist/v22.23.2/node-v22.23.2.pkg -o /tmp/node.pkg
  sudo installer -pkg /tmp/node.pkg -target /
fi
if ! command -v pod >/dev/null; then
  sudo gem install cocoapods
fi
if [ ! -d "$HOME/Desktop/ClinicOS/.git" ]; then
  git clone https://github.com/Apex-st/ClinicOS.git "$HOME/Desktop/ClinicOS"
fi
cd "$HOME/Desktop/ClinicOS"
git pull
npm install
cd ios/App
pod install
open App.xcworkspace
```

После этого в Xcode: симулятор iPhone сверху → кнопка ▶.

---

---

## Шаг 3. Открыть в Xcode и поставить на свой iPhone

**С сайта GitHub файл открыть нельзя** — только с Mac, из Finder.

1. В Finder зайдите: `ClinicOS` → `ios` → `App`.
2. Дважды щёлкните **`App.xcworkspace`** (иконка белая с синим). Не `App.xcodeproj`.
3. Если Xcode пишет **Failed to open document** — сначала в Terminal:

```bash
cd ~/Desktop/ClinicOS
git pull
npm install
cd ios/App
pod install
open App.xcworkspace
```

`pod install` создаёт папку Pods. Без неё старый workspace мог не открываться.

4. Слева в навигаторе выберите синюю иконку **App**.
5. Вкладка **Signing & Capabilities**:
   - Team → Add Account… → свой Apple ID.
   - Automatically manage signing — включено.
   - Bundle Identifier оставьте `ru.denta.clinic`. Если Xcode пишет, что идентификатор занят — добавьте свой суффикс, например `ru.denta.clinic.ios`.
6. Сверху в панели схемы выберите **свой iPhone** (подключён кабелем, разблокирован). На iPhone: «Доверять этому компьютеру».
7. Нажмите ▶ (Run). Первая сборка занимает несколько минут.
8. Если iPhone пишет «Ненадёжный разработчик»: Настройки → Основные → VPN и управление устройством → ваш Apple ID → Доверять.

Бесплатная подпись живёт **7 дней**. Потом снова подключите iPhone и нажмите ▶ в Xcode.

Симулятор iPhone тоже можно выбрать вместо телефона — кабинет откроется на Mac, но камера и контакты там ограничены.

---

## Шаг 4. Отдать другим людям на тест (TestFlight)

Без Mac у тестировщика приложение **не поставить**. Нужен ваш аккаунт [Apple Developer](https://developer.apple.com/programs/) (99 $ / год) и приложение в App Store Connect.

### 4.1. Один раз: аккаунт и приложение

1. Зарегистрируйтесь в [Apple Developer Program](https://developer.apple.com/programs/).
2. Откройте [App Store Connect](https://appstoreconnect.apple.com/) → Мои приложения → «+» → Новое приложение.
   - Платформа: iOS
   - Название: Дента (или ClinicOS)
   - Язык: Русский
   - Bundle ID: тот же, что в Xcode (`ru.denta.clinic`)
   - SKU: например `denta-ios`
3. В Xcode в Signing & Capabilities Team должен быть **платный** Team (не Personal Team).

### 4.2. Архив и загрузка

1. В Xcode сверху схему поставьте **Any iOS Device (arm64)** — не симулятор.
2. Меню **Product → Archive**. Дождитесь окна Organizer.
3. **Distribute App → App Store Connect → Upload**.
4. Дождитесь письма «Finished processing».

### 4.3. Внутренние тестировщики (своя команда)

App Store Connect → приложение → TestFlight → Internal Testing.

Добавьте людей, у которых есть доступ к вашему App Store Connect (до 100). Они ставят **TestFlight** из App Store, открывают приглашение — приложение появляется в TestFlight.

Внутренний тест обычно **без** проверки Apple, в течение часа.

### 4.4. Внешние тестировщики (коллеги, клиника)

1. TestFlight → External Testing → создать группу.
2. Добавить email людей.
3. Выбрать сборку → отправить на **Beta App Review** (первый раз Apple смотрит 1–2 дня).
4. После одобрения люди получают письмо со ссылкой TestFlight.

На iPhone тестировщика: установить **TestFlight** → принять приглашение → Установить «Дента».

Сборка TestFlight живёт **90 дней**. Потом загрузите новый Archive.

Данные кабинета у каждого телефона **свои**. Чтобы перенести: Настройки → «Сохранить копию» на одном устройстве, «Восстановить из файла» на другом.

---

## Safari на iPhone (без Mac и без TestFlight)

Если Mac ещё нет, кабинет можно открыть в Safari как сайт (тот же адрес, что на компьютере).

1. Safari (не Chrome, не «Частный доступ»).
2. Поделиться → **На экран «Домой»**.
3. Открывать с иконки.

Это не замена приложения из Xcode: камера, файлы и фон ограничены Safari.

---

## Что внутри 2.24

То же, что в Android 2.24:

- Расписание: день / неделя / месяц / год, сжатие часов кнопкой над «+», замок переноса, мини-месяц с перетаскиванием.
- Настройки расписания: тумблеры процентов, цветов, мини-месяца, времени и вида приёма.
- В неделе фамилия на записи столбиком.
- Зубная формула: пульпит — красная пульпа, периодонтит — гранулёма на корне.
- Карточки, фотоархив, планы, касса, скидки, резервная копия zip.

---

## Если что-то не собирается

| Сообщение | Что сделать |
|---|---|
| `The sandbox is not in sync with the Podfile.lock` | Закройте Xcode (Cmd+Q). В Terminal выполните блок из раздела «Если Xcode уже открылся с ошибкой» ниже. Затем снова откройте **`App.xcworkspace`**. |
| `Failed to open document` | Не открывайте файлы с github.com. На Mac: те же команды, что строкой выше. Открывать только `App.xcworkspace`. |
| `No such module 'Capacitor'` | Открыт `.xcodeproj`. Закройте и откройте **`.xcworkspace`**. Затем `cd ios/App && pod install`. |
| Signing: Failed / Personal Team | Bundle ID занят — добавьте суффикс. Или войдите в платный Team. |
| `pod: command not found` | `sudo gem install cocoapods` |
| `npm: command not found` | Поставить Node.js 22 с nodejs.org |
| Белый экран на телефоне | Product → Clean Build Folder, затем снова ▶. На iPhone доверить сертификат. |

---

## Репозитории

- iPhone (этот): https://github.com/Apex-st/ClinicOS
- Android: https://github.com/Apex-st/denta-cabinet
