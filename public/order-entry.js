// Shared details styling with the existing creation/save fields. Drafts stay out of the plan until save.
(() => {
  const initNode=document.currentScript;
  if(document.querySelector('script[data-top-dragon-order-entry-initialized]'))return;
  initNode?.setAttribute('data-top-dragon-order-entry-initialized','true');
  const originalRender = renderAddModal;
  let fileUrl = '', previewFile = null, previewHost = null, generation = 0, busy = false;
  let activeDraft=null, previewFrame=null;
  function releaseDraft() {
    generation++; busy=false;
    if(fileUrl)URL.revokeObjectURL(fileUrl);
    fileUrl='';previewFile=null;previewHost=null;
  }
  function syncDraftLifecycle() {
    const next=state.addOpen?state.prefill:null;
    if(next!==activeDraft){releaseDraft();activeDraft=next;}
  }
  function schedulePreview() {
    if(previewFrame!==null)return;
    previewFrame=requestAnimationFrame(()=>{previewFrame=null;syncDraftLifecycle();refreshPreview();});
  }
  const isPlan = () => state.addOpen && state.prefill;
  renderAddModal = function() {
    let html = originalRender.apply(this, arguments);
    if (state.addOpen && state.prefill) html = html.replace('<div class="modal-body">', '<div class="modal-body">' + renderQueueBranchChoice(state.prefill));
    if (!isPlan()) return html;
    const template = document.createElement('template'); template.innerHTML = html;
    const form = template.content.querySelector('form.modal');
    const body = form.querySelector('.modal-body');
    form.classList.add('plan-order-entry');
    form.querySelector('h2').textContent = state.prefill?.proposedLoad ? 'Dodaj wolne ładunki' : state.prefill?.futureQueue ? 'Dodaj planowaną relację' : 'Szczegóły zlecenia';
    const workspace = document.createElement('div'); workspace.className = 'order-entry-workspace' + (state.prefill.orderSourceFile ? '' : ' no-document-preview');
    body.before(workspace); workspace.append(body);
    const upload = document.createElement('details'); upload.className = 'order-entry-upload';
    upload.innerHTML = `<summary><b>Zlecenie transportowe</b></summary><div style="margin-top:10px"><p class="small">Wybierz lub upuść PDF albo Word. Sprawdź dane rozpoznane przez AI przed zapisem.</p><input id="order-entry-file" type="file" accept=".pdf,.doc,.docx" onchange="selectPlanOrderFile(this.files[0])"><p><button class="btn btn-ai-action" type="button" onclick="analyzePlanOrder()" ${busy ? 'disabled' : ''}>${busy ? 'Analizowanie…' : 'Analizuj zlecenie AI'}</button></p><div id="order-entry-status" role="status"></div></div>`;
    body.prepend(upload);
    const dateInput = body.querySelector('#new-date');
    dateInput.previousElementSibling?.remove();
    dateInput.type = 'date'; dateInput.className = 'input';
    dateInput.setAttribute('onchange',"updateNewRouteDateFromInput(this.value);document.getElementById('order-entry-end-date').value=state.prefill.endDate");
    const timing = document.createElement('div'); timing.className = 'grid-2';
    const time = value => { const minutes = Math.round(Number(value || 0)*60); return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; };
    timing.innerHTML = `<label>Godzina załadunku<input class="input" id="order-entry-start" type="time" value="${time(state.prefill.startHour)}" onchange="state.prefill.startHour=Number(this.value.slice(0,2))+Number(this.value.slice(3))/60"></label><label>Data rozładunku<input class="input" id="order-entry-end-date" type="date" value="${attr(state.prefill.endDate || state.prefill.date)}" onchange="state.prefill.endDate=this.value"></label><label>Godzina rozładunku<input class="input" id="order-entry-end" type="time" value="${time(state.prefill.endHour)}" onchange="state.prefill.endHour=Number(this.value.slice(0,2))+Number(this.value.slice(3))/60"></label>`;
    dateInput.after(timing);
    const locations = body.querySelector('#new-load')?.closest('.grid-2');
    if (locations) {
      const sections = document.createElement('section'); sections.className = 'section details-route-section';
      sections.innerHTML = '<div class="details-section-title">Trasa</div>';
      for (const [kind, title, number] of [['load','Załadunek',1],['unload','Rozładunek',2]]) {
        const card = document.createElement('div'); card.className = 'details-stop-card';
        card.innerHTML = `<div class="details-stop-heading"><span class="details-stop-index">${number}</span>${title}</div><div class="details-location-grid"></div>`;
        const grid = card.lastElementChild;
        for (const id of [`new-${kind}`,`new-${kind}-address`,`new-second-${kind}-action`,`new-second-${kind}-section`]) {
          let field = body.querySelector('#' + id);
          if (!field) continue;
          if (id === `new-${kind}`) field = field.closest('.single-suggestion-wrap').parentElement;
          else if (id.endsWith('-address')) field = field.parentElement;
          grid.append(field);
        }
        sections.append(card);
      }
      locations.replaceWith(sections);
      body.insertBefore(sections, dateInput.previousElementSibling);
    }
    const preview = document.createElement('section'); preview.className = 'order-entry-preview';
    preview.innerHTML = '<b>Oryginalne zlecenie</b><div id="order-entry-document"></div>';
    workspace.append(preview);
    form.setAttribute('ondragover', "if(event.dataTransfer.types.includes('Files'))event.preventDefault()");
    form.setAttribute('ondrop', 'event.preventDefault();event.stopPropagation();selectPlanOrderFile(event.dataTransfer.files[0])');
    schedulePreview();
    return template.innerHTML;
  };

  function refreshPreview() {
    syncDraftLifecycle();
    if (!isPlan()) return;
    const file = state.prefill.orderSourceFile;
    const host = document.getElementById('order-entry-document');
    const workspace = host?.closest('.order-entry-workspace');
    if (!host || !file) { if(!file && fileUrl)releaseDraft();workspace?.classList.add('no-document-preview'); return; }
    if(previewHost===host && previewFile===file && fileUrl)return;
    previewHost=host;
    workspace?.classList.remove('no-document-preview');
    if (previewFile !== file) {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(file); previewFile = file;
    }
    host.replaceChildren();
    const label = document.createElement('p'); label.textContent = state.prefill.orderSourceFileName || file.name; host.append(label);
    const link = document.createElement('a'); link.href = fileUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Otwórz dokument'; host.append(link);
    if (orderDocumentFileType(file) === 'pdf') { const frame = document.createElement('iframe'); frame.src = fileUrl; frame.title = 'Oryginalne zlecenie PDF'; host.append(frame); }
    else { const note = document.createElement('p'); note.textContent = 'Dokument Word można otworzyć powyżej. Analiza AI wypełni pola formularza.'; host.append(note); }
  }
  window.selectPlanOrderFile = file => {
    if (!file || !isPlan() || busy) return;
    if (!orderDocumentFileType(file)) { showAppMessage('Nieobsługiwany plik','Wybierz PDF, DOC lub DOCX.','error'); return; }
    state.prefill.orderSourceFile = file;
    state.prefill.orderSourceFileName = file.name;
    state.prefill.orderSourceFileType = orderDocumentFileType(file);
    refreshPreview();
  };
  window.analyzePlanOrder = async () => {
    if (!isPlan() || busy || !canUseOperationalAi()) return;
    syncDraftLifecycle();
    const draft = state.prefill, file = draft.orderSourceFile;
    const status = document.getElementById('order-entry-status');
    if(!status)return;
    if (!file) { status.textContent = 'Najpierw wybierz dokument.'; return; }
    const stopsBefore = JSON.stringify(draft.orderStops || []);
    const token = ++generation;
    const before = new Map(Array.from(document.querySelectorAll('.plan-order-entry input,.plan-order-entry textarea,.plan-order-entry select')).map(el => [el.id,el.value]));
    busy = true; status.textContent = 'Analizuję zlecenie…';
    const button = document.querySelector('[onclick="analyzePlanOrder()"]'); if(button)button.disabled = true;
    try {
      const payload = await requestAiAnalyzer('document', {file,fileName:file.name,referenceDate:draft.date || currentAppDate()},130000);
      if (generation !== token || !isPlan() || state.prefill !== draft) return;
      // The legacy normalizer uses the previous analyzer result as defaults.
      const previousAnalysis = state.pdfImportData;
      state.pdfImportData = null;
      let data;
      try { data = normalizePdfOrderAnalysis(payload); } finally { state.pdfImportData = previousAnalysis; }
      const stopInputs = ['new-load','new-load-address','new-unload','new-unload-address','new-second-load','new-second-load-address','new-second-unload','new-second-unload-address'];
      const stopsUntouched = JSON.stringify(draft.orderStops || []) === stopsBefore && stopInputs.every(id => !document.getElementById(id) || document.getElementById(id).value === before.get(id));
      const fields = {'new-load':data.loadCity,'new-load-address':data.loadAddress,'new-unload':data.unloadCity,'new-unload-address':data.unloadAddress,'new-client':data.client,'new-rate':data.rate,'new-loaded':data.loadedKm || '', 'new-driver-notes':data.driverNotes,'new-order-currency':data.currency,'new-notes':[data.reference,data.notes,data.reminders].filter(Boolean).join('\n')};
      for (const [id,value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (!el || value == null || value === '' || el.value !== before.get(id)) continue;
        el.value = String(value); el.setAttribute('data-ai-filled','');
        if (String(value).trim()) el.closest('details.optional-text-details')?.setAttribute('open','');
        if (id === 'new-loaded') markKmInputManual(id);
      }
      for (const [id,value,key] of [['new-date',data.loadDate,'date'],['order-entry-end-date',data.unloadDate,'endDate'],['order-entry-start',data.loadTime,'startHour'],['order-entry-end',data.unloadTime,'endHour']]) {
        const el = document.getElementById(id);
        if (!el || !value || el.value !== before.get(id)) continue;
        if (id.includes('date') && /^\d{4}-\d{2}-\d{2}$/.test(value)) { if(key==='date')updateNewRouteDateFromInput(value);el.value = value; draft[key] = value; }
        else if (/^\d{2}:\d{2}$/.test(value)) { el.value = value; draft[key] = Number(value.slice(0,2))+Number(value.slice(3))/60; }
      }
      if (stopsUntouched) Object.assign(draft, orderStopFields(payload));
      for (const [field, value] of Object.entries(orderStopFields(payload))) {
        const id = {'secondLoad':'new-second-load','secondLoadAddress':'new-second-load-address','secondUnload':'new-second-unload','secondUnloadAddress':'new-second-unload-address'}[field];
        const el = id && document.getElementById(id);
        if (el && el.value === before.get(id)) { el.value = value; el.setAttribute('data-ai-filled',''); el.closest('.optional-stop-section')?.classList.remove('hidden-by-toggle'); }
      }
      draft.clientNip = data.clientNip || ''; draft.aiImported = true;
      updateNewRouteFinance('rate');
      const liveStatus=document.getElementById('order-entry-status');if(liveStatus)liveStatus.textContent = 'Analiza zakończona. Sprawdź żółte pola, terminy i kilometry przed zapisaniem.';
    } catch (error) { if (state.prefill === draft && document.getElementById('order-entry-status')) document.getElementById('order-entry-status').textContent = `Nie udało się przeanalizować: ${error?.message || error}`; }
    finally { if (generation === token) { busy = false; const liveButton=document.querySelector('[onclick="analyzePlanOrder()"]');if(liveButton)liveButton.disabled=false; } }
  };
  const originalClose = closeAdd;
  closeAdd = function() { releaseDraft();activeDraft=null;return originalClose.apply(this,arguments); };

  const lifecycleObserver=new MutationObserver(records=>{
    if(records.some(record=>Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node=>node.nodeType===1 && (node.matches?.('.plan-order-entry') || node.querySelector?.('.plan-order-entry')))))schedulePreview();
  });
  lifecycleObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{
    releaseDraft();lifecycleObserver.disconnect();
    if(previewFrame!==null)cancelAnimationFrame(previewFrame);
    previewFrame=null;
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    lifecycleObserver.observe(document.body,{childList:true,subtree:true});
    const button=document.querySelector('[onclick="analyzePlanOrder()"]');if(button)button.disabled=false;
    schedulePreview();
  });

  const stepList = tutorialStepsForCurrentRole;
  tutorialStepsForCurrentRole = function() {
    return stepList.apply(this,arguments).map(step => {
      if (['clients-search','nearest-query'].includes(step.key)) return {...step,advanceOnInput:'text'};
      if (step.key === 'nearest-check') return {...step,clickAdvance:true};
      return step;
    });
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('.side-tool-tab,.commercial-tab')) return;
    const x = scrollX, y = scrollY;
    requestAnimationFrame(() => window.scrollTo({left:x,top:y,behavior:'instant'}));
  },true);

  // Track layout changes without observing our own overlay mutations.
  let lastRect = '';
  setInterval(() => {
    if (!state.tutorialOpen) { lastRect = ''; return; }
    const step = tutorialStepsForCurrentRole()[state.tutorialStep];
    const target = tutorialTargetForStep(step), r = target?.getBoundingClientRect();
    const signature = `${state.tutorialStep}:${r?.left}:${r?.top}:${r?.width}:${r?.height}`;
    if (signature !== lastRect || target !== tutorialSpotlightTarget) { lastRect = signature; scheduleTutorialSpotlightSync(); }
  },200);
})();
