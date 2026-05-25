# ARCHITECTURE_MAP

## File Ownership
```
index.html                — разметка, подключение скриптов
globals_and_storage.js    — константы, LocalStorage, File API, GitHub API
ui_components.js          — рендеринг карточек, шаблонов, дропдаунов, модалок
app_logic.js              — автосохранение, аналитика, сортировка, группировка
styles.css                — стили (tailwind + кастомные)
month_themes.css          — темы месяцев
```

## Module Relationships
```
[globals_and_storage.js] ← используется → [ui_components.js] ← используется → [app_logic.js]
        ↕                                               ↕
   LocalStorage/File API                          GitHub API
```

## Data Flow
```
User Input → autoSave() → scheduleStatePersistence()
  → LocalStorage (workout_v4_data, workout_v4_templates)
  → trainlog_data.json (File System Access API)
  → (optional) GitHub API (PUT contents)
  
Load:
  DOMContentLoaded → loadPersistedFileHandle() → loadFromStorage()
  → LocalStorage → addDay() для каждой сессии → groupDayCardsByMonth()
```

## Critical Pipelines
1. Создание/редактирование тренировки → autoSave() → LocalStorage + файл + GitHub
2. Применение шаблона → applyTemplateById() → рендеринг упражнений → autoSave()

## Ownership Boundaries
- globals_and_storage: сырые данные, API вызовы, инициализация
- ui_components: DOM-манипуляции, визуал
- app_logic: бизнес-логика, связь storage ↔ UI, аналитика
