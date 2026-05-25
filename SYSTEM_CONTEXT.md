# SYSTEM_CONTEXT

## Project Purpose
TrainLog — это PWA для логирования тренировок (workout tracker). Позволяет записывать упражнения, подходы, веса, время отдыха, анализировать прогресс через графики и таблицу.

## Core Systems
- **UI Components (ui_components.js)** — рендеринг карточек тренировок, шаблонов, дропдаунов, модалок
- **Application Logic (app_logic.js)** — автосохранение, сортировка, группировка по месяцам/неделям, File API, GitHub Sync (аналитика удалена в D-4)
- **Storage Layer (globals_and_storage.js)** — константы, LocalStorage, File System Access API, IndexedDB для хранения handle, GitHub API fetch
- **View (index.html)** — Tailwind CSS, одна вкладка (логирование), мобильный приоритет

## Technology Stack
- Чистый HTML/CSS/JS (vanilla, no framework)
- Tailwind CSS (CDN)
- File System Access API (local file persistence)
- GitHub REST API (cloud sync)
- IndexedDB (persist file handle)

## Critical Constraints
- Никаких JS-фреймворков — только vanilla JS
- Единый источник истины: LocalStorage + файл на диске + (опционально) GitHub
- Вся логика в трёх .js файлах, подключённых в index.html по порядку
- Приоритет мобильных устройств (≤640px); десктоп — вторичен
- Версионирование CSS/JS через `?v=N` для принудительного сброса кэша на телефоне

## Important Assumptions
- Все данные пользовательские, никакого бэкенда
- Поддержка современных браузеров (File System Access API, IndexedDB)
- Русскоязычный интерфейс
- Данные экспортируются в JSON

## Global Architecture Rules
- Состояние сохраняется через scheduleStatePersistence (throttled)
- Шаблоны синхронизируются с последней использовавшей сессией через syncTemplatesFromLatestSessions
- Сортировка сессий — по дате (новые сверху)
- Группировка по месяцам и неделям с возможностью сворачивания
