/* EasyGart assignment workflow, local demonstration only. No real account authentication. */
'use strict';
(function () {
  let staffFilter = 'all';
  const stateOf = task => task.done ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'assigned';
  const overdue = task => !task.done && !!task.date && task.date < localDate();
  const canChange = task => !!task && (isOwner() || task.staffId === currentStaffId);
  const ownerTasks = () => isOwner();
  const activeOperators = () => data.staff.filter(s => s.active && s.role !== 'titolare');

  function taskAction(task, action, label, style) {
    return btn(label, action, style || 'secondary', 'data-id="' + esc(task.id) + '"');
  }
  function taskRow(task) {
    const state = stateOf(task);
    const statusLabel = task.done ? 'Completato' : overdue(task) ? 'In ritardo' : state === 'in_progress' ? 'In corso' : 'Assegnato';
    const statusTone = task.done ? '' : overdue(task) ? 'red' : state === 'in_progress' ? 'amber' : 'grey';
    const time = task.startTime ? ' · ' + esc(task.startTime) : '';
    const duration = Number(task.estimateMins) > 0 ? ' · ' + Number(task.estimateMins) + ' min' : '';
    const details = [
      '<span>' + icon('calendar') + fmtDate(task.date) + time + duration + '</span>',
      '<span>' + icon('building') + esc(name('clients', task.clientId)) + '</span>',
      task.siteId ? '<span>' + icon('leaf') + esc(name('sites', task.siteId)) + '</span>' : '',
      '<span>' + icon('users') + esc(name('staff', task.staffId)) + '</span>'
    ].join('');
    const actions = task.done
      ? (isOwner() ? taskAction(task, 'assignment-reopen', 'Riapri') : '')
      : state === 'assigned'
        ? taskAction(task, 'assignment-start', 'Inizia', 'primary') + taskAction(task, 'assignment-complete', 'Completa')
        : taskAction(task, 'assignment-complete', 'Completa', 'primary');
    return '<div class="list-row" style="align-items:flex-start;gap:13px;flex-wrap:wrap">' +
      '<div class="grow" style="min-width:185px">' +
      '<h3 class="' + (task.done ? 'done-text' : '') + '">' + esc(task.title) + '</h3>' +
      '<div class="job-meta" style="margin-top:8px;flex-wrap:wrap">' + details + '</div>' +
      (task.note ? '<p class="small" style="margin-top:9px;white-space:pre-wrap;overflow-wrap:anywhere">' + esc(task.note) + '</p>' : '') +
      (task.startedAt && !task.done ? '<p class="small muted" style="margin-top:5px">Avviato: ' + fmtTime(task.startedAt) + '</p>' : '') +
      '</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
      badge(statusTone, statusLabel) +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">' +
      (canChange(task) ? actions : '') +
      (isOwner() ? '<button class="icon-button" data-action="open:task" data-id="' + esc(task.id) + '" title="Modifica assegnazione">' + icon('settings') + '</button>' : '') +
      '</div></div></div>';
  }

  const previousTasks = tasks;
  tasks = function () {
    const manager = ownerTasks();
    let items = data.tasks.filter(task => manager || task.staffId === currentStaffId);
    if (manager && staffFilter !== 'all') items = items.filter(task => task.staffId === staffFilter);
    if (filter === 'open') items = items.filter(task => !task.done);
    if (filter === 'progress') items = items.filter(task => stateOf(task) === 'in_progress');
    if (filter === 'done') items = items.filter(task => task.done);
    if (filter === 'late') items = items.filter(overdue);
    if (search) {
      const q = search.toLocaleLowerCase();
      items = items.filter(task => [task.title, task.note || '', name('clients', task.clientId), name('staff', task.staffId)].join(' ').toLocaleLowerCase().includes(q));
    }
    items.sort((a,b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    const completed = items.filter(task => task.done).length;
    const late = items.filter(overdue).length;
    const progress = items.filter(task => stateOf(task) === 'in_progress').length;
    const employeeOptions = '<option value="all">Tutta la squadra</option>' + data.staff.filter(s => s.active).map(s =>
      '<option value="' + esc(s.id) + '"' + (staffFilter === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'
    ).join('');
    const filterOptions = [['all','Tutte'],['open','Da fare'],['progress','In corso'],['late','In ritardo'],['done','Completate']]
      .map(f => '<option value="' + f[0] + '"' + (filter === f[0] ? ' selected' : '') + '>' + f[1] + '</option>').join('');
    const action = manager ? btn(icon('plus') + ' Assegna attività', 'open:task', 'primary') : '';
    return pageHeader(manager ? 'Compiti della squadra' : 'I miei compiti',
        manager ? 'Assegna incarichi ai dipendenti e controlla il loro avanzamento.' : 'Qui trovi soltanto gli incarichi assegnati a te.',
        action) +
      '<div class="notice" style="margin-bottom:16px">' + icon('info') +
        ' Modalità demo: il cambio operatore simula gli account sullo stesso browser. Non invia incarichi ad altri telefoni.</div>' +
      '<div class="stat-grid" style="margin-bottom:16px">' +
        stat('Da fare', items.filter(task => !task.done).length, late + ' in ritardo', 'checklist') +
        stat('In corso', progress, 'Interventi avviati', 'clock') +
        stat('Completate', completed, items.length + ' attività visualizzate', 'checklist') + '</div>' +
      '<div class="filters" style="gap:9px;flex-wrap:wrap">' +
      '<input class="input" id="search" placeholder="Cerca attività o cliente..." value="' + esc(search) + '">' +
      '<select class="select" id="task-filter" aria-label="Filtra stato">' + filterOptions + '</select>' +
      (manager ? '<select class="select" id="assignment-staff-filter" aria-label="Filtra dipendente">' + employeeOptions + '</select>' : '') +
      '</div><div class="card">' +
      (items.length ? items.map(taskRow).join('') : empty('checklist','Nessun incarico',
        manager ? 'Assegna un nuovo compito oppure cambia i filtri.' : 'Non hai attività assegnate con questi filtri.')) +
      '</div>';
  };

  const previousModal = renderModal;
  renderModal = function () {
    if (!modal || modal.type !== 'task') return previousModal();
    if (!isOwner()) return '';
    const x = byId('tasks', modal.id) || {};
    const available = activeOperators();
    const choices = '<option value="">Seleziona dipendente...</option>' + available.map(s =>
      '<option value="' + esc(s.id) + '"' + (x.staffId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const clientChoices = options('clients', x.clientId);
    const priorities = ['bassa','media','alta'].map(p => '<option value="' + p + '"' +
      ((x.priority || 'media') === p ? ' selected' : '') + '>' + p[0].toUpperCase() + p.slice(1) + '</option>').join('');
    return dialog(modal.id ? 'Modifica assegnazione' : 'Assegna un compito',
      'Il dipendente selezionato vedrà il compito nella sua vista dimostrativa.',
      formModal('form-task', '<div class="form-grid">' +
        field('Compito *', 'title', 'text', x.title || '', 'required maxlength="120"') +
        selectField('Dipendente *', 'staffId', choices, 'required') +
        field('Data prevista *', 'date', 'date', x.date || localDate(), 'required') +
        field('Ora prevista', 'startTime', 'time', x.startTime || '') +
        field('Durata stimata (minuti)', 'estimateMins', 'number', x.estimateMins || '', 'min="0" max="720" step="5"') +
        selectField('Cliente *', 'clientId', clientChoices, 'required id="form-client"') +
        selectField('Cantiere', 'siteId', siteOptions(x.clientId, x.siteId), 'id="form-site"') +
        selectField('Priorità', 'priority', priorities) +
        textareaField('Istruzioni operative', 'note', x.note || '') +
      '</div>'));
  };

  const previousOpenModal = openModal;
  openModal = function (type, id) {
    if (type === 'task' && !isOwner()) return deny();
    return previousOpenModal(type, id);
  };

  const previousSubmit = submitForm;
  submitForm = function (form) {
    if (form.id !== 'form-task') return previousSubmit(form);
    if (!isOwner()) return deny();
    const v = serializeForm(form);
    const assignee = byId('staff', v.staffId);
    if (!assignee || !assignee.active || assignee.role === 'titolare') {
      notify('Seleziona un dipendente attivo.'); return;
    }
    if (v.estimateMins && (!Number.isFinite(Number(v.estimateMins)) || Number(v.estimateMins) < 0 || Number(v.estimateMins) > 720)) {
      notify('La durata stimata deve essere compresa tra 0 e 720 minuti.'); return;
    }
    const previousId = modal && modal.id;
    const oldStaffId = previousId && byId('tasks', previousId) && byId('tasks', previousId).staffId;
    const before = new Set(data.tasks.map(x => x.id));
    previousSubmit(form);
    if (modal !== null) return; // Original validation rejected the submission.
    const target = previousId ? byId('tasks', previousId) : data.tasks.find(x => !before.has(x.id));
    if (!target) return;
    const changed = !previousId || oldStaffId !== target.staffId;
    if (changed) {
      target.status = 'assigned';
      target.done = false;
      target.startedAt = null;
      target.doneAt = null;
      target.completedBy = null;
      target.assignedAt = new Date().toISOString();
      target.assignedBy = currentStaffId;
    } else if (!target.status) {
      target.status = target.done ? 'done' : 'assigned';
    }
    target.estimateMins = v.estimateMins ? Number(v.estimateMins) : null;
    store(); render();
  };

  function setTaskState(id, next) {
    const task = byId('tasks', id);
    if (!task || !canChange(task)) { deny(); return; }
    if (next === 'assigned') {
      if (!isOwner()) return deny();
      task.done = false;
      task.doneAt = null;
      task.completedBy = null;
      task.startedAt = null;
    } else if (next === 'in_progress') {
      if (task.done) return;
      task.startedAt = task.startedAt || new Date().toISOString();
    } else if (next === 'done') {
      if (task.done) return;
      task.done = true;
      task.doneAt = new Date().toISOString();
      task.completedBy = currentStaffId;
    } else return;
    task.status = next;
    store();render();
    notify(next === 'done' ? 'Compito completato.' : next === 'in_progress' ? 'Lavoro iniziato.' : 'Compito riaperto.');
  }

  toggleTask = function (id) {
    const task = byId('tasks', id);
    if (!task || !canChange(task)) return deny();
    if (task.done && !isOwner()) return deny();
    setTaskState(id, task.done ? 'assigned' : 'done');
  };

  const previousDashboard = dashboard;
  dashboard = function () {
    if (isOwner()) return previousDashboard();
    const mine = data.tasks.filter(task => task.staffId === currentStaffId);
    const pending = mine.filter(task => !task.done);
    const soon = [...pending].sort((a,b) => a.date.localeCompare(b.date)).slice(0,4);
    return pageHeader('Il mio lavoro', 'I compiti affidati a ' + name('staff', currentStaffId) + '.',
      btn('Apri tutti i compiti', 'navigate', 'primary', 'data-id="tasks"')) +
      '<div class="stat-grid" style="margin-bottom:16px">' +
        stat('Da fare', pending.length, 'Incarichi assegnati', 'checklist') +
        stat('In corso', pending.filter(t => stateOf(t) === 'in_progress').length, 'Lavori avviati', 'clock') +
        stat('Completati', mine.filter(t => t.done).length, 'Interventi conclusi', 'checklist') + '</div>' +
      '<div class="card"><div class="card-head"><h2>Prossimi interventi</h2></div>' +
        (soon.length ? soon.map(taskRow).join('') : empty('checklist','Nessun compito in sospeso','Le assegnazioni del titolare compariranno qui nella demo.')) +
      '</div><div class="notice" style="margin-top:16px">Vista dimostrativa. Non è un account autenticato e non sincronizza dati con altri dispositivi.</div>';
  };

  const previousNavigation = navigation;
  navigation = function () {
    if (isOwner()) return previousNavigation();
    const items = NAV.filter(n => ['dashboard','tasks','reports','attendance'].includes(n[0]));
    return '<aside class="sidebar"><div class="logo"><div class="logo-mark">' + icon('leaf',27) +
      '</div><div class="logo-text"><div class="logo-name">easygart.</div><div class="logo-sub">dipendente · demo</div></div></div>' +
      '<div class="nav-label">Il mio spazio</div><div class="nav">' + items.map(n => menuItem(...n)).join('') +
      '</div><div class="side-bottom"><div class="demo-pill">Account simulato. Nessuna sincronizzazione con altri telefoni.</div></div></aside>';
  };
  const previousMobileNavigation = mobileNavigation;
  mobileNavigation = function () {
    if (isOwner()) return previousMobileNavigation();
    return '<nav class="mobile-nav" aria-label="Navigazione dipendente">' +
      NAV.filter(n => ['dashboard','tasks','reports','attendance'].includes(n[0]))
      .map(n => menuItem(...n)).join('') + '</nav>';
  };
  const previousView = view;
  view = function () {
    if (!isOwner() && !['dashboard','tasks','reports','attendance'].includes(screen)) return dashboard();
    return previousView();
  };
  const previousNav = nav;
  nav = function (destination) {
    if (!isOwner() && !['dashboard','tasks','reports','attendance'].includes(destination)) return deny();
    previousNav(destination);
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const type = el.dataset.action;
    if (!['assignment-start','assignment-complete','assignment-reopen'].includes(type)) return;
    setTaskState(el.dataset.id, type === 'assignment-start' ? 'in_progress' :
      type === 'assignment-reopen' ? 'assigned' : 'done');
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'assignment-staff-filter') {
      staffFilter = e.target.value;render();
    }
    if (e.target.id === 'current-staff') {
      staffFilter = 'all'; filter = 'all'; search = '';
      if (!isOwner() && !['dashboard','tasks','reports','attendance'].includes(screen)) screen = 'dashboard';
      render();
    }
  });

  Object.assign(I18N_DE, {
    'Compiti della squadra':'Aufgaben im Team','I miei compiti':'Meine Aufgaben',
    'Assegna attività':'Aufgabe zuweisen','Assegna un compito':'Aufgabe zuweisen',
    'Modifica assegnazione':'Aufgabe bearbeiten','Compito *':'Aufgabe *','Dipendente *':'Mitarbeiter *',
    'Data prevista *':'Geplantes Datum *','Ora prevista':'Geplante Uhrzeit',
    'Durata stimata (minuti)':'Geschätzte Dauer (Minuten)',
    'Istruzioni operative':'Arbeitsanweisungen','Seleziona dipendente...':'Mitarbeiter auswählen...',
    'Tutta la squadra':'Gesamtes Team','Assegnato':'Zugewiesen','In corso':'In Arbeit',
    'In ritardo':'Überfällig','Completato':'Erledigt','Inizia':'Starten',
    'Completa':'Abschließen','Riapri':'Wieder öffnen','Da fare':'Offen',
    'Cerca attività o cliente...':'Aufgabe oder Kunde suchen...',
    'I miei compiti':'Meine Aufgaben','Il mio lavoro':'Meine Arbeit',
    'Prossimi interventi':'Nächste Einsätze','Apri tutti i compiti':'Alle Aufgaben öffnen',
    'Compiti della squadra':'Teamaufgaben','Nessun incarico':'Keine Aufgaben'
  });
  window.EasyGartTaskDemo = {stateOf,overdue,setTaskState};
  render();
})();