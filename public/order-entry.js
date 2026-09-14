// Shared details styling with the existing creation/save fields. Drafts stay out of the plan until save.
(() => {
  const initNode=document.currentScript;
  if(document.querySelector('script[data-top-dragon-order-entry-initialized]'))return;
  initNode?.setAttribute('data-top-dragon-order-entry-initialized','true');
  const originalRender = renderAddModal;
  const originalSave = saveNewRoute;
  let fileUrl = '', previewFile = null, previewHost = null, generation = 0, busy = false, saveBusy = false;
  let activeDraft=null, previewFrame=null, analysisFields=[], activeAnalysisField=-1;
  function releaseDraft() {
    generation++; busy=false;
    if(fileUrl)URL.revokeObjectURL(fileUrl);
    fileUrl='';previewFile=null;previewHost=null;analysisFields=[];activeAnalysisField=-1;
  }
  function syncDraftLifecycle() {
    const next=state.addOpen?state.prefill:null;
    if(next!==activeDraft){
      releaseDraft();activeDraft=next;
      analysisFields=Array.isArray(next?.orderAiExtractedFields)
        ? next.orderAiExtractedFields.map(field=>({...field,searchValue:field.searchValue||field.value||''})).filter(field=>String(field.value||'').trim())
        : [];
      activeAnalysisField=analysisFields.length?0:-1;
    }
  }
  function schedulePreview() {
    if(previewFrame!==null)return;
    previewFrame=requestAnimationFrame(()=>{previewFrame=null;syncDraftLifecycle();refreshPreview();});
  }
  const isPlan = () => state.addOpen && state.prefill;
  const analysisText = value => Array.isArray(value)
    ? value.map(item=>String(item||'').trim()).filter(Boolean).join('\n')
    : String(value??'').trim();
  const analysisLocationKey = value => removePolishChars(String(value||'')).replace(/[^a-z0-9]+/g,' ').trim();
  function analyzedExtraStops(data,payload) {
    const stops=orderStopFields(payload);
    const secondLoad=analysisText(stops.secondLoad);
    const secondUnload=analysisText(stops.secondUnload);
    return {
      ...stops,
      secondLoad:secondLoad && analysisLocationKey(secondLoad)!==analysisLocationKey(data.loadCity) ? secondLoad : '',
      secondLoadAddress:secondLoad && analysisLocationKey(secondLoad)!==analysisLocationKey(data.loadCity) ? analysisText(stops.secondLoadAddress) : '',
      secondUnload:secondUnload && analysisLocationKey(secondUnload)!==analysisLocationKey(data.unloadCity) ? secondUnload : '',
      secondUnloadAddress:secondUnload && analysisLocationKey(secondUnload)!==analysisLocationKey(data.unloadCity) ? analysisText(stops.secondUnloadAddress) : ''
    };
  }
  function buildAnalysisFields(data,payload) {
    const stops=analyzedExtraStops(data,payload);
    const notes=Array.from(new Set([data.reference,data.notes,data.reminders]
      .flatMap(value=>Array.isArray(value)?value:String(value||'').split(/\n+/))
      .map(value=>String(value||'').trim()).filter(Boolean))).join('\n');
    const candidates=[
      ['load','Załadunek',data.loadCity],['loadAddress','Adres załadunku',data.loadAddress],
      ['secondLoad','Drugi załadunek',stops.secondLoad],['secondLoadAddress','Adres drugiego załadunku',stops.secondLoadAddress],
      ['unload','Rozładunek',data.unloadCity],['unloadAddress','Adres rozładunku',data.unloadAddress],
      ['secondUnload','Drugi rozładunek',stops.secondUnload],['secondUnloadAddress','Adres drugiego rozładunku',stops.secondUnloadAddress],
      ['loadDate','Data załadunku',data.loadDate],['loadTime','Godzina załadunku',data.loadTime],
      ['unloadDate','Data rozładunku',data.unloadDate],['unloadTime','Godzina rozładunku',data.unloadTime],
      ['client','Klient',data.client],['clientNip','NIP klienta',data.clientNip],['clientAddress','Adres klienta',data.clientAddress],
      ['reference','Numer / referencja',data.reference],
      ['rate','Stawka',[data.rate,data.currency].filter(value=>analysisText(value)).join(' ')],
      ['loadedKm','Kilometry z ładunkiem',data.loadedKm],['driverNotes','Uwagi dla kierowcy',data.driverNotes],['notes','Pozostałe informacje',notes]
    ];
    const seen=new Set();
    return candidates.map(([key,label,value])=>({key,label,value:analysisText(value),searchValue:analysisText(value)})).filter(field=>{
      if(!field.value)return false;
      const signature=`${field.key}:${field.value}`;
      if(seen.has(signature))return false;
      seen.add(signature);return true;
    });
  }
  function persistAnalysisFields() {
    if(!activeDraft)return;
    activeDraft.orderAiExtractedFields=analysisFields.map(({key,label,value,searchValue})=>({key,label,value,searchValue}));
  }
  function renderAnalysisFields() {
    const review=document.getElementById('order-entry-ai-review');
    const list=document.getElementById('order-entry-ai-fields');
    if(!review||!list)return;
    review.hidden=!analysisFields.length;
    list.innerHTML=analysisFields.map((field,index)=>`<div class="order-entry-ai-tile ${index===activeAnalysisField?'active':''}"><button class="order-entry-ai-value" type="button" onclick="focusPlanOrderAnalysisTile(${index})" title="Znajdź w dokumencie"><b>${esc(field.label)}</b><span>${esc(field.value)}</span></button><button class="order-entry-ai-remove" type="button" onclick="removePlanOrderAnalysisTile(${index})" aria-label="Usuń ${attr(field.label)}" title="Usuń ten kafelek">×</button></div>`).join('');
  }
  window.focusPlanOrderAnalysisTile=index=>{
    if(!analysisFields[index])return;
    activeAnalysisField=index;renderAnalysisFields();
    const frame=document.querySelector('#order-entry-document iframe');
    const search=analysisFields[index].searchValue||analysisFields[index].value||'';
    if(frame&&fileUrl)frame.src=`${fileUrl}#toolbar=1&navpanes=0&search=${encodeURIComponent(search)}`;
  };
  window.removePlanOrderAnalysisTile=index=>{
    if(!analysisFields[index])return;
    analysisFields.splice(index,1);
    activeAnalysisField=analysisFields.length?Math.min(index,analysisFields.length-1):-1;
    persistAnalysisFields();renderAnalysisFields();
  };
  window.clearPlanOrderAnalysisTiles=()=>{
    analysisFields=[];activeAnalysisField=-1;persistAnalysisFields();renderAnalysisFields();
  };
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
    const relationDateStepper=dateInput?.previousElementSibling;
    const relationDateLabel=relationDateStepper?.previousElementSibling;
    if(relationDateLabel?.classList?.contains('field-label') && /data relacji/i.test(relationDateLabel.textContent||''))relationDateLabel.remove();
    relationDateStepper?.remove();
    dateInput.type = 'date'; dateInput.className = 'input';
    dateInput.setAttribute('onchange',"updateNewRouteDateFromInput(this.value);const end=document.getElementById('order-entry-end-date');if(end)end.value=state.prefill.endDate");
    const time = value => { const minutes = Math.round(Number(value || 0)*60); return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; };
    const startInput=document.createElement('input');startInput.className='input';startInput.id='order-entry-start';startInput.type='time';startInput.value=time(state.prefill.startHour);startInput.setAttribute('onchange',"state.prefill.startHour=Number(this.value.slice(0,2))+Number(this.value.slice(3))/60");
    const endDateInput=document.createElement('input');endDateInput.className='input';endDateInput.id='order-entry-end-date';endDateInput.type='date';endDateInput.value=state.prefill.endDate||state.prefill.date;endDateInput.setAttribute('onchange','state.prefill.endDate=this.value');
    const endInput=document.createElement('input');endInput.className='input';endInput.id='order-entry-end';endInput.type='time';endInput.value=time(state.prefill.endHour);endInput.setAttribute('onchange',"state.prefill.endHour=Number(this.value.slice(0,2))+Number(this.value.slice(3))/60");
    const labeledControl=(text,control)=>{const label=document.createElement('label');label.className='order-entry-date-control';const caption=document.createElement('span');caption.className='field-label';caption.textContent=text;label.append(caption,control);return label;};
    const locations = body.querySelector('#new-load')?.closest('.grid-2');
    if (locations) {
      const sections = document.createElement('section'); sections.className = 'section details-route-section';
      sections.innerHTML = '<div class="details-section-title">Trasa</div>';
      for (const [kind, title, number] of [['load','Załadunek',1],['unload','Rozładunek',2]]) {
        const card = document.createElement('div'); card.className = 'details-stop-card';
        card.innerHTML = `<div class="details-stop-heading"><span class="details-stop-index">${number}</span>${title}</div><div class="order-entry-stop-timing"></div><div class="details-location-grid"></div>`;
        const timing=card.querySelector('.order-entry-stop-timing');
        if(kind==='load')timing.append(labeledControl('Data załadunku',dateInput),labeledControl('Godzina załadunku',startInput));
        else timing.append(labeledControl('Data rozładunku',endDateInput),labeledControl('Godzina rozładunku',endInput));
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
    }
    const preview = document.createElement('section'); preview.className = 'order-entry-preview';
    preview.innerHTML = '<section id="order-entry-ai-review" class="order-entry-ai-review" hidden><div class="order-entry-ai-review-head"><div><b>Dane odczytane przez AI</b><p>Żółte kafelki pozostają nad zleceniem. Kliknij treść, aby znaleźć ją w PDF, albo usuń kafelek przyciskiem ×.</p></div><button class="btn-mini danger" type="button" onclick="clearPlanOrderAnalysisTiles()">Usuń wszystkie</button></div><div id="order-entry-ai-fields" class="order-entry-ai-fields"></div></section><b>Oryginalne zlecenie</b><div id="order-entry-document"></div>';
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
    if (!host || !file) { if(!file && fileUrl)releaseDraft();workspace?.classList.add('no-document-preview');renderAnalysisFields(); return; }
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
    renderAnalysisFields();
  }
  window.selectPlanOrderFile = file => {
    if (!file || !isPlan() || busy) return;
    if (!orderDocumentFileType(file)) { showAppMessage('Nieobsługiwany plik','Wybierz PDF, DOC lub DOCX.','error'); return; }
    state.prefill.orderSourceFile = file;
    state.prefill.orderSourceFileName = file.name;
    state.prefill.orderSourceFileType = orderDocumentFileType(file);
    analysisFields=[];activeAnalysisField=-1;persistAnalysisFields();
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
        el.value = String(value);
        if (String(value).trim()) el.closest('details.optional-text-details')?.setAttribute('open','');
        if (id === 'new-loaded') markKmInputManual(id);
      }
      for (const [id,value,key] of [['new-date',data.loadDate,'date'],['order-entry-end-date',data.unloadDate,'endDate'],['order-entry-start',data.loadTime,'startHour'],['order-entry-end',data.unloadTime,'endHour']]) {
        const el = document.getElementById(id);
        if (!el || !value || el.value !== before.get(id)) continue;
        if (id.includes('date') && /^\d{4}-\d{2}-\d{2}$/.test(value)) { if(key==='date')updateNewRouteDateFromInput(value);el.value = value; draft[key] = value; }
        else if (/^\d{2}:\d{2}$/.test(value)) { el.value = value; draft[key] = Number(value.slice(0,2))+Number(value.slice(3))/60; }
      }
      const extraStops=analyzedExtraStops(data,payload);
      if (stopsUntouched) {
        draft.orderStops=extraStops.orderStops;
        Object.assign(draft,{secondLoad:extraStops.secondLoad,secondLoadAddress:extraStops.secondLoadAddress,secondUnload:extraStops.secondUnload,secondUnloadAddress:extraStops.secondUnloadAddress});
      }
      for (const [kind,cityField,addressField] of [['load','secondLoad','secondLoadAddress'],['unload','secondUnload','secondUnloadAddress']]) {
        const city=extraStops[cityField];
        if(!city)continue;
        for(const [field,id] of [[cityField,`new-second-${kind}`],[addressField,`new-second-${kind}-address`]]){
          const value=extraStops[field],el=document.getElementById(id);
          if(el && value && el.value===before.get(id))el.value=value;
        }
        document.getElementById(`new-second-${kind}-section`)?.classList.remove('hidden-by-toggle');
        document.getElementById(`new-second-${kind}-action`)?.remove();
      }
      draft.clientNip = data.clientNip || ''; draft.aiImported = true;
      analysisFields=buildAnalysisFields(data,payload);activeAnalysisField=analysisFields.length?0:-1;persistAnalysisFields();renderAnalysisFields();
      updateNewRouteFinance('rate');
      const liveStatus=document.getElementById('order-entry-status');if(liveStatus)liveStatus.textContent = 'Analiza zakończona. Sprawdź żółte kafelki nad zleceniem i usuń te, których nie chcesz zachować.';
    } catch (error) { if (state.prefill === draft && document.getElementById('order-entry-status')) document.getElementById('order-entry-status').textContent = `Nie udało się przeanalizować: ${error?.message || error}`; }
    finally { if (generation === token) { busy = false; const liveButton=document.querySelector('[onclick="analyzePlanOrder()"]');if(liveButton)liveButton.disabled=false; } }
  };
  saveNewRoute = async function() {
    const event=arguments[0];
    if(saveBusy){event?.preventDefault?.();return;}
    saveBusy=true;
    const submit=document.querySelector('.plan-order-entry .modal-foot .btn-dark');
    if(submit){submit.disabled=true;submit.dataset.originalText=submit.textContent;submit.textContent='Zapisywanie…';}
    try {
      return await originalSave.apply(this,arguments);
    } catch(error) {
      showAppMessage('Nie udało się zapisać trasy',String(error?.message||error||'Nieznany błąd zapisu.'),'error');
    } finally {
      saveBusy=false;
      const liveSubmit=document.querySelector('.plan-order-entry .modal-foot .btn-dark');
      if(liveSubmit){liveSubmit.disabled=false;liveSubmit.textContent=liveSubmit.dataset.originalText||'Zapisz trasę';}
    }
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
