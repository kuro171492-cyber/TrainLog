        function initDropdownOptions() {
            WEEKDAYS.forEach(w => addDDItem('weekdayList', w, 'weekday', w));
            for (let i = 1; i <= 31; i++) addDDItem('dayList', i, 'date', 'd_' + i);
            MONTHS.forEach(m => addDDItem('monthList', m, 'date', 'm_' + m));
            for (let i = 2025; i <= 2026; i++) addDDItem('yearList', i, 'date', 'y_' + i);
            for (let i = 0; i < 24; i++) addDDItem('totalHoursList', String(i).padStart(2, '0'), 'total', 'h' + i);
            for (let i = 0; i < 60; i++) addDDItem('totalMinList', String(i).padStart(2, '0'), 'total', 'm' + i);
            for (let i = 0; i < 60; i++) addDDItem('minList', String(i).padStart(2, '0'), 'ex', 'm_first' + i);
            for (let i = 0; i < 60; i++) addDDItem('secList', String(i).padStart(2, '0'), 'ex', 's' + i);
            for (let i = 0; i <= 250; i += 10) addDDItem('tensList', i, 'w', 'tens' + i);
            for (let i = 0; i < 10; i += 0.5) addDDItem('unitsList', i, 'w', 'units' + i);
            for (let i = 1; i <= 50; i++) addDDItem('repsList', i, 'reps', i);
        }

        function addDDItem(targetId, label, type, val) {
            const div = document.createElement('div');
            div.className = "dropdown-item";
            div.textContent = label;
            div.onclick = (e) => { e.stopPropagation(); handleSelection(String(val), type); };
            document.getElementById(targetId).appendChild(div);
        }

        function autoSave(skipLayoutRefresh = false) {
            if (!skipLayoutRefresh) {
                if (needsDomSort) {
                    sortDayCardsInDom();
                    needsDomSort = false;
                }
                groupDayCardsByMonth();
                applyAlternatingThemes();
            }
            const days = Array.from(document.querySelectorAll('.day-card')).map(card => ({
                id: card.dataset.id,
                templateId: card.dataset.templateId || null,
                dateObj: {
                    d: card.querySelector('[data-type="d"]').textContent.trim(),
                    m: card.querySelector('[data-type="m"]').textContent.trim(),
                    y: card.querySelector('[data-type="y"]').textContent.trim(),
                    wd: card.querySelector('.weekday-value').textContent.trim()
                },
                totalTime: card.querySelector('[data-type="total-time"]').value,
                items: getItemsForAutoSave(card)
            }));
            const sortedDays = sortSessionsByDate(days);
            const syncedTemplates = syncTemplatesFromLatestSessions(sortedDays);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedDays));
            writeDataToRepoFile({ workouts: sortedDays, templates: syncedTemplates }).catch(() => { });
        }

        function syncTemplatesFromLatestSessions(sortedSessions = []) {
            const templates = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
            if (!templates.length) return templates;

            const latestByTemplateId = new Map();
            sortedSessions.forEach(session => {
                const templateId = String(session?.templateId || '').trim();
                if (!templateId || latestByTemplateId.has(templateId)) return;
                latestByTemplateId.set(templateId, session);
            });

            let changed = false;
            const updated = templates.map(template => {
                const session = latestByTemplateId.get(String(template?.id || ''));
                if (!session) return template;

                const nextWeekday = session?.dateObj?.wd || template.weekday;
                const nextTotalTime = session?.totalTime || template.totalTime;
                const nextItems = JSON.parse(JSON.stringify(session?.items || []));
                const sameWeekday = (template?.weekday || '') === (nextWeekday || '');
                const sameTotalTime = (template?.totalTime || '') === (nextTotalTime || '');
                const sameItems = JSON.stringify(template?.items || []) === JSON.stringify(nextItems);

                if (sameWeekday && sameTotalTime && sameItems) return template;
                changed = true;
                return { ...template, weekday: nextWeekday, totalTime: nextTotalTime, items: nextItems };
            });

            if (!changed) return templates;

            const sortedUpdated = typeof sortTemplatesAlphabetically === 'function'
                ? sortTemplatesAlphabetically(updated)
                : updated;
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sortedUpdated));
            return sortedUpdated;
        }

        function parseExerciseElement(el) {
            if (el.dataset.type === 'superset') return { type: 'superset', exercises: Array.from(el.querySelectorAll('.superset-inner > [data-type="exercise"]')).map(ex => parseEx(ex)) };
            return { type: 'exercise', ...parseEx(el) };
        }

        function parseEx(el) {
            return {
                name: el.querySelector('.editable').textContent.trim(),
                sets: Array.from(el.querySelectorAll('.sets-container > div')).map(s => {
                    const inputs = s.querySelectorAll('input');
                    return { w: inputs[0].value, r: inputs[1].value, t: inputs[2].value };
                })
            };
        }

        function getItemsForAutoSave(card) {
            if (card?.dataset?.itemsLoaded === '1') {
                return Array.from(card.querySelectorAll('.exercise-list > [data-type]')).map(el => parseExerciseElement(el));
            }
            return getDeferredItemsFromCard(card);
        }

        function getDeferredItemsFromCard(card) {
            try {
                const raw = card?.dataset?.itemsJson || '';
                if (!raw) return [];
                const parsed = JSON.parse(decodeURIComponent(raw));
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                return [];
            }
        }

        function ensureDayCardContentLoaded(card) {
            if (!card || card.dataset.itemsLoaded === '1') return;
            const list = card.querySelector('.exercise-list');
            if (!list) return;

            const items = getDeferredItemsFromCard(card);
            list.innerHTML = '';
            if (items.length > 0) {
                items.forEach(item => item.type === 'superset' ? renderSuperset(list, item) : renderExercise(list, item));
            } else {
                renderExercise(list);
            }

            card.dataset.itemsLoaded = '1';
            delete card.dataset.itemsJson;
        }

        async function loadFromStorage() {
            const fileData = await readDataFromRepoFile();
            if (fileData?.workouts && fileData?.templates) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData.workouts));
                localStorage.setItem(TEMPLATE_KEY, JSON.stringify(fileData.templates));
                showToast("Данные загружены из trainlog_data.json");
            }

            const data = sortSessionsByDate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
            document.getElementById('daysContainer').innerHTML = '';
            if (data.length > 0) data.forEach(d => addDay(d, false, false));
            else addDay(null, true);
            groupDayCardsByMonth();
            applyAlternatingThemes();
        }

        // Analytics (simplified for this version)
        function renderAnalytics() {
            const data = sortSessionsByDate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
            const body = document.getElementById('analyticsBody');
            body.innerHTML = '';
            data.forEach(session => {
                session.items.forEach(item => {
                    const exercises = item.type === 'superset' ? item.exercises : [item];
                    exercises.forEach(ex => {
                        const row = document.createElement('tr');
                        row.className = "border-b border-slate-200";
                        row.innerHTML = `
                            <td class="p-4 text-slate-500">${session.dateObj.d} ${session.dateObj.m}</td>
                            <td class="p-4 text-slate-700 font-bold">${ex.name || '---'}</td>
                            <td class="p-4 text-slate-500 text-[10px]">${ex.sets.map(s => `${s.w}x${s.r}`).join(', ')}</td>
                        `;
                        body.appendChild(row);
                    });
                });
            });
        }

        function sessionDateToTimestamp(session) {
            const d = Number(session?.dateObj?.d) || 1;
            const m = MONTH_INDEX[session?.dateObj?.m] ?? 0;
            const y = Number(session?.dateObj?.y) || new Date().getFullYear();
            return new Date(y, m, d).getTime();
        }

        function sortSessionsByDate(sessions = []) {
            return [...sessions].sort((a, b) => sessionDateToTimestamp(b) - sessionDateToTimestamp(a));
        }

        function sortDayCardsInDom() {
            const container = document.getElementById('daysContainer');
            const cards = Array.from(container.querySelectorAll('.day-card'));
            cards.sort((a, b) => {
                const aSession = {
                    dateObj: {
                        d: a.querySelector('[data-type="d"]').textContent.trim(),
                        m: a.querySelector('[data-type="m"]').textContent.trim(),
                        y: a.querySelector('[data-type="y"]').textContent.trim()
                    }
                };
                const bSession = {
                    dateObj: {
                        d: b.querySelector('[data-type="d"]').textContent.trim(),
                        m: b.querySelector('[data-type="m"]').textContent.trim(),
                        y: b.querySelector('[data-type="y"]').textContent.trim()
                    }
                };
                return sessionDateToTimestamp(bSession) - sessionDateToTimestamp(aSession);
            });
            cards.forEach(card => container.appendChild(card));
            groupDayCardsByMonth();
        }

        function getMonthInfoFromCard(card) {
            const monthLabel = card.querySelector('[data-type="m"]')?.textContent.trim();
            const monthIndex = MONTH_INDEX[monthLabel] ?? 0;
            const year = Number(card.querySelector('[data-type="y"]')?.textContent.trim()) || new Date().getFullYear();
            const date = new Date(year, monthIndex, 1);
            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const label = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            return { key, label };
        }

        function saveMonthGroupState() {
            localStorage.setItem(MONTH_GROUP_STATE_KEY, JSON.stringify(monthGroupState));
        }

        function saveWeekGroupState() {
            localStorage.setItem(WEEK_GROUP_STATE_KEY, JSON.stringify(weekGroupState));
        }

        function toggleMonthGroup(monthKey) {
            monthGroupState[monthKey] = !monthGroupState[monthKey];
            saveMonthGroupState();
            const group = document.querySelector(`.month-group[data-month-key="${monthKey}"]`);
            if (!group) return;
            const body = group.querySelector('.month-group-body');
            const caret = group.querySelector('.month-group-caret');
            const isCollapsed = !!monthGroupState[monthKey];
            body?.classList.toggle('hidden', isCollapsed);
            caret?.classList.toggle('is-collapsed', isCollapsed);
        }

        function toggleWeekGroup(weekKey) {
            weekGroupState[weekKey] = !weekGroupState[weekKey];
            saveWeekGroupState();
            const group = document.querySelector(`.week-group[data-week-key="${weekKey}"]`);
            if (!group) return;
            const body = group.querySelector('.week-group-body');
            const caret = group.querySelector('.week-group-caret');
            const isCollapsed = !!weekGroupState[weekKey];
            body?.classList.toggle('hidden', isCollapsed);
            caret?.classList.toggle('is-collapsed', isCollapsed);
        }

        function getCurrentMonthKey() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        function getWeekStartDate(date) {
            const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayIdx = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - dayIdx);
            return start;
        }

        function getWeekInfoFromCard(card) {
            const day = Number(card.querySelector('[data-type="d"]')?.textContent.trim()) || 1;
            const monthLabel = card.querySelector('[data-type="m"]')?.textContent.trim();
            const month = MONTH_INDEX[monthLabel] ?? 0;
            const year = Number(card.querySelector('[data-type="y"]')?.textContent.trim()) || new Date().getFullYear();
            const date = new Date(year, month, day);
            const start = getWeekStartDate(date);
            const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
            const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const label = `${start.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}`;
            return { key, label };
        }

        function getCurrentWeekKey() {
            const now = new Date();
            const start = getWeekStartDate(now);
            return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        }

        /**
         * Calculates which week number a given week is within a month.
         * Used for progressive color darkening (week 1 = lightest, week 5 = darkest)
         */
        function getWeekNumberInMonth(weekKey, monthKey) {
            const [year, month] = monthKey.split('-').map(Number);
            const firstDayOfMonth = new Date(year, month - 1, 1);
            const weekStart = new Date(weekKey);
            
            // Get the first week's start date in this month
            const firstWeekStart = getWeekStartDate(firstDayOfMonth);
            
            // Calculate the difference in weeks
            const diffTime = weekStart.getTime() - firstWeekStart.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const weekNumber = Math.floor(diffDays / 7) + 1;
            
            // Cap at 5 (for months that span 5+ weeks)
            return Math.min(weekNumber, 5);
        }

        function groupDayCardsByMonth() {
            const container = document.getElementById('daysContainer');
            const cards = Array.from(container.querySelectorAll('.day-card'));
            if (cards.length === 0) return;

            cards.sort((a, b) => getDayCardTimestamp(b) - getDayCardTimestamp(a));
            container.innerHTML = '';

            let currentKey = null;
            let monthBody = null;
            let monthCount = 0;
            let monthCountEl = null;
            let currentWeekKey = null;
            let weekBody = null;
            let weekCount = 0;
            let weekCountEl = null;
            const currentMonthKey = getCurrentMonthKey();
            const currentWeekKeyNow = getCurrentWeekKey();

            cards.forEach(card => {
                const info = getMonthInfoFromCard(card);
                if (info.key !== currentKey) {
                    currentKey = info.key;
                    monthCount = 0;
                    currentWeekKey = null;
                    weekBody = null;
                    weekCount = 0;
                    const isCollapsed = monthGroupState[info.key] ?? (info.key !== currentMonthKey);
                    const group = document.createElement('section');
                    group.className = 'month-group';
                    group.dataset.monthKey = info.key;
                    
                    // Determine month-specific class based on month index
                    const monthIndex = parseInt(info.key.split('-')[1], 10);
                    let monthClass = '';
                    switch (monthIndex) {
                        case 1: monthClass = 'month-january'; break;
                        case 2: monthClass = 'month-february'; break;
                        case 3: monthClass = 'month-march'; break;
                        case 4: monthClass = 'month-april'; break;
                        case 5: monthClass = 'month-may'; break;
                        case 6: monthClass = 'month-june'; break;
                        case 7: monthClass = 'month-july'; break;
                        case 8: monthClass = 'month-august'; break;
                        case 9: monthClass = 'month-september'; break;
                        case 10: monthClass = 'month-october'; break;
                        case 11: monthClass = 'month-november'; break;
                        case 12: monthClass = 'month-december'; break;
                    }
                    
                    group.classList.add(monthClass);
                    group.innerHTML = `
                        <button class="month-group-header" onclick="toggleMonthGroup('${info.key}')">
                            <span>${info.label}</span>
                            <div class="flex items-center gap-2">
                                <span class="month-group-count"></span>
                                <span class="month-group-caret ${isCollapsed ? 'is-collapsed' : ''}">▼</span>
                            </div>
                        </button>
                        <div class="month-group-body ${isCollapsed ? 'hidden' : ''}"></div>
                    `;
                    container.appendChild(group);
                    monthBody = group.querySelector('.month-group-body');
                    monthCountEl = group.querySelector('.month-group-count');
                }

                const weekInfo = getWeekInfoFromCard(card);
                if (weekInfo.key !== currentWeekKey) {
                    currentWeekKey = weekInfo.key;
                    weekCount = 0;
                    const isWeekCollapsed = weekGroupState[weekInfo.key] ?? (weekInfo.key !== currentWeekKeyNow);
                    
                    // Calculate week number within the month for progressive coloring
                    const weekNumberInMonth = getWeekNumberInMonth(weekInfo.key, info.key);
                    
                    const weekGroup = document.createElement('section');
                    weekGroup.className = `week-group mt-2 week-${weekNumberInMonth} week-card`;
                    weekGroup.dataset.weekKey = weekInfo.key;
                    weekGroup.innerHTML = `
                        <button class="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold action-btn" onclick="toggleWeekGroup('${weekInfo.key}')">
                            <span>${weekInfo.label}</span>
                            <div class="flex items-center gap-2">
                                <span class="week-group-count text-[10px] uppercase tracking-wide"></span>
                                <span class="week-group-caret month-group-caret ${isWeekCollapsed ? 'is-collapsed' : ''}">▼</span>
                            </div>
                        </button>
                        <div class="week-group-body ${isWeekCollapsed ? 'hidden' : ''} mt-2"></div>
                    `;
                    monthBody?.appendChild(weekGroup);
                    weekBody = weekGroup.querySelector('.week-group-body');
                    weekCountEl = weekGroup.querySelector('.week-group-count');
                }

                weekCount += 1;
                monthCount += 1;
                if (weekCountEl) weekCountEl.textContent = `${weekCount} трен.`;
                if (monthCountEl) monthCountEl.textContent = `${monthCount} трен.`;
                weekBody?.appendChild(card);
            });
        }

        function normalizeToLocalMidnight(date) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        }

        function getDayCardTimestamp(card) {
            const day = Number(card.querySelector('[data-type="d"]')?.textContent.trim()) || 1;
            const monthLabel = card.querySelector('[data-type="m"]')?.textContent.trim();
            const month = MONTH_INDEX[monthLabel] ?? 0;
            const year = Number(card.querySelector('[data-type="y"]')?.textContent.trim()) || new Date().getFullYear();
            return normalizeToLocalMidnight(new Date(year, month, day));
        }

        function applyDayStatusBorders() {
            const todayStamp = normalizeToLocalMidnight(new Date());
            document.querySelectorAll('#daysContainer .day-card').forEach(card => {
                const stamp = getDayCardTimestamp(card);
                card.classList.remove('status-past', 'status-future', 'status-today');
                if (stamp < todayStamp) card.classList.add('status-past');
                else if (stamp > todayStamp) card.classList.add('status-future');
                else card.classList.add('status-today');
            });
        }

        function applyAlternatingThemes() {
            const dayCards = Array.from(document.querySelectorAll('#daysContainer .day-card'));
            dayCards.forEach((card, index) => {
                card.classList.remove('theme-a', 'theme-b');
                card.classList.add(index % 2 === 0 ? 'theme-a' : 'theme-b');

                const topLevelItems = Array.from(card.querySelectorAll('.exercise-list > [data-type]'));
                applyExerciseThemes(topLevelItems);

                const nestedGroups = card.querySelectorAll('.superset-inner');
                nestedGroups.forEach(group => {
                    const nestedExercises = Array.from(group.querySelectorAll(':scope > .exercise-card'));
                    applyExerciseThemes(nestedExercises);
                });
            });
            applyDayStatusBorders();
        }

        function applyExerciseThemes(exerciseElements) {
            exerciseElements.forEach((exercise, index) => {
                if (!exercise.classList.contains('exercise-card')) return;
                exercise.classList.remove('theme-a', 'theme-b');
                exercise.classList.add(index % 2 === 0 ? 'theme-a' : 'theme-b');
            });
        }

        async function connectRepoFile() {
            if (!window.showOpenFilePicker && !window.showSaveFilePicker) {
                showToast("Браузер не поддерживает доступ к файлам");
                return;
            }
            try {
                if (window.showOpenFilePicker) {
                    const [handle] = await window.showOpenFilePicker({
                        multiple: false,
                        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
                    });
                    repoFileHandle = handle;
                } else {
                    repoFileHandle = await window.showSaveFilePicker({
                        suggestedName: REPO_FILE_NAME,
                        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
                    });
                }

                await persistFileHandle(repoFileHandle);

                const fileData = await readDataFromRepoFile();
                if (fileData?.workouts && fileData?.templates) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(fileData.workouts));
                    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(fileData.templates));
                    await loadFromStorage();
                    showToast("Файл подключен. История загружена");
                    return;
                }

                await writeDataToRepoFile({
                    workouts: sortSessionsByDate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
                    templates: JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'),
                    exportDate: new Date().toISOString()
                });
                showToast("Файл подключен. Сохранение в репозиторий активно");
            } catch (err) {
                if (err?.name !== 'AbortError') showToast("Не удалось подключить файл");
            }
        }

        async function writeDataToRepoFile(payload) {
            if (!repoFileHandle) return;
            const writable = await repoFileHandle.createWritable();
            await writable.write(JSON.stringify({ ...payload, exportDate: new Date().toISOString() }, null, 2));
            await writable.close();
        }

        async function readDataFromRepoFile() {
            try {
                if (!repoFileHandle) return null;
                const file = await repoFileHandle.getFile();
                const txt = await file.text();
                return JSON.parse(txt);
            } catch (err) {
                return null;
            }
        }

        async function persistFileHandle(handle) {
            if (!window.indexedDB) return;
            const db = await openRepoDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(REPO_FILE_KEY, 'readwrite');
                tx.objectStore(REPO_FILE_KEY).put(handle, 'handle');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function loadPersistedFileHandle() {
            if (!window.indexedDB) return;
            const db = await openRepoDb();
            repoFileHandle = await new Promise((resolve) => {
                const tx = db.transaction(REPO_FILE_KEY, 'readonly');
                const req = tx.objectStore(REPO_FILE_KEY).get('handle');
                req.onsuccess = async () => {
                    const handle = req.result || null;
                    if (!handle) return resolve(null);
                    const permission = await handle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') return resolve(handle);
                    resolve(null);
                };
                req.onerror = () => resolve(null);
            });
        }

        function openRepoDb() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('trainlog-repo-db', 1);
                req.onupgradeneeded = () => req.result.createObjectStore(REPO_FILE_KEY);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        function updateAnalyticsChart() { }
