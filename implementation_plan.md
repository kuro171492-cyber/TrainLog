# Рефакторинг: унификация логики парсинга дат и API-запросов GitHub

В соответствии с предложениями по рефакторингу, мы наводим порядок в кодовой базе без изменения общего поведения приложения, чтобы гарантировать его 100% работоспособность.

## User Review Required

Никаких ломающих изменений (breaking changes) не планируется. Все функции останутся в глобальной области видимости, чтобы избежать поломки inline event-обработчиков в HTML-разметке.

## Proposed Changes

### [Component Name] Раздел парсинга дат

Унификация дублирующейся логики парсинга дат в `app_logic.js`. 

#### [MODIFY] [app_logic.js](file:///h:/Projects/TrainLog/app_logic.js)

- Создать общую вспомогательную функцию `datePartsToTimestamp(d, mLabel, y)`:
  ```javascript
  function datePartsToTimestamp(d, mLabel, y) {
      const day = Number(d) || 1;
      const month = MONTH_INDEX[mLabel] ?? 0;
      const year = Number(y) || new Date().getFullYear();
      return new Date(year, month, day).getTime();
  }
  ```
- Переписать `sessionDateToTimestamp(session)` для использования новой функции:
  ```javascript
  function sessionDateToTimestamp(session) {
      return datePartsToTimestamp(session?.dateObj?.d, session?.dateObj?.m, session?.dateObj?.y);
  }
  ```
- Переписать `getDayCardTimestamp(card)` для использования новой функции:
  ```javascript
  function getDayCardTimestamp(card) {
      return datePartsToTimestamp(
          card.querySelector('[data-type="d"]')?.textContent.trim(),
          card.querySelector('[data-type="m"]')?.textContent.trim(),
          card.querySelector('[data-type="y"]')?.textContent.trim()
      );
  }
  ```

---

### [Component Name] Синхронизация GitHub

Унификация URL-адресов в `globals_and_storage.js`.

#### [MODIFY] [globals_and_storage.js](file:///h:/Projects/TrainLog/globals_and_storage.js)

- Изменить функцию `getGitHubApiUrl(cfg, includeRef = true)`:
  ```javascript
  function getGitHubApiUrl(cfg, includeRef = true) {
      const safePath = cfg.path.split('/').map(encodeURIComponent).join('/');
      const baseUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${safePath}`;
      return includeRef ? `${baseUrl}?ref=${encodeURIComponent(cfg.branch)}` : baseUrl;
  }
  ```
- Заменить жестко закодированную строку URL в `uploadToGitHub` (строка 314) на вызов `getGitHubApiUrl(activeCfg, false)`:
  ```javascript
  const putRes = await githubFetchWithAuthFallback(getGitHubApiUrl(activeCfg, false), {
  ```

---

## Verification Plan

### Manual Verification
1. Открыть приложение в браузере.
2. Проверить корректность отображения дат (должны работать статусы: прошедшие, сегодняшние и будущие тренировки, подсвечиваемые рамками).
3. Проверить добавление новой сессии (убедиться, что дата создается корректно, а сортировка сессий в DOM работает правильно).
4. Проверить сохранение и загрузку через GitHub Sync (проверка токена/соединения, загрузка файлов, выгрузка изменений).
5. Проверить, что в консоли браузера нет ошибок при загрузке страницы.
