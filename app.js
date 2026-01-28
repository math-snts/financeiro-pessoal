// ======= Enhanced Helpers =======
const fmtBRL = (n, decimals = 2) => (n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
});

const parseN = (v) => {
    const num = Number(String(v).replace(',', '.').replace('R$', '').trim());
    return isNaN(num) ? 0 : num;
};

function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const today = () => parseLocalDate(todayStr());

const getPeriod = (dateStr) => {
    const d = parseLocalDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatDate = (dateStr) => parseLocalDate(dateStr).toLocaleDateString('pt-BR');

// ======= Enhanced State Management =======
let state = JSON.parse(localStorage.getItem('fin-state-pro') || '{}');
let currentPeriod = getPeriod(todayStr());
let onboardingStep = parseInt(localStorage.getItem('onboarding-step') || '0');
let onboardingCompleted = localStorage.getItem('onboarding-completed') === 'true';
let notaAtiva = null; // 🔥 VARIÁVEL CRÍTICA ADICIONADA
let notasRenderizadas = new Map();

// Initialize state with better defaults
if (!state.periodos) {
    state = {
        periodos: {},
        tipos: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outros'],
        metas: [],
        notas: [],
        stats: {
            firstUse: new Date().toISOString(),
            lastBackup: null
        }
    };
}

function ensurePeriod(p) {
    if (!state.periodos[p]) {
        state.periodos[p] = {
            rendas: [],
            despesas: [],
            cartoes: [],
            created: new Date().toISOString()
        };
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

let debounceSave = debounce(saveState, 500);

function saveState(autoSave = true) {
    try {
        localStorage.setItem('fin-state-pro', JSON.stringify(state));
        if (autoSave && !notaAtiva) return;

        if (state.stats.lastBackup !== getPeriod(todayStr())) {
            state.stats.lastBackup = getPeriod(todayStr());
        }
        renderAll();
    } catch (e) {
        console.error('Save error:', e);
    }
}

// ======= Enhanced Periods - Mês atual primeiro =======
function renderPeriods() {
    const currentPeriodText = document.getElementById('currentPeriodText');
    const periodList = document.getElementById('periodList');

    const periods = Object.keys(state.periodos);
    if (periods.length === 0) {
        currentPeriodText.textContent = 'Este mês';
        periodList.innerHTML = '<div class="period-option disabled">Nenhum período criado</div>';
        return;
    }

    // Ordena com mês atual primeiro, depois decrescente
    const sortedPeriods = periods.sort((a, b) => a.localeCompare(b));


    // Atualiza texto do período atual
    const [year, month] = currentPeriod.split('-');
    const currentPeriodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const currentMonthName = currentPeriodDate.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
    });
    currentPeriodText.textContent = currentMonthName;

    // Preenche lista de períodos
    periodList.innerHTML = '';

    sortedPeriods.forEach(period => {
        const periodData = state.periodos[period];
        if (periodData && (periodData.rendas.length > 0 || periodData.despesas.length > 0 || periodData.cartoes.length > 0) || period === currentPeriod) {
            const [year, month] = period.split('-');
            const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const monthName = periodDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const isCurrent = period === currentPeriod;

            const option = document.createElement('div');
            option.className = `period-option ${isCurrent ? 'current' : ''}`;
            option.innerHTML = `
            <i class="fas ${isCurrent ? 'fa-check-circle' : 'fa-calendar-alt'}"></i>
            ${monthName}
          `;
            option.onclick = () => {
                currentPeriod = period;
                renderPeriods();
                renderAll();
                closePeriodList();
            };
            periodList.appendChild(option);
        }
    });
}

function togglePeriodList() {
    const list = document.getElementById('periodList');
    list.classList.toggle('show');
}

function closePeriodList() {
    document.getElementById('periodList').classList.remove('show');
}

// Fecha lista ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.period-dropdown')) {
        closePeriodList();
    }
});

// ======= Onboarding System =======
function initOnboarding() {
    const welcomeScreen = document.getElementById('welcomeScreen');

    if (!onboardingCompleted && onboardingStep === 0) {
        welcomeScreen.style.display = 'block';
        // Não mostra nenhuma aba durante onboarding
        document.querySelectorAll('.tab').forEach(tab => tab.style.display = 'none');
        showWelcomeScreen();
    } else {
        welcomeScreen.style.display = 'none';
        // Mostra dashboard por padrão
        navigateToTab('dashboard');
    }
}

function showWelcomeScreen() {
    document.getElementById('startOnboarding').onclick = () => {
        nextOnboardingStep(1);
    };

    document.getElementById('skipOnboarding').onclick = () => {
        completeOnboarding();
    };
}

function nextOnboardingStep(step) {
    onboardingStep = step;
    localStorage.setItem('onboarding-step', step);

    const steps = ['step1', 'step2', 'step3'];
    steps.forEach((s, i) => {
        const stepEl = document.getElementById(s);
        if (i < step - 1) {
            stepEl.classList.add('completed');
        }
    });

    switch (step) {
        case 1:
            navigateToTab('renda');
            showGuidedInput('renda');
            break;
        case 2:
            navigateToTab('despesas');
            showGuidedInput('despesas');
            break;
        case 3:
            navigateToTab('metas');
            showGuidedInput('metas');
            break;
    }
}

function showGuidedInput(type) {
    let message, focusElement;

    switch (type) {
        case 'renda':
            message = 'Vamos começar! Adicione sua principal fonte de renda mensal.';
            focusElement = 'rendaNome';
            break;
        case 'despesas':
            message = 'Ótimo! Agora registre sua maior despesa fixa mensal.';
            focusElement = 'despNome';
            break;
        case 'metas':
            message = 'Por último, defina um objetivo financeiro para se motivar!';
            focusElement = 'metaDesc';
            break;
    }

    setTimeout(() => document.getElementById(focusElement)?.focus(), 500);
}

function completeOnboarding() {
    onboardingCompleted = true;
    onboardingStep = 0;
    localStorage.setItem('onboarding-completed', 'true');
    localStorage.setItem('onboarding-step', '0');

    document.getElementById('welcomeScreen').style.display = 'none';
    navigateToTab('dashboard');
}

function trackOnboardingProgress(action) {
    if (!onboardingCompleted) {
        switch (action) {
            case 'add-renda':
                if (onboardingStep === 1) nextOnboardingStep(2);
                break;
            case 'add-despesa':
                if (onboardingStep === 2) nextOnboardingStep(3);
                break;
            case 'add-meta':
                if (onboardingStep === 3) completeOnboarding();
                break;
        }
    }
}

// ======= Enhanced Renda - CORRIGIDO RECORRÊNCIA =======
document.getElementById('btnAddRenda').onclick = () => {
    const nome = document.getElementById('rendaNome').value.trim();
    const valor = parseN(document.getElementById('rendaValor').value);
    const data = document.getElementById('rendaData').value;
    const meses = parseInt(document.getElementById('rendaRecorrente').value);

    if (!nome || !valor || !data) {
        return;
    }

    if (valor <= 0) {
        return;
    }

    const p = getPeriod(data);
    ensurePeriod(p);

    const renda = {
        id: Date.now() + Math.random(),
        nome,
        valor,
        data: data,
        recorrente: meses > 0,
        categoria: 'Renda',
        tags: ['confirmado']
    };

    state.periodos[p].rendas.push(renda);
    currentPeriod = p;

    // CORREÇÃO: Criar rendas para os meses seguintes corretamente
    if (meses > 0) {
        let futureD = parseLocalDate(data);
        for (let i = 1; i <= meses; i++) {
            const newDate = new Date(futureD);
            newDate.setMonth(futureD.getMonth() + i);
            const futureData = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
            const futurePeriod = getPeriod(futureData);
            ensurePeriod(futurePeriod);

            state.periodos[futurePeriod].rendas.push({
                ...renda,
                id: Date.now() + Math.random() + i,
                data: futureData
            });
        }
    }

    // Clear form
    document.getElementById('rendaNome').value = '';
    document.getElementById('rendaValor').value = '';
    document.getElementById('rendaData').value = todayStr();
    document.getElementById('rendaRecorrente').value = '0';

    trackOnboardingProgress('add-renda');
    saveState(false);
};

function renderRenda() {
    ensurePeriod(currentPeriod);
    const tbody = document.querySelector('#tblRenda tbody');
    const emptyState = document.getElementById('emptyRenda');

    tbody.innerHTML = '';
    const rendas = state.periodos[currentPeriod].rendas || [];

    if (rendas.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    rendas
        .sort((a, b) => a.data.localeCompare(b.data))
        .forEach(renda => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';
            tr.innerHTML = `
            <td>
              <div class="tag income">
                <i class="fas fa-arrow-up"></i> ${renda.nome}
              </div>
            </td>
            <td>${formatDate(renda.data)}</td>
            <td class="text-right">${fmtBRL(renda.valor)}</td>
            <td class="text-right">
              <button class="btn ghost btn-small danger" onclick="deleteItem('renda', ${renda.id}, this)" title="Excluir">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
            tbody.appendChild(tr);
        });
}

// ======= Enhanced Tipos =======
function renderTipos() {
    const sel = document.getElementById('despTipo');
    sel.innerHTML = '<option value="">Selecione...</option>';

    state.tipos.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        sel.appendChild(option);
    });
}

document.getElementById('btnAddTipo').onclick = () => {
    const novoTipo = document.getElementById('novoTipo').value.trim();
    if (novoTipo && !state.tipos.includes(novoTipo)) {
        state.tipos.push(novoTipo);
        document.getElementById('novoTipo').value = '';
        saveState(false);
        renderTipos();
    } else if (novoTipo) { }
};

// ======= Enhanced Despesas - CORRIGIDO RECORRÊNCIA =======
document.getElementById('btnAddDesp').onclick = () => {
    const nome = document.getElementById('despNome').value.trim();
    const valor = parseN(document.getElementById('despValor').value);
    const data = document.getElementById('despData').value;
    const tipo = document.getElementById('despTipo').value;
    const meses = parseInt(document.getElementById('despRecorrente').value);

    if (!nome || !valor || !data || !tipo) {
        return;
    }

    if (valor <= 0) {
        return;
    }

    const p = getPeriod(data);
    ensurePeriod(p);

    const despesa = {
        id: Date.now() + Math.random(),
        nome,
        valor,
        data: data,
        tipo,
        recorrente: meses > 0,
        tags: ['pendente'],
        created: new Date().toISOString()
    };

    state.periodos[p].despesas.push(despesa);
    currentPeriod = p;

    // CORREÇÃO: Criar despesas para os meses seguintes corretamente
    if (meses > 0) {
        let futureD = parseLocalDate(data);
        for (let i = 1; i <= meses; i++) {
            const newDate = new Date(futureD);
            newDate.setMonth(futureD.getMonth() + i);
            const futureData = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
            const futurePeriod = getPeriod(futureData);
            ensurePeriod(futurePeriod);

            state.periodos[futurePeriod].despesas.push({
                ...despesa,
                id: Date.now() + Math.random() + i,
                data: futureData
            });
        }
    }

    // Clear form
    document.getElementById('despNome').value = '';
    document.getElementById('despValor').value = '';
    document.getElementById('despData').value = todayStr();
    document.getElementById('despRecorrente').value = '0';
    document.getElementById('despTipo').value = '';

    trackOnboardingProgress('add-despesa');
    saveState(false);
};

function renderDesp() {
    ensurePeriod(currentPeriod);
    const tbody = document.querySelector('#tblDesp tbody');
    const emptyState = document.getElementById('emptyDesp');

    tbody.innerHTML = '';
    const despesas = state.periodos[currentPeriod].despesas || [];

    if (despesas.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    despesas
        .sort((a, b) => a.data.localeCompare(b.data))
        .forEach(d => {
            const isOverdue = d.data < todayStr();
            const tr = document.createElement('tr');
            tr.className = isOverdue ? 'bg-red-50' : 'animate-fade-in';
            tr.innerHTML = `
            <td>
                <div class="tag expense">
                <i class="fas fa-arrow-down"></i> ${d.nome}
                </div>
            </td>
            <td class="text-right text-red-600">${fmtBRL(d.valor)}</td>
            <td>
                <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--text)'}">
                ${formatDate(d.data)}
                ${isOverdue ? '<i class="fas fa-exclamation-triangle" style="margin-left: 0.5rem; color: var(--danger);"></i>' : ''}
                </span>
            </td>
            <td><span class="tag" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-2); border-color: var(--accent-2);">${d.tipo}</span></td>
            <td class="text-right">
                <button class="btn ghost btn-small danger" onclick="deleteItem('despesa', ${d.id}, this)" title="Excluir">
                <i class="fas fa-trash"></i>
                </button>
            </td>
            `;

            tbody.appendChild(tr);
        });
}

// ======= Enhanced Cartões =======
document.getElementById('btnAddCC').onclick = () => {
    const nome = document.getElementById('ccNome').value.trim();
    const valor = parseN(document.getElementById('ccValor').value);
    const venc = document.getElementById('ccVenc').value;

    if (!nome || !valor || !venc) {
        return;
    }

    if (valor <= 0) {
        return;
    }

    const p = getPeriod(venc);
    ensurePeriod(p);

    const cartao = {
        id: Date.now() + Math.random(),
        nome,
        valor,
        venc: venc,
        tags: ['pendente'],
        created: new Date().toISOString()
    };

    state.periodos[p].cartoes.push(cartao);
    currentPeriod = p;

    // Clear form
    document.getElementById('ccNome').value = '';
    document.getElementById('ccValor').value = '';
    document.getElementById('ccVenc').value = todayStr();

    saveState(false);
};

function renderCC() {
    ensurePeriod(currentPeriod);
    const tbody = document.querySelector('#tblCC tbody');
    const emptyState = document.getElementById('emptyCC');

    tbody.innerHTML = '';
    const cartoes = state.periodos[currentPeriod].cartoes || [];

    if (cartoes.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    cartoes
        .sort((a, b) => a.venc.localeCompare(b.venc))
        .forEach(c => {
            const isOverdue = c.venc < todayStr();
            const tr = document.createElement('tr');
            tr.className = isOverdue ? 'bg-red-50' : 'animate-fade-in';
            tr.innerHTML = `
            <td>
              <div class="tag" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-2); border-color: var(--accent-2);">
                <i class="fas fa-credit-card"></i> ${c.nome}
              </div>
            </td>
            <td>
              <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--text)'}">
                ${formatDate(c.venc)}
                ${isOverdue ? '<i class="fas fa-exclamation-triangle" style="margin-left: 0.5rem; color: var(--danger);"></i>' : ''}
              </span>
            </td>
            <td class="text-right text-red-600">${fmtBRL(c.valor)}</td>
            <td class="text-right">
              <button class="btn ghost btn-small danger" onclick="deleteItem('cartao', ${c.id}, this)" title="Excluir">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
            tbody.appendChild(tr);
        });
}

// ======= Enhanced Dashboard - CORRIGIDO PRÓXIMOS VENCIMENTOS =======
function renderDashboard() {
    ensurePeriod(currentPeriod);
    const rendas = state.periodos[currentPeriod].rendas || [];
    const despesas = state.periodos[currentPeriod].despesas || [];
    const cartoes = state.periodos[currentPeriod].cartoes || [];

    const totalRendas = rendas.reduce((sum, r) => sum + r.valor, 0);
    const totalDespesas = despesas.reduce((sum, d) => sum + d.valor, 0);
    const totalCartoes = cartoes.reduce((sum, c) => sum + c.valor, 0);
    const saldo = totalRendas;
    const sobra = saldo - totalDespesas - totalCartoes;

    // Update KPIs
    document.getElementById('kpiSaldo').textContent = fmtBRL(saldo);
    document.getElementById('kpisomadiv').textContent = fmtBRL(totalDespesas + totalCartoes);
    document.getElementById('kpiSobra').textContent = fmtBRL(sobra);

    // Trend indicator
    const trendText = sobra > 500 ? 'Excelente!' : sobra > 0 ? 'Bom!' : '';
    const trendIcon = sobra > 500 ? 'fas fa-trophy' : sobra > 0 ? 'fas fa-smile' : 'fas fa-exclamation-triangle';
    document.getElementById('kpiTrendText').textContent = trendText;
    document.getElementById('kpiTrend').innerHTML = `<i class="${trendIcon}" style="color: ${sobra > 0 ? 'var(--success)' : 'var(--warn)'}"></i> <span>${trendText}</span>`;

    // CORREÇÃO: Próximo vencimento - buscar em todos os períodos futuros
    const eventos = [];

    // Buscar em todos os períodos a partir do atual
    const periodosFuturos = Object.keys(state.periodos)
        .filter(p => p >= currentPeriod)
        .sort();

    periodosFuturos.forEach(p => {
        const periodData = state.periodos[p];

        // Adicionar despesas
        (periodData.despesas || []).forEach(d => {
            eventos.push({
                data: d.data,
                nome: d.nome,
                tipo: 'despesa',
                periodo: p
            });
        });

        // Adicionar cartões
        (periodData.cartoes || []).forEach(c => {
            eventos.push({
                data: c.venc,
                nome: c.nome,
                tipo: 'cartao',
                periodo: p
            });
        });
    });

    // Filtrar apenas eventos futuros e ordenar
    const futuros = eventos.filter(e => e.data >= todayStr());
    futuros.sort((a, b) => a.data.localeCompare(b.data));

    const proximo = futuros.length > 0 ?
        `${formatDate(futuros[0].data)} - ${futuros[0].nome} (${futuros[0].tipo})` :
        'Nenhum vencimento futuro';

    document.getElementById('kpiVencimento').textContent = proximo;
}

// ======= Enhanced Metas =======
function addMeta() {
  const desc = document.getElementById('metaDesc').value.trim();
  const alvo = parseN(document.getElementById('metaValor').value);

  if (!desc || !alvo || alvo <= 0) return;

  const meta = {
    id: Date.now() + Math.random(),
    desc,
    alvo,
    acumulado: 0,
    created: new Date().toISOString(),
    tags: []
  };

  state.metas.push(meta);

  document.getElementById('metaDesc').value = '';
  document.getElementById('metaValor').value = '';

  saveState(false);
  renderMetas(); // 🔥 FORÇA UPDATE VISUAL
}

document.getElementById('btnAddMeta').onclick = addMeta;

function renderMetas() {
    const grid = document.getElementById('goalsGrid');
    const emptyState = document.getElementById('emptyMetas');

    grid.innerHTML = '';

    if (state.metas.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    state.metas.forEach(meta => {
        const progresso = meta.alvo > 0 ? (meta.acumulado / meta.alvo) * 100 : 0;
        const progressoFormatado = Math.min(100, Math.round(progresso));

        let corClasse = 'progress-red';
        if (progresso > 75) corClasse = 'progress-gold';
        else if (progresso > 50) corClasse = 'progress-green';
        else if (progresso > 25) corClasse = 'progress-orange';

        const card = document.createElement('div');
        card.className = 'goal-card animate-fade-in';
        card.innerHTML = `
          <div class="goal-header">
            <h3>${meta.desc}</h3>
            <button class="goal-close" onclick="deleteMeta(${meta.id})" title="Excluir meta">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="goal-stats">
            <div><strong>Alvo:</strong> ${fmtBRL(meta.alvo)}</div>
            <div><strong>Atual:</strong> ${fmtBRL(meta.acumulado)}</div>
          </div>
          
          <div class="progress-bar">
            <div class="progress-fill ${corClasse}" style="width: ${progressoFormatado}%"></div>
          </div>
          
          <div class="goal-stats">
            <div>${progressoFormatado}%</div>
            <div><strong>Falta:</strong> ${fmtBRL(Math.max(0, meta.alvo - meta.acumulado))}</div>
          </div>
          
          <div class="goal-actions">
            <input type="number" class="goal-input" placeholder="Valor" step="0.01">
            <button class="btn success btn-small" onclick="updateMeta(${meta.id}, true, this)">
              <i class="fas fa-plus"></i> Adicionar
            </button>
            <button class="btn danger btn-small" onclick="updateMeta(${meta.id}, false, this)">
              <i class="fas fa-minus"></i> Retirar
            </button>
          </div>
        `;

        grid.appendChild(card);
    });
}

function updateMeta(id, isAdd, button) {
    const meta = state.metas.find(m => m.id === id);
    if (!meta) return;

    const input = button.parentElement.querySelector('input');
    const valor = parseN(input.value);

    if (!valor || valor <= 0) {
        return;
    }

    if (isAdd) {
        meta.acumulado = Math.min(meta.alvo, meta.acumulado + valor);
    } else {
        meta.acumulado = Math.max(0, meta.acumulado - valor);
    }

    input.value = '';
    saveState(false);
    renderMetas(); // 🔥 ATUALIZA PROGRESSO E CARD

}

function deleteMeta(id) {
    const meta = state.metas.find(m => m.id === id);
    if (confirm(`Deseja realmente excluir a meta "${meta.desc}"?`)) {
        state.metas = state.metas.filter(m => m.id !== id);
        saveState(false);
    }
}

// ======= Enhanced Notas - CÓDIGO CORRIGIDO =======
function novaNota() {
    const nota = {
        id: Date.now() + Math.random(),
        texto: '',
        done: false,
        created: new Date().toISOString()
    };
    state.notas.push(nota);

    renderNovaNota(nota);
    debounceSave();

    setTimeout(() => {
        const novaTextarea = document.querySelector(`[data-id="${nota.id}"]`);
        if (novaTextarea) {
            novaTextarea.focus();
        }
    }, 100);
}

document.getElementById('btnNovaNota').onclick = novaNota;

function renderNovaNota(nota) {
    const grid = document.getElementById('notesGrid');
    const existingCard = document.querySelector(`[data-note-id="${nota.id}"]`);

    if (existingCard) {
        const textarea = existingCard.querySelector('.note-content');
        textarea.value = nota.texto;
        return;
    }

    const noteCard = document.createElement('div');
    noteCard.className = `note-card ${nota.done ? 'done' : ''}`;
    noteCard.setAttribute('data-note-id', nota.id);
    noteCard.innerHTML = `
        <button class="note-delete" onclick="deleteNote(${nota.id})" title="Excluir nota">
          <i class="fas fa-times"></i>
        </button>
        <textarea class="note-content" 
                  placeholder="Escreva sua anotação aqui... 📝" 
                  data-id="${nota.id}">${nota.texto}</textarea>
        <div class="note-footer">
          <input type="checkbox" class="note-checkbox" ${nota.done ? 'checked' : ''} onchange="toggleNote(${nota.id}, this)">
        </div>
      `;

    const textarea = noteCard.querySelector('.note-content');
    const checkbox = noteCard.querySelector('.note-checkbox');

    function salvarNotaAtual() {
        if (notaAtiva && notaAtiva !== nota.id) {
            const notaAtual = state.notas.find(n => n.id === notaAtiva);
            if (notaAtual) {
                const textareaAtual = document.querySelector(`[data-id="${notaAtiva}"]`);
                if (textareaAtual) {
                    notaAtual.texto = textareaAtual.value;
                    notaAtual.updated = new Date().toISOString();
                }
            }
        }
    }

    textarea.addEventListener('input', (e) => {
        salvarNotaAtual();
        notaAtiva = nota.id;

        const targetNota = state.notas.find(n => n.id == nota.id);
        if (targetNota) {
            targetNota.texto = e.target.value;
            targetNota.updated = new Date().toISOString();
        }

        debounceSave();
    });

    textarea.addEventListener('focus', () => {
        salvarNotaAtual();
        notaAtiva = nota.id;
        notasRenderizadas.set(nota.id, noteCard);
    });

    textarea.addEventListener('blur', () => {
        if (notaAtiva === nota.id) {
            const targetNota = state.notas.find(n => n.id == nota.id);
            if (targetNota) {
                targetNota.texto = textarea.value;
                targetNota.updated = new Date().toISOString();
                saveState();
                notaAtiva = null;
            }
        }
    });

    checkbox.addEventListener('change', (e) => {
        const targetNota = state.notas.find(n => n.id == nota.id);
        if (targetNota) {
            targetNota.done = e.target.checked;
            targetNota.updated = new Date().toISOString();
            noteCard.classList.toggle('done', targetNota.done);
            debounceSave();
        }
    });

    grid.appendChild(noteCard);
    notasRenderizadas.set(nota.id, noteCard);

    if (state.notas.length === 1) {
        setTimeout(() => textarea.focus(), 100);
    }
}

function renderNotas() {
    const grid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyNotes');

    if (state.notas.length === 0) {
        grid.innerHTML = '';
        notasRenderizadas.clear();
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    state.notas.forEach(nota => {
        if (!notasRenderizadas.has(nota.id)) {
            renderNovaNota(nota);
        } else {
            const existingCard = notasRenderizadas.get(nota.id);
            const textarea = existingCard.querySelector('.note-content');
            const checkbox = existingCard.querySelector('.note-checkbox');

            if (textarea.value !== nota.texto) {
                textarea.value = nota.texto;
            }

            if (checkbox.checked !== nota.done) {
                checkbox.checked = nota.done;
                existingCard.classList.toggle('done', nota.done);
            }
        }
    });

    // Remove notas que não existem mais
    Array.from(grid.children).forEach(child => {
        const noteId = parseFloat(child.getAttribute('data-note-id'));
        if (!state.notas.some(nota => nota.id === noteId)) {
            child.remove();
            notasRenderizadas.delete(noteId);
        }
    });
}

function toggleNote(id, checkbox) {
    const nota = state.notas.find(n => n.id === id);
    if (nota) {
        nota.done = checkbox.checked;
        nota.updated = new Date().toISOString();

        const card = notasRenderizadas.get(id);
        if (card) {
            card.classList.toggle('done', nota.done);
        }

        debounceSave();
    }
}

function deleteNote(id) {
    const nota = state.notas.find(n => n.id === id);
    const hasContent = nota && nota.texto.trim().length > 0;

    if (hasContent && !confirm('Esta nota possui conteúdo. Deseja realmente excluir?')) {
        return;
    }

    state.notas = state.notas.filter(n => n.id !== id);

    const card = notasRenderizadas.get(id);
    if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(() => {
            card.remove();
            notasRenderizadas.delete(id);
        }, 300);
    }

    saveState(false);

    if (notaAtiva === id) {
        notaAtiva = null;
    }
}

// ======= Delete Helper =======
window.deleteItem = function (type, id, button) {
    const confirmMsg = type === 'renda' ? 'excluir esta renda?' :
        type === 'despesa' ? 'excluir esta despesa?' :
            'excluir este cartão?';

    if (confirm(`Deseja realmente ${confirmMsg}`)) {
        ensurePeriod(currentPeriod);
        const itemsKey = type === 'cartao' ? 'cartoes' : type + 's';
        const items = state.periodos[currentPeriod][itemsKey];
        state.periodos[currentPeriod][itemsKey] = items.filter(item => item.id !== id);
        saveState(false);
        button.closest('tr').style.opacity = '0';
        setTimeout(() => button.closest('tr').remove(), 300);
    }
};

// ======= Enhanced Reports =======
function renderRelatorios() {
    // Category report
    const relCat = document.getElementById('relatorioCategorias');
    ensurePeriod(currentPeriod);
    const despesas = state.periodos[currentPeriod].despesas || [];

    if (despesas.length === 0) {
        relCat.innerHTML = '<p class="text-muted">Nenhuma despesa para análise</p>';
        return;
    }

    const porCategoria = {};
    despesas.forEach(d => {
        porCategoria[d.tipo] = (porCategoria[d.tipo] || 0) + d.valor;
    });

    let relHTML = '<div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">';
    Object.entries(porCategoria)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, val]) => {
            const pct = (val / despesas.reduce((s, d) => s + d.valor, 0)) * 100;
            relHTML += `
            <div class="card">
              <div class="text-right" style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${fmtBRL(val)}</div>
              <div style="font-size: 0.875rem; color: var(--text-dim);">${cat}</div>
              <div class="text-small text-muted">${Math.round(pct)}% do total</div>
            </div>
          `;
        });
    relHTML += '</div>';
    relCat.innerHTML = relHTML;

    // Monthly history
    const relHist = document.getElementById('relatorioHistorico');
    const periods = Object.keys(state.periodos).sort().slice(-6);

    let histHTML = '<div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">';
    periods.forEach(p => {
        const periodData = state.periodos[p];
        const renda = (periodData.rendas || []).reduce((s, r) => s + r.valor, 0);
        const despesa = ((periodData.despesas || []).reduce((s, d) => s + d.valor, 0) +
            (periodData.cartoes || []).reduce((s, c) => s + c.valor, 0));
        const saldo = renda - despesa;

        const trend = saldo >= 0 ? 'success' : 'danger';
        histHTML += `
          <div class="card text-center">
            <div class="text-small text-muted">${p}</div>
            <div class="${trend === 'success' ? 'text-success' : 'text-danger'} font-bold">${fmtBRL(saldo)}</div>
            <div class="text-small text-muted">Saldo</div>
          </div>
        `;
    });
    histHTML += '</div>';
    relHist.innerHTML = histHTML;
}

// ======= Export/Import =======
document.getElementById('btnExport').onclick = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${getPeriod(todayStr())}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

document.getElementById('btnImport').onclick = () => {
    document.getElementById('fileImport').click();
};

document.getElementById('fileImport').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);
            if (confirm('Deseja importar estes dados? Isso substituirá os dados atuais.')) {
                state = { ...state, ...importedState };
                saveState(false);
                renderAll();
            }
        } catch (err) { }
    };
    reader.readAsText(file);
};

// ======= Reset =======
document.getElementById('btnReset').onclick = () => {
    if (confirm('⚠️ ATENÇÃO: Isso apagará TODOS os seus dados! Deseja continuar?')) {
        if (confirm('TEM CERTEZA? Esta ação não pode ser desfeita.')) {
            localStorage.removeItem('fin-state-pro');
            localStorage.removeItem('onboarding-completed');
            localStorage.removeItem('onboarding-step');
            location.reload();
        }
    }
};

// ======= Navigation System - Todas as abas controladas =======
window.navigateToTab = function (tabId) {
    // Esconde todas as abas
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.style.display = 'none';
    });

    // Remove active de todos os itens de navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Mostra aba selecionada
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active');
    }

    // Marca item de navegação ativo
    const activeItem = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    // Fecha menu lateral
    closeSideNav();

    // Renderiza conteúdo específico da aba
    switch (tabId) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'renda':
            renderRenda();
            break;
        case 'despesas':
            renderDesp();
            renderTipos();
            break;
        case 'cartoes':
            renderCC();
            break;
        case 'metas':
            renderMetas();
            break;
        case 'listas':
            renderNotas();
            break;
        case 'relatorios':
            renderRelatorios();
            break;
    }
};

function initNavigation() {
    // Side nav toggle
    document.getElementById('navToggle').onclick = () => {
        toggleSideNav();
    };

    document.getElementById('navOverlay').onclick = () => {
        closeSideNav();
    };

    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            navigateToTab(tabId);
        };
    });
}

function toggleSideNav() {
    const sideNav = document.getElementById('sideNav');
    const overlay = document.getElementById('navOverlay');

    sideNav.classList.toggle('open');
    overlay.classList.toggle('show');

    document.body.style.overflow = sideNav.classList.contains('open') ? 'hidden' : '';
}

function closeSideNav() {
    const sideNav = document.getElementById('sideNav');
    const overlay = document.getElementById('navOverlay');

    sideNav.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
}

// ======= Theme Management =======
function applyTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const isLight = savedTheme === 'light';
    const toggle = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');

    document.body.classList.toggle('light', isLight);
    toggle.checked = isLight;
    icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
}

document.getElementById('themeToggle').onchange = (e) => {
    const isLight = e.target.checked;
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    applyTheme();
};

// ======= Main Render =======
function renderAll() {
    renderPeriods();
    renderRenda();
    renderDesp();
    renderCC();
    renderDashboard();
    renderTipos();
    renderMetas();
    renderNotas();
}

// ======= Initialization =======
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 1000);

    // Set default dates
    const todayDate = todayStr();
    document.getElementById('rendaData').value = todayDate;
    document.getElementById('despData').value = todayDate;
    document.getElementById('ccVenc').value = todayDate;

    // Initialize
    ensurePeriod(currentPeriod);
    initNavigation();
    applyTheme();
    initOnboarding();
    renderAll();

    // Auto-save every 30 seconds
    setInterval(() => saveState(true), 30000);

    // Welcome message for returning users
    if (onboardingCompleted && !state.stats.firstUse) {
        setTimeout(() => { }, 1500);
    }

    // Initialize notes
    if (state.notas && state.notas.length > 0) {
        setTimeout(() => {
            renderNotas();
        }, 100);
    }
});

// Global functions
window.deleteItem = window.deleteItem || function () { };
window.deleteMeta = deleteMeta;
window.updateMeta = updateMeta;
window.deleteNote = deleteNote;
window.toggleNote = toggleNote;
window.navigateToTab = navigateToTab;
window.togglePeriodList = togglePeriodList;
window.closePeriodList = closePeriodList;

// PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    });
}
document.addEventListener('DOMContentLoaded', () => {

  const modal = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  const modalTitle = document.getElementById('modalTitle');
  const closeModal = document.getElementById('closeModal');

  let currentForm = null;
  let originalParent = null;

  document.querySelectorAll('.fab-inline').forEach(btn => {
    btn.addEventListener('click', () => {

      const tab = btn.closest('.tab');
      if (!tab) return;

      currentForm = tab.querySelector('.form-grid');
      if (!currentForm) return;

      originalParent = currentForm.parentElement;

      if (btn.dataset.form === 'renda') modalTitle.textContent = 'Adicionar Renda';
      if (btn.dataset.form === 'despesas') modalTitle.textContent = 'Adicionar Despesa';
      if (btn.dataset.form === 'cartoes') modalTitle.textContent = 'Adicionar Cartão';

      modalContent.appendChild(currentForm);
      currentForm.style.display = 'grid';

      modal.classList.add('show');
    });
  });

  closeModal.addEventListener('click', () => {
    modal.classList.remove('show');

    if (currentForm && originalParent) {
      originalParent.prepend(currentForm);
      currentForm.style.display = 'none';
      currentForm = null;
      originalParent = null;
    }
  });

});

function abrirFormularioMeta() {
  const form = document.querySelector('#tab-metas .form-grid');
  if (!form) return;

  form.style.display = 'grid';

  // foco no primeiro campo
  const firstInput = form.querySelector('input, textarea');
  firstInput?.focus();
}

document.getElementById('btnNovaMeta')?.addEventListener('click', abrirFormularioMeta);
document.getElementById('btnNovaMetaEmpty')?.addEventListener('click', abrirFormularioMeta);

form.classList.add('show');
