const STORAGE_KEY = 'workout_v4_data';
        const TEMPLATE_KEY = 'workout_v4_templates';
        const REPO_FILE_KEY = 'trainlog_repo_file_handle_v1';
        const REPO_FILE_NAME = 'trainlog_data.json';
        const GITHUB_SYNC_KEY = 'trainlog_github_sync_v1';
        const MONTH_GROUP_STATE_KEY = 'trainlog_month_group_state_v1';
        const WEEK_GROUP_STATE_KEY = 'trainlog_week_group_state_v1';
        const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
        const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const WEEKDAY_SHORT_MAP = {
            'Понедельник': 'Пн',
            'Вторник': 'Вт',
            'Среда': 'Ср',
            'Четверг': 'Чт',
            'Пятница': 'Пт',
            'Суббота': 'Сб',
            'Воскресенье': 'Вс',
            'Пн': 'Пн',
            'Вт': 'Вт',
            'Ср': 'Ср',
            'Чт': 'Чт',
            'Пт': 'Пт',
            'Сб': 'Сб',
            'Вс': 'Вс'
        };

        let activeInput = null;
        let activeSessionIdForTemplate = null;
        let workoutChart = null;
        let repoFileHandle = null;
        let needsDomSort = false;
        let datePickerInstance = null;
        let monthGroupState = {};
        let weekGroupState = {};

        const dropdowns = {
            date: document.getElementById('dateDropdown'),
            weekday: document.getElementById('weekdayDropdown'),
            total: document.getElementById('totalTimeDropdown'),
            exercise: document.getElementById('exerciseTimeDropdown'),
            weight: document.getElementById('weightDropdown'),
            reps: document.getElementById('repsDropdown')
        };
        const nativeDatePicker = document.getElementById('nativeDatePicker');
        const mobileDateModal = document.getElementById('mobileDateModal');
        const mobileDateInput = document.getElementById('mobileDateInput');
        let mobileDateTarget = null;

        window.addEventListener('DOMContentLoaded', async () => {
            monthGroupState = JSON.parse(localStorage.getItem(MONTH_GROUP_STATE_KEY) || '{}');
            weekGroupState = JSON.parse(localStorage.getItem(WEEK_GROUP_STATE_KEY) || '{}');
            initDropdownOptions();
            initNativeDatePicker();
            initMobileDateModal();
            await loadPersistedFileHandle();
            await loadFromStorage();
        });

        // --- FILE STORAGE FUNCTIONS ---
        function exportData() {
            const data = {
                workouts: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
                templates: JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'),
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trainlog_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Данные экспортированы");
        }

        function triggerImport() {
            document.getElementById('fileImportInput').click();
        }

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.workouts || !data.templates) throw new Error("Неверный формат файла");

                    if (confirm("Это заменит все текущие данные. Продолжить?")) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.workouts));
                        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data.templates));
                        writeDataToRepoFile(data).catch(() => { });
                        location.reload();
                    }
                } catch (err) {
                    showToast("Ошибка при импорте");
                }
            };
            reader.readAsText(file);
        }

        function getGitHubConfig() {
            return JSON.parse(localStorage.getItem(GITHUB_SYNC_KEY) || 'null');
        }

        function configureGitHubSync() {
            const current = getGitHubConfig() || {};
            const owner = prompt("GitHub owner (username/org):", current.owner || "");
            if (!owner) return;
            const repo = prompt("Repository name:", current.repo || "");
            if (!repo) return;
            const path = prompt("Path to JSON in repo:", current.path || "trainlog_data.json");
            if (!path) return;
            const branch = prompt("Branch:", current.branch || "main");
            if (!branch) return;
            const token = prompt("GitHub token (classic/fine-grained with Contents read/write):", current.token || "");
            if (!token) return;

            localStorage.setItem(GITHUB_SYNC_KEY, JSON.stringify({ owner, repo, path, branch, token }));
            showToast("GitHub Sync настроен");
        }

        function getGitHubApiUrl(cfg) {
            const safePath = cfg.path.split('/').map(encodeURIComponent).join('/');
            return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${safePath}?ref=${encodeURIComponent(cfg.branch)}`;
        }

        async function downloadFromGitHub() {
            const cfg = getGitHubConfig();
            if (!cfg) {
                configureGitHubSync();
                if (!getGitHubConfig()) return;
            }
            const activeCfg = getGitHubConfig();

            try {
                const res = await fetch(getGitHubApiUrl(activeCfg), {
                    headers: { Authorization: `Bearer ${activeCfg.token}`, Accept: 'application/vnd.github+json' }
                });
                if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
                const payload = await res.json();
                const decoded = decodeURIComponent(escape(atob((payload.content || '').replace(/\n/g, ''))));
                const data = JSON.parse(decoded);
                if (!data.workouts || !data.templates) throw new Error('Неверный формат данных');

                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.workouts));
                localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data.templates));
                await loadFromStorage();
                showToast("Загружено из GitHub");
            } catch (err) {
                showToast("Ошибка загрузки из GitHub");
            }
        }

        async function uploadToGitHub() {
            const cfg = getGitHubConfig();
            if (!cfg) {
                configureGitHubSync();
                if (!getGitHubConfig()) return;
            }
            const activeCfg = getGitHubConfig();

            try {
                let sha = null;
                const getRes = await fetch(getGitHubApiUrl(activeCfg), {
                    headers: { Authorization: `Bearer ${activeCfg.token}`, Accept: 'application/vnd.github+json' }
                });
                if (getRes.ok) {
                    const existing = await getRes.json();
                    sha = existing.sha || null;
                } else if (getRes.status !== 404) {
                    throw new Error(`GitHub HTTP ${getRes.status}`);
                }

                const bodyPayload = {
                    workouts: sortSessionsByDate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
                    templates: JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'),
                    exportDate: new Date().toISOString()
                };

                const content = btoa(unescape(encodeURIComponent(JSON.stringify(bodyPayload, null, 2))));
                const putBody = {
                    message: `TrainLog sync ${new Date().toISOString()}`,
                    content,
                    branch: activeCfg.branch
                };
                if (sha) putBody.sha = sha;

                const putRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(activeCfg.owner)}/${encodeURIComponent(activeCfg.repo)}/contents/${activeCfg.path.split('/').map(encodeURIComponent).join('/')}`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${activeCfg.token}`,
                        Accept: 'application/vnd.github+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(putBody)
                });
                if (!putRes.ok) throw new Error(`GitHub HTTP ${putRes.status}`);

                showToast("Сохранено в GitHub");
            } catch (err) {
                showToast("Ошибка сохранения в GitHub");
            }
        }

        // --- CORE UI LOGIC ---
        function switchRoom(room) {
            document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
            if (room === 'log') {
                document.getElementById('roomLog').classList.add('active');
                document.getElementById('btnLog').className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white";
                document.getElementById('btnTable').className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500";
            } else {
                renderAnalytics();
                document.getElementById('roomTable').classList.add('active');
                document.getElementById('btnTable').className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white";
                document.getElementById('btnLog').className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500";
            }
        }

        function addDay(data = null, insertAtTop = true, triggerAutoSave = true) {
            const id = data?.id || Date.now();
            const now = new Date();
            const date = data?.dateObj || { d: now.getDate(), m: MONTHS[now.getMonth()], y: now.getFullYear(), wd: WEEKDAYS[(now.getDay() + 6) % 7] };
            const weekdayShort = toShortWeekday(date.wd);
            const weekdayClassMap = { 'Пн': 'mon', 'Вт': 'tue', 'Ср': 'wed', 'Чт': 'thu', 'Пт': 'fri', 'Сб': 'sat', 'Вс': 'sun' };
            const weekdayClass = weekdayClassMap[weekdayShort] || 'day';

            const card = document.createElement('div');
            card.className = `day-card weekday-${weekdayClass} rounded-[26px] border shadow-xl overflow-hidden mb-4 transition-all`;
            card.dataset.id = id;
            if (data?.templateId) card.dataset.templateId = String(data.templateId);
            const hasDeferredItems = Array.isArray(data?.items) && data.items.length > 0;
            card.dataset.itemsLoaded = hasDeferredItems ? '0' : '1';
            if (hasDeferredItems) card.dataset.itemsJson = encodeURIComponent(JSON.stringify(data.items));
            card.innerHTML = `
                <div class="day-header p-3 sm:p-4">
                    <div class="day-toolbar flex flex-col gap-3">
                        <div class="day-meta-strip flex items-center gap-2 flex-wrap" onclick="event.stopPropagation()">
                            <button type="button" onclick="toggleCollapse(this)" class="day-toggle-btn day-icon-btn rounded-xl transition-all" aria-expanded="false" title="Показать/скрыть тренировку">
                                <span class="day-collapse-caret">▼</span>
                            </button>
                            <div class="date-container day-date-chip flex items-center gap-1 px-3 py-1 text-xs font-bold cursor-pointer" onclick="openDateCalendar(event)">
                                <span data-type="d">${date.d}</span> <span data-type="m">${date.m}</span><span data-type="y" class="hidden">${date.y}</span>
                            </div>
                            <div class="weekday-value day-weekday-badge text-xs font-bold px-3 py-1">
                                ${weekdayShort}
                            </div>
                            <div class="day-total-chip flex items-center rounded-xl px-3 py-1.5" onclick="event.stopPropagation()">
                                <input type="text" readonly class="day-total-input bg-transparent font-mono font-bold text-xs w-12 text-center outline-none cursor-pointer" onclick="openDropdown(event, 'total')" data-type="total-time" value="${data?.totalTime || '01:00'}">
                            </div>
                        </div>
                        <div class="day-actions flex gap-2" onclick="event.stopPropagation()">
                            <button onclick="saveSessionAsTemplate(${id})" class="day-action-wide day-icon-btn rounded-xl transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                <span>Сохранить шаблон</span>
                            </button>
                            <button onclick="openTemplateModal(${id})" class="day-action-wide day-icon-btn day-icon-btn-primary rounded-xl transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <span>Выбрать шаблон</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="day-content hidden p-3 sm:p-4 pt-0 border-t border-slate-300/70">
                    <div class="exercise-list space-y-3 pt-3"></div>
                    <div class="day-footer mt-5 flex justify-between items-center">
                        <div class="day-footer-actions flex gap-2">
                            <button onclick="addExerciseByBtn(this)" class="day-footer-btn day-footer-btn-muted px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">+ УПР</button>
                            <button onclick="addSupersetByBtn(this)" class="day-footer-btn day-footer-btn-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">+ БЛОК</button>
                        </div>
                        <button onclick="deleteDay(${id})" class="day-delete-btn p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </div>
            `;
            const container = document.getElementById('daysContainer');
            if (insertAtTop) container.prepend(card);
            else container.appendChild(card);
            const list = card.querySelector('.exercise-list');
            if (card.dataset.itemsLoaded === '1') {
                if (data?.items) data.items.forEach(i => i.type === 'superset' ? renderSuperset(list, i) : renderExercise(list, i));
                else renderExercise(list);
            }
            if (triggerAutoSave) {
                applyAlternatingThemes();
                autoSave();
            }
        }

        function renderExercise(container, data = null, isSub = false) {
            const div = document.createElement('div');
            div.className = `exercise-card relative p-3 pb-10 rounded-2xl border space-y-2 ${isSub ? 'is-sub' : ''}`;
            div.dataset.type = 'exercise';
            div.setAttribute('onclick', 'handleExerciseCardClick(event, this)');
            div.innerHTML = `
                <div class="exercise-card-shell">
                    <div class="exercise-main flex items-center gap-3">
                        <div class="editable exercise-name flex-1 rounded-xl px-3 py-2 text-sm font-bold outline-none" contenteditable="false" oninput="autoSave(true)" placeholder="Упражнение...">${data?.name || ''}</div>
                    </div>
                    <div class="exercise-card-controls">
                        <button type="button" onclick="toggleExerciseEdit(this, event)" class="exercise-edit-btn" title="Редактировать упражнение">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 11l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 14.536A4 4 0 019.707 15.707L6 16l.293-3.707A4 4 0 017.464 9.464L9 11z" /></svg>
                        </button>
                    </div>
                </div>
                <div class="exercise-details hidden space-y-2">
                    <div class="sets-container space-y-2"></div>
                    <button onclick="addSetToBtn(this)" class="exercise-add-set text-[9px] font-black uppercase tracking-widest px-2 py-1">+ подход</button>
                </div>
                <button onclick="this.closest('[data-type]').remove(); autoSave();" class="exercise-remove-btn absolute right-3 bottom-3 text-lg leading-none" title="Удалить упражнение">&times;</button>
            `;
            const sets = div.querySelector('.sets-container');
            if (data?.sets) data.sets.forEach(s => sets.appendChild(createSet(s.w, s.r, s.t)));
            else sets.appendChild(createSet());
            container.appendChild(div);
            applyAlternatingThemes();
        }

        function renderSuperset(container, data = null) {
            const div = document.createElement('div');
            div.className = "superset-card p-4 rounded-2xl space-y-4";
            div.dataset.type = "superset";
            div.innerHTML = `
                <div class="superset-header flex justify-between items-center px-1"><span class="superset-label text-[9px] font-black uppercase">БЛОК</span><button onclick="this.closest('[data-type]').remove(); autoSave();" class="superset-remove-btn">&times;</button></div>
                <div class="superset-inner space-y-4"></div>
                <button onclick="addExToSuperset(this)" class="superset-add-btn text-[9px] font-black uppercase tracking-widest px-2 py-1">+ В БЛОК</button>
            `;
            container.appendChild(div);
            const inner = div.querySelector('.superset-inner');
            if (data?.exercises) data.exercises.forEach(ex => renderExercise(inner, ex, true));
            else { renderExercise(inner, null, true); renderExercise(inner, null, true); }
            applyAlternatingThemes();
        }

        function handleExerciseCardClick(event, card) {
            if (!card) return;
            if (event.target.closest('button, input, .set-input')) return;
            const editable = card.querySelector('.exercise-name');
            if (editable?.getAttribute('contenteditable') === 'true') return;
            toggleExerciseDetails(card);
        }

        function toggleExerciseEdit(btn, event) {
            event?.stopPropagation();
            const card = btn.closest('.exercise-card');
            const name = card?.querySelector('.exercise-name');
            if (!card || !name) return;
            const willEdit = !card.classList.contains('is-editing');
            card.classList.toggle('is-editing', willEdit);
            btn.classList.toggle('is-active', willEdit);
            name.setAttribute('contenteditable', willEdit ? 'true' : 'false');
            if (willEdit) {
                name.focus();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(name);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                name.blur();
                autoSave(true);
            }
        }

        function createSet(w = '', r = '', t = '00:00') {
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 w-fit";
            div.innerHTML = `
                <div class="flex items-center gap-1"><input type="text" readonly class="set-input font-bold" value="${w}" onclick="openDropdown(event, 'weight')"><span class="text-slate-500 text-[9px] font-black">КГ</span></div>
                <div class="w-px h-3 bg-slate-300"></div>
                <div class="flex items-center gap-1"><input type="text" readonly class="set-input font-bold" value="${r}" onclick="openDropdown(event, 'reps')"><span class="text-slate-500 text-[9px] font-black">ПОВТ</span></div>
                <div class="w-px h-3 bg-slate-300"></div>
                <input type="text" readonly class="set-input font-mono text-blue-400 font-bold w-12" value="${t}" onclick="openDropdown(event, 'exercise')">
                <button onclick="this.parentElement.remove(); autoSave();" class="text-slate-500 hover:text-red-500 ml-1">&times;</button>
            `;
            return div;
        }
