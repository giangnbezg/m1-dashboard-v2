/**
 * itemEncyclopedia.js — Tab: Item Encyclopedia
 *
 * Performance: mỗi row pre-render HTML một lần khi init.
 * render() chỉ filter index + join chuỗi đã cache — không tạo DOM mới.
 *
 * Sub-tabs:
 *   1. Merge Items   — itemRaw + energy cost từ RateGenerator
 *   2. Generators    — rateGenerator (join itemGenerator để lấy tên)
 *   3. Recipes       — itemFood × formuaRecipes (active / missing)
 *   4. Tool          — itemTool
 *   5. Other         — itemFood, itemBooster, itemChest, itemCurrency
 */

const ItemEncyclopedia = (() => {

    // ── Helpers ───────────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }
    function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

    function badge(text, bg, border, color) {
        return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:500;background:${bg};border:1px solid ${border};color:${color};">${text}</span>`;
    }

    function formatTime(sec) {
        sec = Math.round(parseFloat(sec) || 0);
        if (!sec)        return '—';
        if (sec < 60)    return sec + 's';
        if (sec < 3600)  return Math.round(sec / 60) + 'm';
        if (sec < 86400) return (sec / 3600).toFixed(1) + 'h';
        return (sec / 86400).toFixed(1) + 'd';
    }

    function fillSelect(id, values) {
        const sel = $(id);
        if (!sel) return;
        while (sel.options.length > 1) sel.remove(1);
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = v;
            sel.appendChild(opt);
        });
    }

    function sortByKey(a, b, key, asc) {
        const NUMERIC = new Set(['id','merge_to','sell_price','sum_merge','chain','energy','time','cost_energy','time_cooldown']);
        let va = a[key] ?? '', vb = b[key] ?? '';
        if (NUMERIC.has(key)) {
            va = parseFloat(va) || 0; vb = parseFloat(vb) || 0;
            return asc ? va - vb : vb - va;
        }
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    }

    // Render tbody từ mảng rows đã có .html cache, giới hạn MAX rows
    const MAX_ROWS = 2000;
    function renderRows(tbodyId, rows, colSpan) {
        const tbody = $(tbodyId);
        if (!tbody) return;
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--text-muted);padding:2rem;">Không tìm thấy.</td></tr>`;
            return;
        }
        const slice = rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;
        let html = slice.map(r => r.html).join('');
        if (rows.length > MAX_ROWS)
            html += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:0.6rem;">... và ${(rows.length - MAX_ROWS).toLocaleString()} items nữa — thu hẹp bộ lọc.</td></tr>`;
        tbody.innerHTML = html;
    }

    // Sub-tab navigation
    function initSubTabs() {
        document.querySelectorAll('.encyc-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.encyc-sub-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.encyc-subtab-content').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(btn.getAttribute('data-subtab'));
                if (panel) panel.classList.add('active');
            });
        });
    }

    // Sort header helper — gắn event và cập nhật ký hiệu ↑↓
    function bindSort(tableId, getSortState, setSortState, renderFn) {
        document.querySelectorAll(`#${tableId} thead th[data-sort]`).forEach(th => {
            th.addEventListener('click', () => {
                const { key, asc } = getSortState();
                const newKey = th.getAttribute('data-sort');
                const newAsc = (key === newKey) ? !asc : true;
                setSortState(newKey, newAsc);
                // Cập nhật indicator
                document.querySelectorAll(`#${tableId} thead th[data-sort]`).forEach(h => {
                    h.textContent = h.textContent.replace(/ [↑↓]$/, '');
                });
                th.textContent += newAsc ? ' ↑' : ' ↓';
                renderFn();
            });
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 1: MERGE ITEMS (itemRaw)
    // ═════════════════════════════════════════════════════════════════════════

    function initMergeItems() {
        const data = window.GameData;

        // energy cost: lấy generator cấp thấp nhất (id nhỏ nhất) spawn ra item đó
        const energyMap = {};
        (data.rateGenerator || []).forEach(row => {
            if (!row.item_id || !row.cost_energy) return;
            const itemId = row.item_id.trim();
            const genId  = parseInt(row.id) || 0;
            if (!energyMap[itemId] || genId < energyMap[itemId].genId)
                energyMap[itemId] = { energy: parseFloat(row.cost_energy), genId, genType: row.type };
        });

        let chain = 0, lastType = '';
        const allRows = (data.itemRaw || []).map(item => {
            if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
            const ei = energyMap[item.id] || null;
            const energyCell = ei
                ? `<span class="mono" style="color:var(--energy)">${ei.energy} ⚡</span><br><span style="font-size:0.72rem;color:var(--text-muted)">${ei.genType}</span>`
                : `<span style="color:var(--text-muted)">—</span>`;
            const canSell = (item.can_sell || '').toUpperCase() === 'TRUE'
                ? `<span style="color:var(--success)">✓</span>`
                : `<span style="color:var(--danger)">✗</span>`;
            return {
                chain, type: item.type || '', id: item.id || '',
                name: item.name_item || '', merge_to: item.merge_to || '',
                sell_price: item.sell_price || '', sum_merge: item.sum_merge || '',
                energy: ei ? ei.energy : '',
                html: `<tr>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${chain}</td>
                    <td style="color:var(--accent)">${item.type || ''}</td>
                    <td class="mono" style="color:var(--energy)">${item.id || ''}</td>
                    <td>${item.name_item || ''}</td>
                    <td class="mono" style="color:var(--text-muted)">${item.merge_to || ''}</td>
                    <td class="mono">${item.sell_price || ''}</td>
                    <td class="mono">${item.sum_merge || ''}</td>
                    <td>${energyCell}</td>
                    <td style="text-align:center">${canSell}</td>
                </tr>`,
            };
        });

        setText('merge-total-count', allRows.length.toLocaleString());
        fillSelect('merge-filter-type', [...new Set(allRows.map(r => r.type).filter(Boolean))].sort());

        let sortKey = 'chain', sortAsc = true;

        function render() {
            const search = ($('merge-search')?.value || '').toLowerCase().trim();
            const typeF  = $('merge-filter-type')?.value || '';

            let filtered = allRows.filter(r => {
                if (typeF && r.type !== typeF) return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });
            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('merge-result-count', filtered.length.toLocaleString() + ' items');
            renderRows('merge-body', filtered, 9);
        }

        bindSort('merge-table', () => ({ key: sortKey, asc: sortAsc }), (k, a) => { sortKey = k; sortAsc = a; }, render);
        ['merge-search', 'merge-filter-type'].forEach(id => {
            $(id)?.addEventListener('input', render);
            $(id)?.addEventListener('change', render);
        });
        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 2: GENERATORS
    // ═════════════════════════════════════════════════════════════════════════

    function initGenerators() {
        const data = window.GameData;

        const genMap = {};
        (data.rateGenerator || []).forEach(row => {
            const key = row.type + '_' + row.id;
            if (!genMap[key]) genMap[key] = {
                type: row.type, id: row.id,
                cost_energy: row.cost_energy || '', time_cooldown: row.time_cooldown || '',
                min_count: row.min_count || '', max_count: row.max_count || '',
                items: [],
            };
            if (row.item_id) genMap[key].items.push({ item_id: row.item_id, rate: row.rate || '' });
        });

        const nameMap = {};
        (data.itemGenerator || []).forEach(r => { if (r.id) nameMap[r.id] = r.name_item || ''; });

        const allRows = Object.values(genMap).map(r => {
            const name = nameMap[r.id] || '—';
            const spawnList = r.items.map(it =>
                `<span class="mono" style="color:var(--energy)">${it.item_id}</span>`
                + (it.rate ? `<span style="color:var(--text-muted);font-size:0.75rem"> ${it.rate}%</span>` : '')
            ).join(' · ');
            return {
                type: r.type, id: r.id, cost_energy: r.cost_energy, time_cooldown: r.time_cooldown,
                html: `<tr>
                    <td style="color:var(--accent)">${r.type}</td>
                    <td class="mono" style="color:var(--energy)">${r.id}</td>
                    <td>${name}</td>
                    <td class="mono" style="color:var(--energy)">${r.cost_energy !== '' ? r.cost_energy + ' ⚡' : '—'}</td>
                    <td class="mono">${formatTime(r.time_cooldown)}</td>
                    <td class="mono" style="color:var(--text-muted)">${r.min_count}–${r.max_count}</td>
                    <td style="font-size:0.82rem">${spawnList}</td>
                </tr>`,
            };
        });

        setText('gen-total-count', allRows.length.toLocaleString());
        fillSelect('gen-filter-type', [...new Set(allRows.map(r => r.type).filter(Boolean))].sort());

        let sortKey = 'id', sortAsc = true;

        function render() {
            const search = ($('gen-search')?.value || '').toLowerCase().trim();
            const typeF  = $('gen-filter-type')?.value || '';
            let filtered = allRows.filter(r => {
                if (typeF && r.type !== typeF) return false;
                if (search && !r.type.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });
            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('gen-result-count', filtered.length.toLocaleString() + ' generators');
            renderRows('gen-body', filtered, 7);
        }

        bindSort('gen-table', () => ({ key: sortKey, asc: sortAsc }), (k, a) => { sortKey = k; sortAsc = a; }, render);
        ['gen-search', 'gen-filter-type'].forEach(id => {
            $(id)?.addEventListener('input', render);
            $(id)?.addEventListener('change', render);
        });
        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 3: RECIPES (itemFood × formuaRecipes)
    // ═════════════════════════════════════════════════════════════════════════

    function initRecipes() {
        const data = window.GameData;

        const formulaMap = {};
        (data.formuaRecipes || []).forEach(r => {
            const key = (r['ResultType'] || '') + '_' + (r['ResultId'] || '');
            formulaMap[key] = {
                tool:     r['TypeTool'] || '',
                time:     r['TimeToCook(sec)'] || '',
                ing1Type: r['Ingredient1Type'] || '', ing1Id: r['Ingredient1Id'] || '',
                ing2Type: r['Ingredient2Type'] || '', ing2Id: r['Ingredient2Id'] || '',
                ing3Type: r['Ingredient3Type'] || '', ing3Id: r['Ingredient3Id'] || '',
            };
        });

        const makeIng = (type, id) => (type || id)
            ? `<div style="white-space:nowrap"><span style="color:var(--accent);font-size:0.78rem">${type}</span> <span class="mono" style="color:var(--energy);font-size:0.78rem">${id}</span></div>`
            : '';

        let chain = 0, lastType = '';
        const allRows = (data.itemFood || []).map(item => {
            if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
            const key = (item.type || '') + '_' + (item.id || '');
            const f   = formulaMap[key] || null;
            const hasRecipe = !!f;

            const statusBadge = hasRecipe
                ? badge('✓ Active',  'rgba(34,197,94,0.12)',  '#22c55e88', '#4ade80')
                : badge('✗ Missing', 'rgba(239,68,68,0.12)',  '#ef444488', '#f87171');

            const toolBadge = f?.tool
                ? badge(f.tool, 'rgba(99,102,241,0.15)', '#6366f188', '#818cf8')
                : '—';

            const ings = f
                ? [makeIng(f.ing1Type, f.ing1Id), makeIng(f.ing2Type, f.ing2Id), makeIng(f.ing3Type, f.ing3Id)].filter(Boolean).join('') || '—'
                : '—';

            return {
                chain, type: item.type || '', id: item.id || '',
                name: item.name_item || '', sell_price: item.sell_price || '',
                tool: f?.tool || '', time: f?.time || '',
                hasRecipe,
                html: `<tr style="${hasRecipe ? '' : 'opacity:0.55;'}">
                    <td>${statusBadge}</td>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${chain}</td>
                    <td style="color:var(--accent)">${item.type || ''}</td>
                    <td class="mono" style="color:var(--energy)">${item.id || ''}</td>
                    <td>${item.name_item || ''}</td>
                    <td class="mono">${item.sell_price || ''}</td>
                    <td>${toolBadge}</td>
                    <td class="mono" style="color:var(--gold)">${formatTime(f?.time)}</td>
                    <td style="font-size:0.82rem">${ings}</td>
                </tr>`,
            };
        });

        const activeCount  = allRows.filter(r => r.hasRecipe).length;
        const missingCount = allRows.length - activeCount;

        setText('recipe-stat-active',  activeCount.toLocaleString());
        setText('recipe-stat-missing', missingCount.toLocaleString());
        setText('recipe-stat-total',   allRows.length.toLocaleString());
        setText('recipe-total-count',  allRows.length.toLocaleString());

        fillSelect('recipe-filter-tool', [...new Set(allRows.map(r => r.tool).filter(Boolean))].sort());
        fillSelect('recipe-filter-type', [...new Set(allRows.map(r => r.type).filter(Boolean))].sort());

        let sortKey = 'chain', sortAsc = true;

        function render() {
            const search  = ($('recipe-search')?.value || '').toLowerCase().trim();
            const toolF   = $('recipe-filter-tool')?.value || '';
            const typeF   = $('recipe-filter-type')?.value || '';
            const statusF = $('recipe-filter-status')?.value || '';

            let filtered = allRows.filter(r => {
                if (toolF   && r.tool !== toolF)                       return false;
                if (typeF   && r.type !== typeF)                       return false;
                if (statusF === 'active'  && !r.hasRecipe)             return false;
                if (statusF === 'missing' &&  r.hasRecipe)             return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });
            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('recipe-result-count', filtered.length.toLocaleString() + ' items');
            renderRows('recipe-body', filtered, 9);
        }

        bindSort('recipe-table', () => ({ key: sortKey, asc: sortAsc }), (k, a) => { sortKey = k; sortAsc = a; }, render);
        ['recipe-search', 'recipe-filter-tool', 'recipe-filter-type', 'recipe-filter-status'].forEach(id => {
            $(id)?.addEventListener('input', render);
            $(id)?.addEventListener('change', render);
        });

        $('recipe-stat-active-card')?.addEventListener('click', () => {
            $('recipe-filter-status').value = 'active'; render();
        });
        $('recipe-stat-missing-card')?.addEventListener('click', () => {
            $('recipe-filter-status').value = 'missing'; render();
        });

        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 4: TOOL (itemTool)
    // ═════════════════════════════════════════════════════════════════════════

    function initTool() {
        const data = window.GameData;

        let chain = 0, lastType = '';
        const allRows = (data.itemTool || []).map(item => {
            if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
            const canSell = (item.can_sell || '').toUpperCase() === 'TRUE'
                ? `<span style="color:var(--success)">✓</span>`
                : `<span style="color:var(--danger)">✗</span>`;
            return {
                chain, type: item.type || '', id: item.id || '',
                name: item.name_item || '', merge_to: item.merge_to || '',
                sell_price: item.sell_price || '', sum_merge: item.sum_merge || '',
                html: `<tr>
                    <td class="mono" style="color:var(--text-muted);text-align:center">${chain}</td>
                    <td style="color:var(--accent)">${item.type || ''}</td>
                    <td class="mono" style="color:var(--energy)">${item.id || ''}</td>
                    <td>${item.name_item || ''}</td>
                    <td class="mono" style="color:var(--text-muted)">${item.merge_to || ''}</td>
                    <td class="mono">${item.sell_price || ''}</td>
                    <td class="mono">${item.sum_merge || ''}</td>
                    <td style="text-align:center">${canSell}</td>
                </tr>`,
            };
        });

        setText('tool-total-count', allRows.length.toLocaleString());
        fillSelect('tool-filter-type', [...new Set(allRows.map(r => r.type).filter(Boolean))].sort());

        let sortKey = 'chain', sortAsc = true;

        function render() {
            const search = ($('tool-search')?.value || '').toLowerCase().trim();
            const typeF  = $('tool-filter-type')?.value || '';

            let filtered = allRows.filter(r => {
                if (typeF && r.type !== typeF) return false;
                if (search && !r.name.toLowerCase().includes(search) && !r.id.includes(search)) return false;
                return true;
            });
            filtered.sort((a, b) => sortByKey(a, b, sortKey, sortAsc));
            setText('tool-result-count', filtered.length.toLocaleString() + ' items');
            renderRows('tool-body', filtered, 8);
        }

        bindSort('tool-table', () => ({ key: sortKey, asc: sortAsc }), (k, a) => { sortKey = k; sortAsc = a; }, render);
        ['tool-search', 'tool-filter-type'].forEach(id => {
            $(id)?.addEventListener('input', render);
            $(id)?.addEventListener('change', render);
        });
        render();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUB-TAB 5: OTHER (Food, Booster, Chest, Currency)
    // ═════════════════════════════════════════════════════════════════════════

    const OTHER_SOURCES = [
        { key: 'itemFood',     label: 'Food',     color: '#4ade80' },
        { key: 'itemBooster',  label: 'Booster',  color: '#f472b6' },
        { key: 'itemChest',    label: 'Chest',    color: '#fbbf24' },
        { key: 'itemCurrency', label: 'Currency', color: '#34d399' },
    ];

    function initOther() {
        const data = window.GameData;
        const allRows = [];

        OTHER_SOURCES.forEach(({ key, label, color }) => {
            let chain = 0, lastType = '';
            const srcBadge = badge(label, color + '22', color + '88', color);
            (data[key] || []).forEach(item => {
                if (item.type && item.type !== lastType) { chain++; lastType = item.type; }
                const canSell = (item.can_sell || '').toUpperCase() === 'TRUE'
                    ? `<span style="color:var(--success)">✓</span>`
                    : (item.can_sell ? `<span style="color:var(--danger)">✗</span>` : '');
                allRows.push({
                    sourceLabel: label, color, chain,
                    type: item.type || '', id: item.id || '',
                    name: item.name_item || '', merge_to: item.merge_to || '',
                    sell_price: item.sell_price || '', sum_merge: item.sum_merge || '',
                    html: `<tr>
                        <td>${srcBadge}</td>
                        <td class="mono" style="color:var(--text-muted);text-align:center">${chain}</td>
                        <td style="color:var(--accent)">${item.type || ''}</td>
                        <td class="mono" style="color:var(--energy)">${item.id || ''}</td>
                        <td>${item.name_item || ''}</td>
                        <td class="mono" style="color:var(--text-muted)">${item.merge_to || ''}</td>
                        <td class="mono">${item.sell_price || ''}</td>
                        <td class="mono">${item.sum_merge || ''}</td>
                        <td style="text-align:center">${canSell}</td>
                    </tr>`,
                });
            });
        });

        setText('other-total-count', allRows.length.toLocaleString());
        fillSelect('other-filter-type', [...new Set(allRows.map(r => r.type).filter(Boolean))].sort());

        let sortKey = 'sourceLabel', sortAsc = true;

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
            renderRows('other-body', filtered, 9);
        }

        bindSort('other-table', () => ({ key: sortKey, asc: sortAsc }), (k, a) => { sortKey = k; sortAsc = a; }, render);
        ['other-search', 'other-filter-src', 'other-filter-type'].forEach(id => {
            $(id)?.addEventListener('input', render);
            $(id)?.addEventListener('change', render);
        });
        render();
    }

    // ── Global stats ──────────────────────────────────────────────────────────

    function updateGlobalStats() {
        const d = window.GameData;
        const genCount = Object.keys(
            (d.rateGenerator || []).reduce((acc, r) => { if (r.type && r.id) acc[r.type+'_'+r.id]=1; return acc; }, {})
        ).length;

        setText('stat-merge',     (d.itemRaw?.length || 0).toLocaleString());
        setText('stat-generator', genCount.toLocaleString());
        setText('stat-recipe',    (d.itemFood?.length || 0).toLocaleString());
        setText('stat-tool',      (d.itemTool?.length || 0).toLocaleString());
        setText('stat-other',     OTHER_SOURCES.reduce((s, { key }) => s + (d[key]?.length || 0), 0).toLocaleString());

        const statusEl = $('data-status');
        if (statusEl) {
            const ok = (d.itemRaw?.length || 0) > 0;
            statusEl.textContent = ok ? '✓ Data loaded' : '⚠ Chạy generate_data.py';
            statusEl.style.color = ok ? 'var(--success)' : 'var(--warning)';
        }
    }

    // ── Public ────────────────────────────────────────────────────────────────

    function init() {
        if (!window.GameData) {
            const el = $('data-status');
            if (el) { el.textContent = '⚠ Không có data — chạy generate_data.py'; el.style.color = 'var(--warning)'; }
            return;
        }
        initSubTabs();
        updateGlobalStats();
        initMergeItems();
        initGenerators();
        initRecipes();
        initTool();
        initOther();
    }

    return { init };
})();
