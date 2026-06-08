        // --- TEMPLATES LOGIC ---
        function sortTemplatesAlphabetically(templates = []) {
            return [...templates].sort((a, b) => {
                const aName = (a?.name || '').trim();
                const bName = (b?.name || '').trim();
                const isAutoName = (name) => {
                    const n = (name || '').trim().toLocaleLowerCase('ru');
                    if (!n) return true;
                    if (n === 'новый шаблон' || n === 'без названия') return true;
                    return n.startsWith('новый шаблон (');
                };
                const aAuto = isAutoName(aName);
                const bAuto = isAutoName(bName);
                if (aAuto !== bAuto) return aAuto ? 1 : -1;
                if (aAuto && bAuto) {
                    const aId = Number(a?.id) || 0;
                    const bId = Number(b?.id) || 0;
                    return aId - bId;
                }
                return aName.localeCompare(bName, 'ru', { sensitivity: 'base', numeric: true });
            });
        }

        function saveSessionAsTemplate(sessionId) {
            const card = document.querySelector(`.day-card[data-id="${sessionId}"]`);
            const templates = sortTemplatesAlphabetically(JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'));
            const newT = {
                id: Date.now().toString(),
                name: "Новый шаблон",
                weekday: card.querySelector('.weekday-value').textContent.trim(),
                totalTime: card.querySelector('[data-type="total-time"]').value,
                items: Array.from(card.querySelectorAll('.exercise-list > [data-type]')).map(el => parseExerciseElement(el))
            };
            templates.push(newT);
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sortTemplatesAlphabetically(templates)));
            showToast("Шаблон сохранен");
        }

        function renderTemplateList() {
            const list = document.getElementById('templateList');
            const templates = sortTemplatesAlphabetically(JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'));
            list.innerHTML = '';
            if (templates.length === 0) { list.innerHTML = '<p class="text-center text-slate-600 py-10">Библиотека пуста</p>'; return; }

            templates.forEach(t => {
                const card = document.createElement('div');
                card.className = "template-card";
                card.dataset.templateId = t.id;
                card.innerHTML = `
                    <div class="template-top-row">
                        <span class="template-chip">${t.weekday}</span>
                        <input type="text" class="template-name-input" value="${t.name}" onkeydown="handleTemplateNameKey(event, '${t.id}')" onblur="saveTemplateName(this, '${t.id}')">
                        <span class="template-time">${t.totalTime || '00:00'}</span>
                    </div>
                    <div class="template-exercises-preview hidden">
                        ${getTemplateExerciseSummary(t)}
                    </div>
                    <div class="template-menu">
                        <button onclick="applyTemplateById('${t.id}')" class="template-menu-btn primary" title="Применить шаблон">▶</button>
                        <button onclick="toggleTemplateExercises(this)" class="template-menu-btn" title="Показать упражнения">👁</button>
                        <button onclick="focusTemplateName('${t.id}')" class="template-menu-btn" title="Переименовать">✎</button>
                        <button onclick="duplicateTemplate('${t.id}')" class="template-menu-btn" title="Дублировать">⧉</button>
                        <button onclick="deleteTemplate('${t.id}')" class="template-menu-btn danger" title="Удалить">🗑</button>
                    </div>
                `;
                list.appendChild(card);
            });
        }

        function getTemplateExerciseSummary(template) {
            const names = [];
            (template?.items || []).forEach(item => {
                if (item?.type === 'superset') {
                    (item.exercises || []).forEach(ex => {
                        const name = (ex?.name || '').trim();
                        if (name) names.push(name);
                    });
                    return;
                }
                const name = (item?.name || '').trim();
                if (name) names.push(name);
            });

            const uniqueNames = Array.from(new Set(names));
            if (uniqueNames.length === 0) return '<p class="text-[11px] text-slate-500">Нет упражнений в шаблоне</p>';

            return `
                <p class="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Упражнения</p>
                <div class="template-exercise-list">
                    ${uniqueNames.map(name => `<span class="template-exercise-item">${name}</span>`).join('')}
                </div>
            `;
        }

        function toggleTemplateExercises(btn) {
            const card = btn.closest('.template-card');
            const preview = card?.querySelector('.template-exercises-preview');
            if (!preview) return;
            const isHidden = preview.classList.contains('hidden');
            preview.classList.toggle('hidden', !isHidden);
            btn.classList.toggle('is-active', isHidden);
            btn.title = isHidden ? 'Скрыть упражнения' : 'Показать упражнения';
        }

        function handleTemplateNameKey(e, templateId) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTemplateName(e.target, templateId);
                e.target.blur();
            }
        }

        function saveTemplateName(inputEl, templateId) {
            const templates = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
            const idx = templates.findIndex(t => t.id === templateId);
            if (idx === -1) return;
            const nextName = inputEl.value.trim() || "Без названия";
            if (templates[idx].name === nextName) return;
            templates[idx].name = nextName;
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sortTemplatesAlphabetically(templates)));
            renderTemplateList();
            showToast("Название обновлено");
        }

        function focusTemplateName(templateId) {
            const card = document.querySelector(`#templateList .template-card[data-template-id="${templateId}"]`);
            const input = card?.querySelector('.template-name-input');
            if (!input) return;
            input.focus();
            input.select();
        }

        function duplicateTemplate(id) {
            const templates = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
            const source = templates.find(x => x.id === id);
            if (!source) return;
            templates.push({
                ...JSON.parse(JSON.stringify(source)),
                id: Date.now().toString(),
                name: `${source.name || 'Шаблон'} (копия)`
            });
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sortTemplatesAlphabetically(templates)));
            renderTemplateList();
            showToast("Шаблон продублирован");
        }

        function applyTemplateById(id) {
            const t = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]').find(x => x.id === id);
            if (!t) return;
            const card = document.querySelector(`.day-card[data-id="${activeSessionIdForTemplate}"]`);
            if (!card) return;
            card.dataset.templateId = String(id);
            card.dataset.itemsLoaded = '1';
            delete card.dataset.itemsJson;
            card.querySelector('[data-type="total-time"]').value = t.totalTime;
            const list = card.querySelector('.exercise-list');
            list.innerHTML = '';
            t.items.forEach(i => i.type === 'superset' ? renderSuperset(list, i) : renderExercise(list, i));
            switchRoom('log');
            autoSave();
        }

        function deleteTemplate(id) {
            let t = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sortTemplatesAlphabetically(t.filter(x => x.id !== id))));
            renderTemplateList();
        }

        let templateSearchQuery = '';
        let templateRenderLimit = 0;

        function initTemplateSearch() {
            ensureTemplateControls();
        }

        function ensureTemplateControls() {
            const list = document.getElementById('templateList');
            if (!list || document.getElementById('templateToolbar')) return;
            const toolbar = document.createElement('div');
            toolbar.id = 'templateToolbar';
            toolbar.innerHTML = `
                <input id="templateSearchInput" type="search" class="w-full bg-transparent border border-slate-600/50 text-slate-300 text-sm font-semibold py-2 px-4 rounded-xl outline-none placeholder-slate-500" placeholder="Поиск...">
                <div id="templateListMeta" class="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-2"></div>
            `;
            list.parentElement.insertBefore(toolbar, list);
            const searchInput = document.getElementById('templateSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    templateSearchQuery = searchInput.value.trim().toLocaleLowerCase('ru');
                    templateRenderLimit = LOW_PERF_UI ? 18 : 36;
                    renderTemplateList();
                });
            }
        }

        function getFilteredTemplates(templates) {
            if (!templateSearchQuery) return templates;
            return templates.filter(t => {
                const haystack = [
                    t?.name || '',
                    t?.weekday || '',
                    ...(t?.items || []).flatMap(item => item?.type === 'superset'
                        ? (item.exercises || []).map(ex => ex?.name || '')
                        : [item?.name || ''])
                ].join(' ').toLocaleLowerCase('ru');
                return haystack.includes(templateSearchQuery);
            });
        }

        renderTemplateList = function renderTemplateListOptimized() {
            ensureTemplateControls();
            const list = document.getElementById('templateList');
            const meta = document.getElementById('templateListMeta');
            const searchInput = document.getElementById('templateSearchInput');
            const templates = sortTemplatesAlphabetically(JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'));
            const filteredTemplates = getFilteredTemplates(templates);
            if (searchInput && searchInput.value.trim().toLocaleLowerCase('ru') !== templateSearchQuery) {
                searchInput.value = templateSearchQuery;
            }
            if (!templateRenderLimit) templateRenderLimit = LOW_PERF_UI ? 18 : 36;
            const visibleTemplates = filteredTemplates.slice(0, templateRenderLimit);
            list.innerHTML = '';

            if (meta) {
                meta.textContent = filteredTemplates.length > visibleTemplates.length
                    ? `Показано ${visibleTemplates.length} из ${filteredTemplates.length}`
                    : `${filteredTemplates.length} шаблонов`;
            }

            if (filteredTemplates.length === 0) {
                list.innerHTML = '<p class="text-center text-slate-500 py-10 text-sm">Ничего не найдено</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            visibleTemplates.forEach(t => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.dataset.templateId = t.id;
                card.innerHTML = `
                    <div class="template-menu template-menu-top">
                        <button onclick="applyTemplateById('${t.id}')" class="template-menu-btn primary" title="Применить">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <button onclick="toggleTemplateExercises(this)" class="template-menu-btn" title="Показать упражнения">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                    <input type="text" class="template-name-input" value="${t.name}" onkeydown="handleTemplateNameKey(event, '${t.id}')" onblur="saveTemplateName(this, '${t.id}')">
                    <span class="text-[10px] text-slate-500 font-bold uppercase">${t.totalTime || '00:00'}</span>
                    <div class="template-exercises-preview hidden mt-2" data-loaded="0"></div>
                    <div class="template-menu">
                        <button onclick="focusTemplateName('${t.id}')" class="template-menu-btn" title="Переименовать">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onclick="duplicateTemplate('${t.id}')" class="template-menu-btn" title="Дублировать">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button onclick="deleteTemplate('${t.id}')" class="template-menu-btn danger" title="Удалить">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                `;
                fragment.appendChild(card);
            });
            list.appendChild(fragment);

            if (filteredTemplates.length > visibleTemplates.length) {
                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'template-load-more';
                moreBtn.textContent = 'Показать еще';
                moreBtn.onclick = () => {
                    templateRenderLimit += LOW_PERF_UI ? 18 : 36;
                    renderTemplateList();
                };
                list.appendChild(moreBtn);
            }
        };

        toggleTemplateExercises = function toggleTemplateExercisesOptimized(btn) {
            const card = btn.closest('.template-card');
            const preview = card?.querySelector('.template-exercises-preview');
            if (!preview) return;
            const isHidden = preview.classList.contains('hidden');
            if (isHidden && preview.dataset.loaded !== '1') {
                const templateId = card?.dataset?.templateId;
                const template = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]').find(x => x.id === templateId);
                preview.innerHTML = getTemplateExerciseSummary(template);
                preview.dataset.loaded = '1';
            }
            preview.classList.toggle('hidden', !isHidden);
            btn.classList.toggle('is-active', isHidden);
            btn.title = isHidden ? 'Скрыть упражнения' : 'Показать упражнения';
        };

        // --- UTILS ---
        function toggleCollapse(el) {
            const card = el.closest('.day-card');
            const content = card?.querySelector('.day-content');
            const willOpen = content?.classList.contains('hidden');
            if (willOpen) ensureDayCardContentLoaded(card);
            content?.classList.toggle('hidden');
            el.classList.toggle('is-open', !!willOpen);
            card?.classList.toggle('is-expanded', !!willOpen);
            el.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            el.setAttribute('title', willOpen ? 'Свернуть тренировку' : 'Развернуть тренировку');
            const label = el.querySelector('.day-toggle-label');
            if (label) label.textContent = willOpen ? 'Свернуть' : 'Развернуть';
            if (willOpen) applyAlternatingThemes();
        }
        function openTemplateModal(id) {
            activeSessionIdForTemplate = id;
            ensureTemplateControls();
            templateRenderLimit = LOW_PERF_UI ? 18 : 36;
            renderTemplateList();
            switchRoom('templates');
        }
        function showToast(txt) { const t = document.getElementById('toast'); t.textContent = txt; t.classList.add('active'); setTimeout(() => t.classList.remove('active'), 2500); }
        function addSetToBtn(btn) { btn.previousElementSibling.appendChild(createSet()); applyAlternatingThemes(); autoSave(true); }
        function addExerciseByBtn(btn) { renderExercise(btn.parentElement.parentElement.previousElementSibling); applyAlternatingThemes(); autoSave(true); }
        function addSupersetByBtn(btn) { renderSuperset(btn.parentElement.parentElement.previousElementSibling); applyAlternatingThemes(); autoSave(true); }
        function addExToSuperset(btn) { renderExercise(btn.previousElementSibling, null, true); applyAlternatingThemes(); autoSave(true); }
        function deleteDay(id) { if (confirm('Удалить тренировку?')) { document.querySelector(`.day-card[data-id="${id}"]`)?.remove(); autoSave(); } }
        function toggleExerciseDetails(triggerEl) {
            const card = triggerEl?.classList?.contains('exercise-card') ? triggerEl : triggerEl.closest('.exercise-card');
            const details = card?.querySelector('.exercise-details');
            if (!details) return;
            details.classList.toggle('hidden');
            card.classList.toggle('is-open', !details.classList.contains('hidden'));
        }

        function initNativeDatePicker() {
            nativeDatePicker.addEventListener('change', () => {
                if (!activeInput || !nativeDatePicker.value) return;
                const [year, month, day] = nativeDatePicker.value.split('-').map(Number);
                const parent = activeInput.closest('.date-container');
                applyDateToContainer(parent, year, month, day);
            });
        }

        function initMobileDateModal() {
            document.getElementById('mobileDateCancelBtn').addEventListener('click', () => {
                mobileDateModal.classList.remove('active');
                mobileDateTarget = null;
            });
            document.getElementById('mobileDateTodayBtn').addEventListener('click', () => {
                const now = new Date();
                mobileDateInput.value = formatDateValue({ y: now.getFullYear(), m: now.getMonth(), d: now.getDate() });
            });
            document.getElementById('mobileDateApplyBtn').addEventListener('click', () => {
                if (!mobileDateTarget || !mobileDateInput.value) return;
                const [year, month, day] = mobileDateInput.value.split('-').map(Number);
                applyDateToContainer(mobileDateTarget, year, month, day);
                mobileDateModal.classList.remove('active');
                mobileDateTarget = null;
            });
            mobileDateModal.addEventListener('click', (e) => {
                if (e.target === mobileDateModal) {
                    mobileDateModal.classList.remove('active');
                    mobileDateTarget = null;
                }
            });
        }

        function isMobileDateExperience() {
            return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
        }

        function formatDateValue(dateObj) {
            return `${dateObj.y}-${String(dateObj.m + 1).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
        }

        function toShortWeekday(value) {
            return WEEKDAY_SHORT_MAP[value] || value || '';
        }

        function applyDateToContainer(parent, year, month, day) {
            if (!parent || !year || !month || !day) return;
            parent.querySelector('[data-type="d"]').textContent = String(day);
            parent.querySelector('[data-type="m"]').textContent = MONTHS[(month || 1) - 1];
            parent.querySelector('[data-type="y"]').textContent = String(year);
            const weekdayIdx = (new Date(year, (month || 1) - 1, day).getDay() + 6) % 7;
            const weekdayEl = parent.parentElement?.querySelector('.weekday-value');
            if (weekdayEl) weekdayEl.textContent = WEEKDAYS[weekdayIdx];
            needsDomSort = true;
            autoSave();
        }

        function openDateCalendar(e) {
            e.stopPropagation();
            activeInput = e.currentTarget;
            const dateObj = {
                d: Number(activeInput.querySelector('[data-type="d"]')?.textContent || 1),
                m: MONTH_INDEX[activeInput.querySelector('[data-type="m"]')?.textContent?.trim()] ?? 0,
                y: Number(activeInput.querySelector('[data-type="y"]')?.textContent || new Date().getFullYear())
            };
            if (isMobileDateExperience()) {
                mobileDateTarget = activeInput.closest('.date-container');
                mobileDateInput.value = formatDateValue(dateObj);
                mobileDateModal.classList.add('active');
                return;
            }
            nativeDatePicker.value = formatDateValue(dateObj);
            if (typeof nativeDatePicker.showPicker === 'function') nativeDatePicker.showPicker();
            else nativeDatePicker.click();
        }

        function openDropdown(e, type) {
            e.stopPropagation(); closeAllDropdowns();
            let target = e.currentTarget;
            if (type === 'weight' || type === 'reps' || type === 'exercise') {
                const input = target.querySelector('.set-input');
                if (input) target = input;
            }
            activeInput = target;
            const rect = target.getBoundingClientRect();
            const dd = dropdowns[type];
            dd.style.top = `${rect.bottom + window.scrollY + 8}px`;
            dd.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
            dd.classList.add('active');
            requestAnimationFrame(() => syncDropdownState(type, dd));
        }

        function handleSelection(val, type) {
            if (!activeInput) return;
            if (type === 'weekday') activeInput.textContent = val;
            else if (type === 'total' || type === 'ex') {
                const parts = (activeInput.value || "00:00").split(':');
                if (val.includes('h') || val.includes('m_first')) parts[0] = val.replace(/\D/g, '');
                else parts[1] = val.replace(/\D/g, '');
                activeInput.value = parts.join(':');
            } else if (type === 'w') {
                let curr = parseFloat(activeInput.value) || 0;
                let tens = Math.floor(curr / 10) * 10;
                let units = curr % 10;
                if (val.includes('tens')) tens = parseFloat(val.replace('tens', ''));
                else units = parseFloat(val.replace('units', ''));
                activeInput.value = tens + units;
            } else if (type === 'reps') activeInput.value = val;
            else if (type === 'date') {
                const parent = activeInput.closest('.date-container');
                if (val.includes('d_')) parent.querySelector('[data-type="d"]').textContent = val.replace('d_', '');
                else if (val.includes('m_')) parent.querySelector('[data-type="m"]').textContent = val.replace('m_', '');
                else parent.querySelector('[data-type="y"]').textContent = val.replace('y_', '');
                needsDomSort = true;
            }
            if (type === 'w' || type === 'ex' || type === 'reps') {
                const setRow = activeInput.closest('.set-row');
                if (setRow && typeof updateSetLayout === 'function') updateSetLayout(setRow);
            }
            if (type === 'total' && !val.includes('h')) closeAllDropdowns();
            else if (type === 'reps' || type === 'weekday' || (activeInput.classList.contains('set-input') && !type.includes('w'))) closeAllDropdowns();
            autoSave(type === 'date' ? false : true);
        }

        function closeAllDropdowns() { Object.values(dropdowns).forEach(d => d.classList.remove('active')); }
        document.addEventListener('click', closeAllDropdowns);

        function syncDropdownState(type, dropdownEl) {
            if (!dropdownEl) return;
            const selectedValues = getDropdownSelectedValues(type);
            const columns = Array.from(dropdownEl.querySelectorAll('.dropdown-column'));
            columns.forEach((column, index) => {
                const items = Array.from(column.querySelectorAll('.dropdown-item'));
                let selectedItem = null;
                items.forEach(item => {
                    const isSelected = item.dataset.value === selectedValues[index] || item.dataset.label === selectedValues[index];
                    item.classList.toggle('is-selected', isSelected);
                    if (isSelected) selectedItem = item;
                });
                if (selectedItem) {
                    const targetTop = selectedItem.offsetTop - Math.max(0, (column.clientHeight - selectedItem.offsetHeight) / 2);
                    column.scrollTop = targetTop;
                } else {
                    column.scrollTop = 0;
                }
            });
        }

        function getDropdownSelectedValues(type) {
            if (!activeInput) return [];
            if (type === 'total' || type === 'ex') {
                const parts = (activeInput.value || '00:00').split(':');
                return [parts[0] || '00', parts[1] || '00'];
            }
            if (type === 'reps') {
                return [String(activeInput.value || '')];
            }
            if (type === 'w') {
                const numeric = parseFloat(activeInput.value) || 0;
                const tens = Math.floor(numeric / 10) * 10;
                const units = numeric % 10;
                return [String(tens), String(units)];
            }
            if (type === 'weekday') {
                return [String(activeInput.textContent || '').trim()];
            }
            if (type === 'date') {
                const parent = activeInput.closest('.date-container');
                if (!parent) return [];
                return [
                    String(parent.querySelector('[data-type="d"]')?.textContent || '').trim(),
                    String(parent.querySelector('[data-type="m"]')?.textContent || '').trim(),
                    String(parent.querySelector('[data-type="y"]')?.textContent || '').trim()
                ];
            }
            return [];
        }
