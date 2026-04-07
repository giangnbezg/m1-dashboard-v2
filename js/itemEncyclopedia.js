/**
 * itemEncyclopedia.js — Tab: Item Encyclopedia
 * 4 sub-tabs:
 *   1. Merge Items   — itemRaw, kèm energy cost tính từ RateGenerator
 *   2. Generators    — itemGenerator + chi tiết spawn rate từ rateGenerator
 *   3. Recipes       — formuaRecipes, hiển thị nguyên liệu + thời gian
 *   4. Other         — itemFood, itemBooster, itemChest, itemCurrency, itemTool
 */

const ItemEncyclopedia = (() => {

    // ── Helpers ───────────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    function setText(id, val) {
        const el = $(id);
        if (el) el.textContent = val;
    }

    function badge(text, bg, border, color) {
        return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:500;background:${bg};border:1px solid ${border};color:${color};">${text}</span>`;
    }

    function fmtNum(v) {
        if (v === '' || v === undefined || v === null) return '';
        const n = parseFloat(v);
        return isNaN(n) ? v : n.toLocaleString();
    }

    // ── Sub-tab navigation ────────────────────────────────────────────────────

    function initSubTabs() {
        document.querySelectorAll('.encyc-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.encyc-sub-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.encyc-subtab-content').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.getAttribute('data-subtab');
                const panel = document.getElementById(target);
                if (panel) panel.classList.add('active');
            });
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 1: MERGE ITEMS
    // ═════════════════════════════════════════════════════════════════════════

    function initMergeItems() {
        const data = window.GameData;

        // Build map: item_id → energy_cost từ RateGenerator (lấy cost của generator cấp thấp nhất spawn ra item đó)
        // RateGenerator schema: type, id, item_type, rate_type, item_id, rate, time_cooldown, cost_energy
        const energyMap = {}; // item_id → { energy, genId, genType }
        (data.rateGenerator || []).forEach(row => {
            if (!row.item_id || !row.cost_energy) return;
            const itemId = row.item_id.trim();
            const energy = parseFloat(row.cost_energy) || 0;
            const genId  = parseInt(row.id) || 0;
            // Giữ generator cấp thấp nhất (id nhỏ nhất) spawn ra item này
            if (!energyMap[itemId] || genId < energyMap[itemId].genId) {
                energyMap[itemId] = { energy, genId, genType: row.type };
            }
        });

        // Rows: itemRaw
        const sources = [
            { rows: data.itemRaw || [], sourceLabel: 'ItemRaw', color: '#a78bfa' },
        ];

        let allRows = [];
        sources.forEach(({ rows, sourceLabel, color }) => {
            let chain = 0;
            let lastType = '';
            rows.forEach(item => {
                if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
                const energyInfo = energyMap[item.id] || null;
                allRows.push({
                    sourceLabel, color, chain,
                    type:        item.type || '',
                    id:          item.id || '',
                    name:        item.name_item || '',
                    merge_to:    item.merge_to || '',
                    sell_price:  item.sell_price || '',
                    sum_merge:   item.sum_merge || '',
                    can_sell:    (item.can_sell || '').toUpperCase(),
                    energy:      energyInfo ? energyInfo.energy : '',
                    energyGenType: energyInfo ? energyInfo.genType : '',
                });
            });
        });

        setText('merge-total-count', allRows.length.toLocaleString());

        // Type filter
        const types = [...new Set(allRows.map(r => r.type).filter(Boolean))].sort();
        fillSelect('merge-filter-type', types);

        let filtered = [...allRows];
        let sortKey = 'chain';
        let sortAsc = true;

        function render() {
            // Apply filter
            const search = ($('merge-search')?.value || '').toLowerCase().trim();
            const typeF  = $('merge-filter-type')?.value || '';
            const srcF   = $('merge-filter-src')?.value || '';

            filtered = allRows.filter(r => {
                if (typeF && r.type        !== typeF)        return false;
                if (srcF  && r.sourceLabel !== srcF)         return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });

            // Sort
            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));

            setText('merge-result-count', filtered.length.toLocaleString() + ' items');

            const tbody = $('merge-body');
            if (!tbody) return;
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2rem;">Không tìm thấy item nào.</td></tr>`;
                return;
            }
            tbody.innerHTML = filtered.slice(0, 2000).map(r => {
                const srcBadge = badge(r.sourceLabel, r.color + '22', r.color + '88', r.color);
                const canSell  = r.can_sell === 'TRUE' ? `<span style="color:var(--success)">✓</span>` : `<span style="color:var(--danger)">✗</span>`;
                const energyCell = r.energy !== ''
                    ? `<span class="mono" style="color:var(--energy)">${r.energy} ⚡</span><br><span style="font-size:0.72rem;color:var(--text-muted)">${r.energyGenType}</span>`
                    : `<span style="color:var(--text-muted);font-size:0.8rem;">—</span>`;
                return `<tr>
                    <td>${srcBadge}</td>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${r.chain}</td>
                    <td style="color:var(--accent)">${r.type}</td>
                    <td class="mono" style="color:var(--energy)">${r.id}</td>
                    <td>${r.name}</td>
                    <td class="mono" style="color:var(--text-muted)">${r.merge_to}</td>
                    <td class="mono">${r.sell_price}</td>
                    <td class="mono">${r.sum_merge}</td>
                    <td>${energyCell}</td>
                    <td style="text-align:center">${canSell}</td>
                </tr>`;
            }).join('');
        }

        // Sort headers
        document.querySelectorAll('#merge-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                sortAsc = (sortKey === key) ? !sortAsc : true;
                sortKey = key;
                render();
            });
        });

        ['merge-search', 'merge-filter-type', 'merge-filter-src'].forEach(id => {
            $(id)?.addEventListener('input',  render);
            $(id)?.addEventListener('change', render);
        });

        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 2: GENERATORS
    // ═════════════════════════════════════════════════════════════════════════

    function initGenerators() {
        const data = window.GameData;

        // Map generator id → chi tiết từ RateGenerator (gom tất cả item_id nó spawn)
        // Per generator row: { type, id, cost_energy, time_cooldown, items: [{item_id, rate, item_type}] }
        const genMap = {}; // key: type+'_'+id
        (data.rateGenerator || []).forEach(row => {
            const key = row.type + '_' + row.id;
            if (!genMap[key]) {
                genMap[key] = {
                    type:         row.type,
                    id:           row.id,
                    cost_energy:  row.cost_energy || '',
                    time_cooldown:row.time_cooldown || '',
                    min_count:    row.min_count || '',
                    max_count:    row.max_count || '',
                    items: [],
                };
            }
            if (row.item_id) {
                genMap[key].items.push({
                    item_id:   row.item_id,
                    rate:      row.rate || '',
                    item_type: row.item_type || '',
                });
            }
        });

        // Join với itemGenerator để lấy name
        const nameMap = {}; // id → name
        (data.itemGenerator || []).forEach(r => { if (r.id) nameMap[r.id] = r.name_item || ''; });

        const allRows = Object.values(genMap);
        setText('gen-total-count', allRows.length.toLocaleString());

        // Type filter
        const types = [...new Set(allRows.map(r => r.type).filter(Boolean))].sort();
        fillSelect('gen-filter-type', types);

        let sortKey = 'id';
        let sortAsc = true;

        function render() {
            const search = ($('gen-search')?.value || '').toLowerCase().trim();
            const typeF  = $('gen-filter-type')?.value || '';

            let filtered = allRows.filter(r => {
                if (typeF && r.type !== typeF) return false;
                const name = nameMap[r.id] || '';
                if (search && !name.toLowerCase().includes(search) && !r.id.includes(search) && !r.type.toLowerCase().includes(search)) return false;
                return true;
            });

            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('gen-result-count', filtered.length.toLocaleString() + ' generators');

            const tbody = $('gen-body');
            if (!tbody) return;
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Không tìm thấy.</td></tr>`;
                return;
            }
            tbody.innerHTML = filtered.map(r => {
                const name = nameMap[r.id] || '—';
                const spawnList = r.items.map(it =>
                    `<span class="mono" style="color:var(--energy)">${it.item_id}</span>`
                    + (it.rate ? `<span style="color:var(--text-muted);font-size:0.75rem"> ${it.rate}%</span>` : '')
                ).join(' · ');
                const timeSec = r.time_cooldown ? Math.round(r.time_cooldown) : '';
                const timeDisplay = timeSec ? formatTime(timeSec) : '—';
                return `<tr>
                    <td style="color:var(--accent)">${r.type}</td>
                    <td class="mono" style="color:var(--energy)">${r.id}</td>
                    <td>${name}</td>
                    <td class="mono" style="color:var(--energy)">${r.cost_energy !== '' ? r.cost_energy + ' ⚡' : '—'}</td>
                    <td class="mono">${timeDisplay}</td>
                    <td class="mono" style="color:var(--text-muted)">${r.min_count}–${r.max_count}</td>
                    <td style="font-size:0.82rem">${spawnList}</td>
                </tr>`;
            }).join('');
        }

        document.querySelectorAll('#gen-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                sortAsc = (sortKey === key) ? !sortAsc : true;
                sortKey = key;
                render();
            });
        });

        ['gen-search', 'gen-filter-type'].forEach(id => {
            $(id)?.addEventListener('input',  render);
            $(id)?.addEventListener('change', render);
        });

        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 3: RECIPES
    // ═════════════════════════════════════════════════════════════════════════

    function initRecipes() {
        const data = window.GameData;

        // Build set của ResultType_ResultId đã có formula
        const formulaSet = new Set(
            (data.formuaRecipes || []).map(r => (r['ResultType'] || '') + '_' + (r['ResultId'] || ''))
        );

        // Map formula theo resultType+resultId để join khi hiển thị
        const formulaMap = {};
        (data.formuaRecipes || []).forEach(r => {
            const key = (r['ResultType'] || '') + '_' + (r['ResultId'] || '');
            formulaMap[key] = {
                tool:     r['TypeTool'] || '',
                time:     r['TimeToCook(sec)'] || '',
                ing1Type: r['Ingredient1Type'] || '',
                ing1Id:   r['Ingredient1Id'] || '',
                ing2Type: r['Ingredient2Type'] || '',
                ing2Id:   r['Ingredient2Id'] || '',
                ing3Type: r['Ingredient3Type'] || '',
                ing3Id:   r['Ingredient3Id'] || '',
            };
        });

        // Tất cả ItemFood — mỗi row là 1 food item, có thêm cờ hasRecipe
        let chain = 0;
        let lastType = '';
        const allRows = (data.itemFood || []).map(item => {
            if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
            const key = (item.type || '') + '_' + (item.id || '');
            const hasRecipe = formulaSet.has(key);
            const formula   = hasRecipe ? formulaMap[key] : null;
            return {
                chain,
                type:       item.type || '',
                id:         item.id || '',
                name:       item.name_item || '',
                sell_price: item.sell_price || '',
                hasRecipe,
                tool:       formula?.tool     || '',
                time:       formula?.time     || '',
                ing1Type:   formula?.ing1Type || '',
                ing1Id:     formula?.ing1Id   || '',
                ing2Type:   formula?.ing2Type || '',
                ing2Id:     formula?.ing2Id   || '',
                ing3Type:   formula?.ing3Type || '',
                ing3Id:     formula?.ing3Id   || '',
            };
        });

        const activeCount  = allRows.filter(r => r.hasRecipe).length;
        const missingCount = allRows.filter(r => !r.hasRecipe).length;

        // Stats
        setText('recipe-stat-active',  activeCount.toLocaleString());
        setText('recipe-stat-missing', missingCount.toLocaleString());
        setText('recipe-stat-total',   allRows.length.toLocaleString());
        setText('recipe-total-count',  allRows.length.toLocaleString());

        // Filters
        const tools = [...new Set(allRows.map(r => r.tool).filter(Boolean))].sort();
        const types = [...new Set(allRows.map(r => r.type).filter(Boolean))].sort();
        fillSelect('recipe-filter-tool', tools);
        fillSelect('recipe-filter-type', types);

        let sortKey = 'chain';
        let sortAsc = true;

        function render() {
            const search   = ($('recipe-search')?.value || '').toLowerCase().trim();
            const toolF    = $('recipe-filter-tool')?.value || '';
            const typeF    = $('recipe-filter-type')?.value || '';
            const statusF  = $('recipe-filter-status')?.value || '';

            let filtered = allRows.filter(r => {
                if (toolF   && r.tool !== toolF)      return false;
                if (typeF   && r.type !== typeF)       return false;
                if (statusF === 'active'  && !r.hasRecipe) return false;
                if (statusF === 'missing' &&  r.hasRecipe) return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });

            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('recipe-result-count', filtered.length.toLocaleString() + ' items');

            const tbody = $('recipe-body');
            if (!tbody) return;
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Không tìm thấy.</td></tr>`;
                return;
            }

            const makeIng = (type, id) => (type || id)
                ? `<span style="color:var(--accent);font-size:0.78rem">${type}</span> <span class="mono" style="color:var(--energy);font-size:0.78rem">${id}</span>`
                : '';

            tbody.innerHTML = filtered.map(r => {
                const statusBadge = r.hasRecipe
                    ? badge('✓ Active',  'rgba(34,197,94,0.12)',  '#22c55e88', '#4ade80')
                    : badge('✗ Missing', 'rgba(239,68,68,0.12)',  '#ef444488', '#f87171');

                const toolBadge = r.tool
                    ? badge(r.tool, 'rgba(99,102,241,0.15)', '#6366f188', '#818cf8')
                    : '—';

                const timeDisplay = r.time ? formatTime(parseFloat(r.time)) : '—';

                const ings = [makeIng(r.ing1Type, r.ing1Id), makeIng(r.ing2Type, r.ing2Id), makeIng(r.ing3Type, r.ing3Id)]
                    .filter(Boolean)
                    .map(s => `<div style="white-space:nowrap;margin-bottom:2px">${s}</div>`)
                    .join('') || '—';

                const rowStyle = r.hasRecipe ? '' : 'opacity:0.6;';
                return `<tr style="${rowStyle}">
                    <td>${statusBadge}</td>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${r.chain}</td>
                    <td style="color:var(--accent)">${r.type}</td>
                    <td class="mono" style="color:var(--energy)">${r.id}</td>
                    <td>${r.name}</td>
                    <td class="mono">${r.sell_price}</td>
                    <td>${toolBadge}</td>
                    <td class="mono" style="color:var(--gold)">${timeDisplay}</td>
                    <td style="font-size:0.82rem">${ings}</td>
                </tr>`;
            }).join('');
        }

        document.querySelectorAll('#recipe-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                sortAsc = (sortKey === key) ? !sortAsc : true;
                sortKey = key;
                render();
            });
        });

        ['recipe-search', 'recipe-filter-tool', 'recipe-filter-type', 'recipe-filter-status'].forEach(id => {
            $(id)?.addEventListener('input',  render);
            $(id)?.addEventListener('change', render);
        });

        // Click vào stat card để filter nhanh
        $('recipe-stat-active-card')?.addEventListener('click', () => {
            $('recipe-filter-status').value = 'active';
            render();
        });
        $('recipe-stat-missing-card')?.addEventListener('click', () => {
            $('recipe-filter-status').value = 'missing';
            render();
        });

        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 4: OTHER ITEMS
    // ═════════════════════════════════════════════════════════════════════════

    const OTHER_SOURCES = [
        { key: 'itemFood',     label: 'Food',     color: '#4ade80' },
        { key: 'itemBooster',  label: 'Booster',  color: '#f472b6' },
        { key: 'itemChest',    label: 'Chest',    color: '#fbbf24' },
        { key: 'itemCurrency', label: 'Currency', color: '#34d399' },
        { key: 'itemTool',     label: 'Tool',     color: '#94a3b8' },
    ];

    function initOther() {
        const data = window.GameData;
        const allRows = [];

        OTHER_SOURCES.forEach(({ key, label, color }) => {
            let chain = 0;
            let lastType = '';
            (data[key] || []).forEach(item => {
                if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
                allRows.push({
                    sourceLabel: label, color, chain,
                    type:       item.type || '',
                    id:         item.id || '',
                    name:       item.name_item || '',
                    merge_to:   item.merge_to || '',
                    sell_price: item.sell_price || '',
                    sum_merge:  item.sum_merge || '',
                    can_sell:   (item.can_sell || '').toUpperCase(),
                });
            });
        });

        setText('other-total-count', allRows.length.toLocaleString());

        const types = [...new Set(allRows.map(r => r.type).filter(Boolean))].sort();
        fillSelect('other-filter-type', types);

        let sortKey = 'sourceLabel';
        let sortAsc = true;

        function render() {
            const search = ($('other-search')?.value || '').toLowerCase().trim();
            const srcF   = $('other-filter-src')?.value || '';
            const typeF  = $('other-filter-type')?.value || '';

            let filtered = allRows.filter(r => {
                if (srcF  && r.sourceLabel !== srcF) return false;
                if (typeF && r.type        !== typeF) return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });

            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('other-result-count', filtered.length.toLocaleString() + ' items');

            const tbody = $('other-body');
            if (!tbody) return;
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2rem;">Không tìm thấy.</td></tr>`;
                return;
            }
            tbody.innerHTML = filtered.slice(0, 2000).map(r => {
                const srcBadge = badge(r.sourceLabel, r.color + '22', r.color + '88', r.color);
                const canSell  = r.can_sell === 'TRUE'
                    ? `<span style="color:var(--success)">✓</span>`
                    : r.can_sell ? `<span style="color:var(--danger)">✗</span>` : '';
                return `<tr>
                    <td>${srcBadge}</td>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${r.chain}</td>
                    <td style="color:var(--accent)">${r.type}</td>
                    <td class="mono" style="color:var(--energy)">${r.id}</td>
                    <td>${r.name}</td>
                    <td class="mono" style="color:var(--text-muted)">${r.merge_to}</td>
                    <td class="mono">${r.sell_price}</td>
                    <td class="mono">${r.sum_merge}</td>
                    <td style="text-align:center">${canSell}</td>
                </tr>`;
            }).join('');
        }

        document.querySelectorAll('#other-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                sortAsc = (sortKey === key) ? !sortAsc : true;
                sortKey = key;
                render();
            });
        });

        ['other-search', 'other-filter-src', 'other-filter-type'].forEach(id => {
            $(id)?.addEventListener('input',  render);
            $(id)?.addEventListener('change', render);
        });

        render();
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    function sortByKey(a, b, key, asc) {
        const numericKeys = new Set(['id', 'merge_to', 'sell_price', 'sum_merge', 'chain', 'energy', 'time', 'cost_energy']);
        let va = a[key] ?? '';
        let vb = b[key] ?? '';
        if (numericKeys.has(key)) {
            va = parseFloat(va) || 0;
            vb = parseFloat(vb) || 0;
            return asc ? va - vb : vb - va;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    }

    function formatTime(sec) {
        sec = Math.round(sec);
        if (sec < 60)   return sec + 's';
        if (sec < 3600) return Math.round(sec / 60) + 'm';
        if (sec < 86400)return (sec / 3600).toFixed(1) + 'h';
        return (sec / 86400).toFixed(1) + 'd';
    }

    function fillSelect(id, values) {
        const sel = $(id);
        if (!sel) return;
        while (sel.options.length > 1) sel.remove(1);
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        });
    }

    // ── Stats tổng ────────────────────────────────────────────────────────────

    function updateGlobalStats() {
        const d = window.GameData;
        const mergeCount = (d.itemRaw?.length || 0);
        const genCount   = Object.keys(
            (d.rateGenerator || []).reduce((acc, r) => { if (r.type && r.id) acc[r.type+'_'+r.id] = 1; return acc; }, {})
        ).length;
        const recipeCount = (d.itemFood?.length || 0);
        const otherCount  = OTHER_SOURCES.reduce((s, { key }) => s + (d[key]?.length || 0), 0);

        setText('stat-merge',     mergeCount.toLocaleString());
        setText('stat-generator', genCount.toLocaleString());
        setText('stat-recipe',    recipeCount.toLocaleString());
        setText('stat-other',     otherCount.toLocaleString());

        // Status bar
        const statusEl = $('data-status');
        if (statusEl) {
            const total = mergeCount + genCount + recipeCount + otherCount;
            statusEl.textContent = total > 0 ? `✓ Data loaded` : '⚠ Chạy generate_data.py';
            statusEl.style.color = total > 0 ? 'var(--success)' : 'var(--warning)';
        }
    }

    // ── Public init ───────────────────────────────────────────────────────────

    function init() {
        if (!window.GameData) {
            console.error('[ItemEncyclopedia] window.GameData không tồn tại. Chạy: python generate_data.py');
            const statusEl = $('data-status');
            if (statusEl) { statusEl.textContent = '⚠ Không có data — chạy generate_data.py'; statusEl.style.color = 'var(--warning)'; }
            return;
        }
        initSubTabs();
        updateGlobalStats();
        initMergeItems();
        initGenerators();
        initRecipes();
        initOther();
    }

    return { init };
})();
