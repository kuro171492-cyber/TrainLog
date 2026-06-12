const STORAGE_KEY = 'workout_v4_data';
        const TEMPLATE_KEY = 'workout_v4_templates';
        const REPO_FILE_KEY = 'trainlog_repo_file_handle_v1';
        const REPO_FILE_NAME = 'trainlog_data.json';
        const GITHUB_SYNC_KEY = 'trainlog_github_sync_v1';
        const MONTH_GROUP_STATE_KEY = 'trainlog_month_group_state_v1';
        const WEEK_GROUP_STATE_KEY = 'trainlog_week_group_state_v1';
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const MONTH_INDEX = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11,
            'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
            'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11,
            'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
            'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
        };
        const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const WEEKDAY_SHORT_MAP = {
            'Monday': 'Mon',
            'Tuesday': 'Tue',
            'Wednesday': 'Wed',
            'Thursday': 'Thu',
            'Friday': 'Fri',
            'Saturday': 'Sat',
            'Sunday': 'Sun',
            'Mon': 'Mon',
            'Tue': 'Tue',
            'Wed': 'Wed',
            'Thu': 'Thu',
            'Fri': 'Fri',
            'Sat': 'Sat',
            'Sun': 'Sun'
        };

        let activeInput = null;
        let activeSessionIdForTemplate = null;

        let repoFileHandle = null;
        let needsDomSort = false;

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
            if (typeof initTemplateSearch === 'function') initTemplateSearch();
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
            showToast("Data exported");
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
                    if (!data.workouts || !data.templates) throw new Error("Invalid file format");

                    if (confirm("This will replace all current data. Continue?")) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.workouts));
                        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data.templates));
                        writeDataToRepoFile(data).catch(() => { });
                        location.reload();
                    }
                } catch (err) {
                    showToast("Import error");
                }
            };
            reader.readAsText(file);
        }

        function getGitHubConfig() {
            return JSON.parse(localStorage.getItem(GITHUB_SYNC_KEY) || 'null');
        }

        function sanitizeGitHubToken(rawToken) {
            return String(rawToken || '')
                .trim()
                .replace(/^['"]|['"]$/g, '')
                .replace(/^(Bearer|token)\s+/i, '');
        }



        function getGitHubHeadersWithScheme(token, scheme, extraHeaders = {}) {
            return {
                Authorization: `${scheme} ${sanitizeGitHubToken(token)}`,
                Accept: 'application/vnd.github+json',
                ...extraHeaders
            };
        }

        async function githubFetchWithAuthFallback(url, options = {}) {
            const token = sanitizeGitHubToken(options.token || '');
            const extraHeaders = { ...(options.headers || {}) };
            delete extraHeaders.Authorization;

            const requestOptions = {
                method: options.method || 'GET',
                body: options.body,
                headers: getGitHubHeadersWithScheme(token, 'Bearer', extraHeaders)
            };

            let res = await fetch(url, requestOptions);
            if (res.status !== 401) return res;

            res = await fetch(url, {
                ...requestOptions,
                headers: getGitHubHeadersWithScheme(token, 'token', extraHeaders)
            });
            return res;
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
            const token = prompt("GitHub token (classic/fine-grained with Contents read/write):", sanitizeGitHubToken(current.token || ""));
            if (!token) return;

            localStorage.setItem(GITHUB_SYNC_KEY, JSON.stringify({
                owner: owner.trim(),
                repo: repo.trim(),
                path: path.trim(),
                branch: branch.trim(),
                token: sanitizeGitHubToken(token)
            }));
            showToast("GitHub Sync configured");
        }


        async function parseGitHubError(res) {
            let details = `GitHub HTTP ${res.status}`;
            try {
                const data = await res.json();
                if (data?.message) details += `: ${data.message}`;
            } catch (_) { }
            if (res.status === 401) {
                details += `. Check PAT, repo access, and Contents read/write permission.`;
            }
            return details;
        }

        function getGitHubApiUrl(cfg, includeRef = true) {
            const safePath = cfg.path.split('/').map(encodeURIComponent).join('/');
            const baseUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${safePath}`;
            return includeRef ? `${baseUrl}?ref=${encodeURIComponent(cfg.branch)}` : baseUrl;
        }

        function handleGitHubAuthFailure(actionLabel) {
            const shouldReconfigure = confirm(
                `${actionLabel}: GitHub rejected token (401 Bad credentials).\n\n` +
                `Press OK to re-enter owner/repo/branch/path/token.`
            );
            if (shouldReconfigure) configureGitHubSync();
        }

        async function validateGitHubSync() {
            let cfg = getGitHubConfig();
            if (!cfg) {
                const shouldConfigure = confirm("GitHub Sync is not configured. Press OK to enter owner/repo/branch/path/token.");
                if (!shouldConfigure) return;
                configureGitHubSync();
                cfg = getGitHubConfig();
                if (!cfg) return;
            }

            try {
                const repoMetaUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
                const repoRes = await githubFetchWithAuthFallback(repoMetaUrl, { token: cfg.token });
                if (repoRes.status === 401) {
                    handleGitHubAuthFailure("GitHub Sync Check");
                    throw new Error("Token rejected by GitHub (401 Bad credentials)");
                }
                if (repoRes.status === 404) {
                    throw new Error(`Repository ${cfg.owner}/${cfg.repo} not found or inaccessible`);
                }
                if (!repoRes.ok) {
                    throw new Error(await parseGitHubError(repoRes));
                }

                const branchUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/branches/${encodeURIComponent(cfg.branch)}`;
                const branchRes = await githubFetchWithAuthFallback(branchUrl, { token: cfg.token });
                if (branchRes.status === 404) {
                    throw new Error(`Branch ${cfg.branch} not found in ${cfg.owner}/${cfg.repo}`);
                }
                if (!branchRes.ok) {
                    throw new Error(await parseGitHubError(branchRes));
                }

                const contentRes = await githubFetchWithAuthFallback(getGitHubApiUrl(cfg), { token: cfg.token });
                if (contentRes.status === 404) {
                    showToast(`GitHub Sync OK: repo and branch accessible, file ${cfg.path} not found yet`);
                    return;
                }
                if (!contentRes.ok) {
                    throw new Error(await parseGitHubError(contentRes));
                }

                showToast(`GitHub Sync OK: ${cfg.owner}/${cfg.repo}@${cfg.branch}`);
            } catch (err) {
                console.error('GitHub sync validation failed:', err);
                showToast(`GitHub Sync Check: ${err?.message || 'unknown error'}`);
            }
        }

        async function downloadFromGitHub() {
            const cfg = getGitHubConfig();
            if (!cfg) {
                configureGitHubSync();
                if (!getGitHubConfig()) return;
            }
            const activeCfg = getGitHubConfig();

            try {
                const res = await githubFetchWithAuthFallback(getGitHubApiUrl(activeCfg), {
                    token: activeCfg.token
                });
                if (res.status === 401) {
                    handleGitHubAuthFailure("Download Error");
                    throw new Error("GitHub HTTP 401: Bad credentials");
                }
                if (!res.ok) throw new Error(await parseGitHubError(res));
                const payload = await res.json();
                const decoded = decodeURIComponent(escape(atob((payload.content || '').replace(/\n/g, ''))));
                const data = JSON.parse(decoded);
                if (!data.workouts || !data.templates) throw new Error('Invalid data format');

                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.workouts));
                localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data.templates));
                await loadFromStorage();
                showToast("Downloaded from GitHub");
            } catch (err) {
                console.error('GitHub download failed:', err);
                showToast(`Download error: ${err?.message || 'check GitHub settings'}`);
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
                const getRes = await githubFetchWithAuthFallback(getGitHubApiUrl(activeCfg), {
                    token: activeCfg.token
                });
                if (getRes.ok) {
                    const existing = await getRes.json();
                    sha = existing.sha || null;
                } else if (getRes.status === 401) {
                    handleGitHubAuthFailure("Save Error");
                    throw new Error("GitHub HTTP 401: Bad credentials");
                } else if (getRes.status !== 404) {
                    throw new Error(await parseGitHubError(getRes));
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

                const putRes = await githubFetchWithAuthFallback(getGitHubApiUrl(activeCfg, false), {
                    method: 'PUT',
                    token: activeCfg.token,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(putBody)
                });
                if (putRes.status === 401) {
                    handleGitHubAuthFailure("Save Error");
                    throw new Error("GitHub HTTP 401: Bad credentials");
                }
                if (!putRes.ok) throw new Error(await parseGitHubError(putRes));

                showToast("Saved to GitHub");
            } catch (err) {
                console.error('GitHub upload failed:', err);
                showToast(`Save error: ${err?.message || 'check GitHub settings'}`);
            }
        }

        // --- CORE UI LOGIC ---
        function switchRoom(room) {
            document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
            const target = document.getElementById(room === 'log' ? 'roomLog' : 'roomTemplates');
            if (target) target.classList.add('active');
        }

        function addDay(data = null, insertAtTop = true, triggerAutoSave = true) {
            const id = data?.id || Date.now();
            const now = new Date();
            const date = data?.dateObj || { d: now.getDate(), m: MONTHS[now.getMonth()], y: now.getFullYear(), wd: WEEKDAYS[(now.getDay() + 6) % 7] };
            const weekdayShort = toShortWeekday(date.wd);
            const weekdayClassMap = { 'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu', 'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun', 'Пн': 'mon', 'Вт': 'tue', 'Ср': 'wed', 'Чт': 'thu', 'Пт': 'fri', 'Сб': 'sat', 'Вс': 'sun' };
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
                        <div class="day-toggle-strip" onclick="event.stopPropagation()">
                            <button type="button" onclick="toggleCollapse(this)" class="day-toggle-btn day-icon-btn rounded-xl transition-all" aria-expanded="false" title="Expand">
                                <span class="day-toggle-label">Expand</span>
                                <span class="day-collapse-caret">▼</span>
                            </button>
                        </div>
                        <div class="day-meta-strip flex items-center gap-2" onclick="event.stopPropagation()">
                            <div class="date-container day-date-chip flex items-center gap-1 px-3 py-1 text-xs font-bold cursor-pointer" onclick="openDateCalendar(event)">
                                <span data-type="d">${date.d}</span> <span data-type="m">${date.m}</span><span data-type="y" class="hidden">${date.y}</span>
                            </div>
                            <div class="weekday-value day-weekday-badge text-xs font-bold">
                                ${weekdayShort}
                            </div>
                            <div class="day-total-chip flex items-center rounded-xl px-3 py-1.5" onclick="event.stopPropagation()">
                                <input type="text" readonly class="day-total-input bg-transparent font-mono font-bold text-xs w-12 text-center outline-none cursor-pointer" onclick="openDropdown(event, 'total')" data-type="total-time" value="${data?.totalTime || '01:00'}">
                            </div>
                        </div>
                        <div class="day-actions flex gap-2" onclick="event.stopPropagation()">
                            <button onclick="saveSessionAsTemplate(${id})" class="day-action-wide day-icon-btn rounded-xl transition-all" aria-label="Save as template" title="Save as template">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M17 21a2 2 0 01-2-2v-7m2 7h-7"/></svg>
                                <span>Save Template</span>
                            </button>
                            <button onclick="openTemplateModal(${id})" class="day-action-wide day-icon-btn day-icon-btn-primary rounded-xl transition-all" aria-label="Load template" title="Load template">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M12 16V4m0 12l-4-4m4 4l4-4"/></svg>
                                <span>Load Template</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="day-content hidden p-3 sm:p-4 pt-0 border-t border-slate-300/70">
                    <div class="exercise-list space-y-3 pt-3"></div>
                    <div class="day-footer mt-5 flex justify-between items-center">
                        <div class="day-footer-actions flex gap-2">
                            <button onclick="addExerciseByBtn(this)" class="day-footer-btn day-footer-btn-muted px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">+ Exercise</button>
                            <button onclick="addSupersetByBtn(this)" class="day-footer-btn day-footer-btn-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all">+ Superset</button>
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
            if (typeof updateEmptyState === 'function') updateEmptyState();
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
            div.className = `exercise-card relative p-3 rounded-2xl border space-y-2 ${isSub ? 'is-sub' : ''}`;
            div.dataset.type = 'exercise';
            div.setAttribute('onclick', 'handleExerciseCardClick(event, this)');
            div.innerHTML = `
                <div class="exercise-card-shell">
                    <div class="exercise-main flex items-center gap-3">
                        <div class="editable exercise-name flex-1 rounded-xl px-3 py-2 text-sm font-bold outline-none" contenteditable="false" oninput="autoSave(true)" placeholder="Exercise name">${data?.name || ''}</div>
                    </div>
                    <div class="exercise-card-controls">
                        <button type="button" onclick="toggleExerciseEdit(this, event)" class="exercise-edit-btn" title="Edit" aria-label="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M4 20l3.5-.5 9.2-9.2a1.8 1.8 0 10-2.5-2.5L5 17l-1 3zM13 7l4 4" /></svg>
                        </button>
                        <button onclick="this.closest('[data-type]').remove(); autoSave();" class="exercise-remove-btn" title="Delete" aria-label="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M6 7.5h12M9.5 7.5v-2h5v2M9 10.5v5M15 10.5v5M8 18.5h8a1 1 0 001-1v-10H7v10a1 1 0 001 1z" /></svg>
                        </button>
                    </div>
                </div>
                <div class="exercise-details hidden space-y-2">
                    <div class="set-grid-header" aria-hidden="true">
                        <span>kg</span>
                        <span>reps</span>
                        <span>time</span>
                        <span></span>
                    </div>
                    <div class="sets-container space-y-2"></div>
                    <button onclick="addSetToBtn(this)" class="exercise-add-set text-[9px] font-black uppercase tracking-widest px-2 py-1">+ Set</button>
                </div>
            `;
            const sets = div.querySelector('.sets-container');
            if (data?.sets) data.sets.forEach(s => sets.appendChild(createSet(s.w, s.r, s.t)));
            else sets.appendChild(createSet());
            container.appendChild(div);
        }

        function renderSuperset(container, data = null) {
            const div = document.createElement('div');
            div.className = "superset-card p-3 rounded-2xl space-y-3";
            div.dataset.type = "superset";
            div.innerHTML = `
                <div class="superset-header flex justify-between items-center px-1"><span class="superset-label text-[9px] font-black uppercase">Superset</span><button onclick="this.closest('[data-type]').remove(); autoSave();" class="superset-remove-btn" title="Delete superset" aria-label="Delete superset"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M6 7.5h12M9.5 7.5v-2h5v2M9 10.5v5M15 10.5v5M8 18.5h8a1 1 0 001-1v-10H7v10a1 1 0 001 1z" /></svg></button></div>
                <div class="superset-inner space-y-2"></div>
                <button onclick="addExToSuperset(this)" class="superset-add-btn text-[9px] font-black uppercase tracking-widest px-2 py-1">+ Exercise</button>
            `;
            container.appendChild(div);
            const inner = div.querySelector('.superset-inner');
            if (data?.exercises) data.exercises.forEach(ex => renderExercise(inner, ex, true));
            else { renderExercise(inner, null, true); renderExercise(inner, null, true); }
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
            div.className = "set-row";
            div.innerHTML = `
                <div class="set-field set-field-weight" onclick="openDropdown(event, 'weight')">
                    <input type="text" readonly class="set-input font-bold" value="${w}" onclick="event.stopPropagation(); openDropdown(event, 'weight')">
                </div>
                <div class="set-field set-field-reps">
                    <input type="text" readonly class="set-input font-bold" value="${r}" onclick="openDropdown(event, 'reps')">
                </div>
                <div class="set-field set-field-time" onclick="openDropdown(event, 'exercise')">
                    <input type="text" readonly class="set-input set-input-time font-mono text-blue-400 font-bold" value="${t}" onclick="event.stopPropagation(); openDropdown(event, 'exercise')">
                </div>
                <button onclick="this.parentElement.remove(); autoSave();" class="set-remove-btn" title="Delete set" aria-label="Delete set">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M6 7.5h12M9.5 7.5v-2h5v2M9 10.5v5M15 10.5v5M8 18.5h8a1 1 0 001-1v-10H7v10a1 1 0 001 1z" /></svg>
                </button>
            `;
            updateSetLayout(div);
            return div;
        }

        function updateSetLayout(setRow) {
            const fields = [
                setRow.querySelector('.set-field-weight'),
                setRow.querySelector('.set-field-reps'),
                setRow.querySelector('.set-field-time')
            ];
            fields.forEach(f => { if (f) f.style.flex = '1 1 0'; });
        }
