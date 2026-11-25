(function topDragonAiQuickQueueV312Module() {
  "use strict";
  if (window.__topDragonAiQuickQueueV312) return;

  const UNKNOWN_DATE = "Brak daty";

  function sourceHasDateHint(text) {
    const value = String(text || "");
    return Boolean(
      /\b\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?\b/.test(value)
      || /\b\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrze(?:ś|s)nia|pa(?:ź|z)dziernika|listopada|grudnia)(?:\s+\d{4})?\b/i.test(value)
      || /\b(?:dzisiaj|dziś|jutro|pojutrze|poniedzia[łl]ek|wtorek|[śs]roda|czwartek|pi[aą]tek|sobota|niedziela)\b/i.test(value)
    );
  }

  function markUnknownDates(item, sourceText) {
    if (sourceHasDateHint(sourceText)) return { ...item, dateUnknown: false };
    return {
      ...item,
      date: "",
      loadDate: "",
      endDate: "",
      dateUnknown: true,
      dateDisplay: ""
    };
  }

  function queueRouteFromText(item, index, target, sourceText) {
    const unknown = Boolean(item?.dateUnknown);
    const now = Date.now();
    const login = String(state.user?.login || "SYSTEM");
    const branch = String(state.user?.branch || "");
    const branchId = String(state.user?.branchId || "");

    const base = createProposedLoadFromTextItem(item, index);
    const route = {
      ...base,
      id: `${target === "proposed" ? "p" : "f"}ai${now}${index}${Math.random().toString(36).slice(2, 7)}`,
      createdBy: login,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerDispatcher: login,
      queueBranchId: branchId,
      visibilityScope: target === "proposed" ? "all" : "branch",
      visibilityBranch: target === "proposed" ? "" : branch,
      futureQueue: target === "future",
      proposedLoad: target === "proposed",
      status: target === "proposed" ? "available" : "planned",
      approvalStatus: "accepted",
      accountingStatus: "Nowe",
      aiImported: true,
      aiSourceText: String(sourceText || ""),
      aiSourceType: String(item?.aiSourceType || "text"),
      dateUnknown: unknown,
      dateDisplay: ""
    };

    if (unknown) {
      route.date = "";
      route.loadDate = "";
      route.endDate = "";
      route.loadDateWindowFrom = "";
      route.loadDateWindowTo = "";
    }

    try {
      Object.defineProperty(route, "_centralLocalCreatedAt", {
        value: Date.now(),
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch (error) {
      route._centralLocalCreatedAt = Date.now();
    }

    return route;
  }

  function persistQuickRoutes(routes, target) {
    if (target === "proposed") {
      if (!Array.isArray(state.proposedLoads)) state.proposedLoads = [];
      routes.forEach(route => state.proposedLoads.push(route));
    } else {
      if (!Array.isArray(state.futureRoutes)) state.futureRoutes = [];
      routes.forEach(route => state.futureRoutes.push(route));
    }

    routes.forEach(route => {
      scheduleSavedRoutePointGeocodes?.(route, target === "proposed" ? { proposed: true } : { future: true });
      window.registerQueueMatchCandidateV142?.(target, route);
    });

    persistQueueOutbox?.();
    syncCentralLoadQueueDiff?.();
    scheduleCentralLoadQueueDiff?.(0);

    if (target === "proposed") {
      state.proposedPanelOpen = true;
      syncProposedPanel();
      setTimeout(() => notifyProposedLoadsIfNeeded?.(), 0);
    } else {
      state.futurePanelOpen = true;
      syncFuturePanel();
      syncFutureButton?.();
    }
  }

  function renderQueueAddControlV312(target) {
    if (!["spedytor", "kierownik", "admin"].includes(state.user?.role)) return "";
    const normalizedTarget = target === "proposed" ? "proposed" : "future";
    return `<div class="queue-import-actions"><button class="btn btn-dark" type="button" data-queue-add="${normalizedTarget}" onclick="openTextImport(event,'${normalizedTarget}')">+ Dodaj relację</button></div>`;
  }

  function renderTextImportModalV312() {
    const aiBusy = Boolean(state.aiAnalyzerBusyKind);
    const textBusy = state.aiAnalyzerBusyKind === "text";
    const targetLabel = state.aiImportTarget === "proposed" ? "Wolne ładunki" : "Planowane relacje";
    return `
      <div class="pdf-import-backdrop text-import-backdrop" onclick="closeTextImportOnBackdrop(event)">
        <section class="pdf-import-modal ai-quick-text-v312" onclick="event.stopPropagation()" aria-label="Dodawanie relacji z tekstu">
          <div class="pdf-import-head">
            <div>
              <h2>Dodaj relację</h2>
              <div class="small">Docelowo: ${esc(targetLabel)}</div>
            </div>
            <button class="btn" type="button" onclick="closeTextImport()">Zamknij</button>
          </div>
          <div class="pdf-import-body">
            <label class="field-label" style="margin-top:0;">Wklej tekst</label>
            <textarea id="text-import-orders" class="textarea" style="min-height:240px;" ${aiBusy ? "disabled" : ""}>${esc(state.textImportText || "")}</textarea>
            ${state.textImportStatus ? `<div class="pdf-import-status ${state.textImportWarning ? "warning" : ""}">${esc(state.textImportStatus)}</div>` : ""}
          </div>
          <div class="pdf-import-foot">
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn" type="button" onclick="closeTextImport()">Anuluj</button>
              <button class="btn btn-ai-action" type="button" ${aiBusy ? "disabled" : ""} onclick="analyzeTextOrdersToQueue()">${textBusy ? "Analizuję…" : "Analizuj tekst"}</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  async function analyzeTextOrdersToQueueV312() {
    const textValue = saveTextImportState();
    if (!textValue) {
      showAppMessage("Brak tekstu", "Najpierw wprowadź tekst relacji.");
      return;
    }
    if (state.aiAnalyzerBusyKind) return;

    const target = state.aiImportTarget === "proposed" ? "proposed" : "future";
    let parsed = [];
    state.textImportStatus = "Analizuję tekst…";
    state.textImportWarning = false;
    state.aiAnalyzerReadyKind = "";
    setAiAnalyzerBusy("text");

    try {
      if (EMBEDDED_MODE) {
        const payload = await requestAiAnalyzer("text", {
          text: textValue,
          date: state.reportDate || currentAppDate()
        }, 130000);
        parsed = normalizeTextOrderAnalysis(payload, textValue).map(item => ({
          ...item,
          aiSourceText: textValue,
          aiSourceType: "text"
        }));
      } else {
        parsed = localTextOrderParser(textValue).map(item => ({
          ...item,
          aiSourceText: textValue,
          aiSourceType: "text"
        }));
      }
    } catch (error) {
      const reason = aiFailureReason(error);
      parsed = localTextOrderParser(textValue).map(item => ({
        ...item,
        aiSourceText: textValue,
        aiSourceType: "text-fallback"
      }));
      if (!parsed.length) {
        state.textImportStatus = `Nie udało się przeanalizować tekstu: ${reason}.`;
        state.textImportWarning = true;
        state.aiAnalyzerStatus = "error";
        showAppMessage("Błąd analizy", reason, "error");
        syncTextImportUi();
        return;
      }
    } finally {
      setAiAnalyzerBusy("");
    }

    if (!parsed.length) {
      state.textImportStatus = "AI nie rozpoznało poprawnej relacji. Uzupełnij miejsce załadunku i rozładunku.";
      state.textImportWarning = true;
      state.aiAnalyzerStatus = "error";
      showAppMessage("Nie rozpoznano relacji", "Uzupełnij tekst o miejsce załadunku i rozładunku.");
      syncTextImportUi();
      return;
    }

    const prepared = parsed
      .map(item => {
        const local = localTextOrderParser(textValue);
        if (parsed.length === 1 && local.length === 1 && Number(local[0].rate) > 0) return { ...item, rate: local[0].rate };
        return item;
      })
      .map(item => markUnknownDates(item, textValue))
      .filter(item => item.load && item.unload)
      .map((item, index) => queueRouteFromText(item, index, target, textValue));

    if (!prepared.length) {
      state.textImportStatus = "Nie znaleziono relacji z kompletnym załadunkiem i rozładunkiem.";
      state.textImportWarning = true;
      showAppMessage("Nie dodano relacji", "Brakuje miejsca załadunku lub rozładunku.", "error");
      syncTextImportUi();
      return;
    }

    persistQuickRoutes(prepared, target);

    state.textImportPreview = [];
    state.textImportBatch = [];
    state.textImportBatchIndex = 0;
    state.aiAnalyzerReadyKind = "";
    state.aiAnalyzerStatus = "paused";
    state.textImportWarning = false;
    state.textImportStatus = "";
    state.textImportText = "";
    state.textImportOpen = false;
    syncTextImportUi();

    const unknownCount = prepared.filter(route => route.dateUnknown).length;
    const noun = prepared.length === 1 ? "relację" : "relacje";
    const place = target === "proposed" ? "Wolnych ładunków" : "Planowanych relacji";
    showAppMessage(
      "Dodano relację",
      `Dodano ${prepared.length} ${noun} do ${place}.${unknownCount ? ` ${unknownCount} ${unknownCount === 1 ? "pozycja nie ma daty" : "pozycji nie ma daty"} — można ją uzupełnić na karcie.` : ""}`,
      "success"
    );
  }

  function decorateUnknownDateCard(html, route) {
    if (!route?.dateUnknown) return html;
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const card = template.content.firstElementChild;
    if (!card) return html;

    let line = card.querySelector(".queue-dates-visible-v309");
    if (!line) {
      line = document.createElement("div");
      line.className = "queue-dates-visible-v309 queue-date-unknown-v312";
      const title = card.querySelector(".future-card-title,.proposed-load-title");
      if (title) title.insertAdjacentElement("afterend", line);
      else card.prepend(line);
    }
    line.classList.add("queue-date-unknown-v312");
    const canEditDates = !route.archived && state.user && state.user.role !== "rozliczenia" && String(route.createdBy || "") === String(state.user.login || "") && state.user.login;
    const pencil = field => canEditDates
      ? `<button type="button" class="queue-date-pencil-v318" title="Uzupełnij datę ${field === "load" ? "załadunku" : "rozładunku"}" aria-label="Uzupełnij datę ${field === "load" ? "załadunku" : "rozładunku"}" onclick="event.preventDefault();event.stopPropagation();const form=this.closest('.future-card,.proposed-load-card')?.querySelector('.queue-date-edit-v314');if(form){form.hidden=false;form.querySelector('[data-queue-date-field=${field}]')?.focus()}">✎</button>`
      : "";
    line.innerHTML = `<span><strong>Załadunek: </strong><span class="queue-dates-value">${UNKNOWN_DATE}</span>${pencil("load")}</span><span><strong>Rozładunek: </strong><span class="queue-dates-value">${UNKNOWN_DATE}</span>${pencil("unload")}</span>`;

    card.querySelectorAll(".future-card-meta,.proposed-load-dates").forEach(node => {
      if (/Data relacji:|Załadunek:|Rozładunek:/i.test(String(node.textContent || ""))) {
        node.innerHTML = node.innerHTML
          .replace(/Data relacji:\s*<b>[^<]*<\/b>/i, `Data relacji: <b>${UNKNOWN_DATE}</b>`)
          .replace(/Załadunek:\s*[^·<]*/i, `Załadunek: ${UNKNOWN_DATE} `)
          .replace(/Rozładunek:\s*[^·<]*/i, `Rozładunek: ${UNKNOWN_DATE} `);
      }
    });

    return template.innerHTML;
  }

  function installV312() {
    if (window.__topDragonAiQuickQueueV312) return true;
    if (typeof state === "undefined"
      || typeof renderQueueAddControl !== "function"
      || typeof renderTextImportModal !== "function"
      || typeof analyzeTextOrdersToQueue !== "function"
      || typeof createProposedLoadFromTextItem !== "function"
      || typeof syncCentralLoadQueueDiff !== "function"
      || typeof renderFutureRouteCard !== "function"
      || typeof renderProposedLoadCard !== "function") return false;

    window.__topDragonAiQuickQueueV312 = true;

    const previousFutureCard = renderFutureRouteCard;
    const previousProposedCard = renderProposedLoadCard;

    renderQueueAddControl = renderQueueAddControlV312;
    renderTextImportModal = renderTextImportModalV312;
    analyzeTextOrdersToQueue = analyzeTextOrdersToQueueV312;
    window.analyzeTextOrdersToQueue = analyzeTextOrdersToQueueV312;

    renderFutureRouteCard = function (route) {
      return decorateUnknownDateCard(previousFutureCard.apply(this, arguments), route);
    };
    renderProposedLoadCard = function (route) {
      return decorateUnknownDateCard(previousProposedCard.apply(this, arguments), route);
    };

    const style = document.createElement("style");
    style.id = "ai-quick-text-v312-style";
    style.textContent = [
      ".ai-quick-text-v312{width:min(620px,calc(100vw - 24px))}",
      ".ai-quick-text-v312 .pdf-import-body{display:grid;gap:10px}",
      ".queue-date-unknown-v312{border-color:#f59e0b!important;background:#fffbeb!important;color:#92400e!important}",
      ".app.dark-mode .queue-date-unknown-v312{border-color:#b45309!important;background:#451a03!important;color:#fde68a!important}",
      ".queue-date-unknown-v312>span{display:inline-flex;align-items:center;gap:3px}"
    ].join("\n");
    document.head.appendChild(style);

    state.queueAddMenuTarget = "";
    if (state.proposedPanelOpen) syncProposedPanel();
    if (state.futurePanelOpen) syncFuturePanel();
    return true;
  }

  if (!installV312()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installV312() || attempts >= 60) clearInterval(timer);
    }, 100);
  }
})();
