(function () {
  "use strict";
  if (window.__topDragonQueueDatesV309) return;

  const STYLE_ID = "queue-dates-v309-style";
  let pendingSave = null;

  function toIso(value) {
    const date = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  }

  function formatDay(value) {
    const iso = toIso(value);
    return iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4) : "Brak daty";
  }

  function formatHour(value) {
    const hour = Number(value);
    return Number.isFinite(hour) ? String(Math.max(0, Math.min(24, Math.floor(hour)))).padStart(2, "0") + ":00" : "";
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".queue-dates-visible-v309{display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;margin-top:4px;padding:4px 6px;border:1px solid #d9e2ed;border-radius:7px;background:#f1f5f9;color:#1e293b;font-size:11px;font-weight:700;line-height:1.3}",
      ".queue-dates-visible-v309 strong{font-weight:900;color:#0f172a}",
      ".queue-dates-visible-v309 .queue-dates-value{font-variant-numeric:tabular-nums;font-weight:850;white-space:nowrap}",
      ".app.dark-mode .queue-dates-visible-v309{background:#1e293b;color:#e2e8f0;border-color:#475569}",
      ".app.dark-mode .queue-dates-visible-v309 strong{color:#f8fafc}",
      ".queue-date-pencil-v318{display:inline-grid;place-items:center;width:23px;height:23px;padding:0;border:1px solid #d97706;border-radius:6px;background:#fff7ed;color:#9a3412;font-size:15px;font-weight:900;line-height:1;cursor:pointer}",
      ".queue-date-pencil-v318:hover{background:#ffedd5}",
      ".app.dark-mode .queue-date-pencil-v318{border-color:#f59e0b;background:#451a03;color:#fde68a}",
      ".queue-date-edit-v314{display:flex;flex-wrap:wrap;align-items:end;gap:6px;margin-top:4px;padding:5px 6px;border-top:1px solid var(--border,#cbd5e1)}",
      ".queue-date-edit-v314[hidden]{display:none}",
      ".queue-date-edit-v314 label{display:grid;gap:3px;font-size:11px;font-weight:700}",
      ".queue-date-edit-v314 input{min-width:0;padding:5px;border:1px solid var(--border,#cbd5e1);border-radius:7px;background:var(--card,#fff);color:var(--text,#0f172a)}",
      ".future-drawer-body,.proposed-drawer-body{padding:8px!important;gap:5px!important}",
      ".future-drawer-body .future-card,.proposed-drawer-body .future-card{padding:6px!important;gap:4px!important;border-radius:9px!important}",
      ".future-drawer-body .future-card-actions,.proposed-drawer-body .future-card-actions{gap:4px!important}",
      ".future-drawer-body .proposed-load-owner-actions,.proposed-drawer-body .proposed-load-owner-actions{gap:4px!important;margin-top:2px!important}",
      ".future-drawer-body .btn-mini,.proposed-drawer-body .btn-mini{padding:4px 7px;min-height:26px}",
      ".queue-date-range-control-v309{display:grid;gap:8px;margin:10px 0 12px;padding:12px;border:1px solid var(--border,#d6dbe3);border-radius:12px;background:var(--card,#fff)}",
      ".queue-date-range-control-v309 .queue-range-toggle{display:flex;align-items:center;gap:8px;font-weight:750;cursor:pointer;font-size:13px}",
      ".queue-date-range-control-v309 .queue-range-toggle input{width:18px;height:18px;accent-color:#0e7490}",
      ".queue-date-range-control-v309 .queue-date-range-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      ".queue-date-range-control-v309 .queue-date-range-fields[hidden]{display:none}",
      ".queue-date-range-control-v309 .queue-date-range-fields label{display:grid;gap:5px;font-weight:700;font-size:12px;color:var(--text,#0f172a)}",
      ".queue-date-range-control-v309 input[type=date]{min-width:0;width:100%;padding:8px;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:var(--card,#fff);color:var(--text,#0f172a);font-size:14px}",
      "@media(max-width:460px){.queue-date-range-control-v309 .queue-date-range-fields{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function visibleDates(route) {
    const date = toIso(route && (route.date || route.loadDate)) || "";
    const from = toIso(route && route.loadDateWindowFrom) || date;
    const to = toIso(route && route.loadDateWindowTo);
    const unload = toIso(route && route.endDate);
    const startText = from && to && to > from ? formatDay(from) + " – " + formatDay(to) : formatDay(from);
    return {
      load: startText,
      unload: formatDay(unload),
      loadHour: from ? formatHour(route && route.startHour) : "",
      unloadHour: unload ? formatHour(route && route.endHour) : ""
    };
  }

  function decorateQueueCard(html, route) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const card = template.content.querySelector(".future-card, .proposed-load-card");
    const title = card && card.querySelector(".future-card-title");
    if (!title || title.parentNode.querySelector(".queue-dates-visible-v309")) return html;

    const dates = visibleDates(route);
    const line = document.createElement("div");
    line.className = "queue-dates-visible-v309";
    const load = document.createElement("span");
    const loadLabel = document.createElement("strong");
    loadLabel.textContent = "Załadunek: ";
    const loadDate = document.createElement("span");
    loadDate.className = "queue-dates-value";
    loadDate.textContent = dates.load;
    load.append(loadLabel, loadDate);
    if (dates.loadHour) load.append(" · " + dates.loadHour);
    const unload = document.createElement("span");
    const unloadLabel = document.createElement("strong");
    unloadLabel.textContent = "Rozładunek: ";
    const unloadDate = document.createElement("span");
    unloadDate.className = "queue-dates-value";
    unloadDate.textContent = dates.unload;
    unload.append(unloadLabel, unloadDate);
    if (dates.unloadHour) unload.append(" · " + dates.unloadHour);
    line.append(load, unload);
    title.insertAdjacentElement("afterend", line);

    if (route && !route.archived && state.user && state.user.role !== "rozliczenia" && String(route.createdBy || "") === String(state.user.login || "") && state.user.login) {
      const kind = route.proposedLoad ? "proposed" : "future";
      const form = document.createElement("div");
      form.className = "queue-date-edit-v314";
      form.hidden = true;
      form.setAttribute("onclick", "event.stopPropagation()");
      form.setAttribute("ondragstart", "event.stopPropagation()");
      [["Załadunek", "load", toIso(route.loadDate || route.date)], ["Rozładunek", "unload", toIso(route.endDate)]].forEach(([labelText, field, value]) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "date";
        input.dataset.queueDateField = field;
        input.value = value;
        input.setAttribute("value", value);
        input.setAttribute("onchange", `saveQueueDateV314(event, ${JSON.stringify(kind)}, ${JSON.stringify(String(route.id))}, ${JSON.stringify(field)})`);
        label.appendChild(input);
        form.appendChild(label);
      });
      line.insertAdjacentElement("afterend", form);
      const addPencil = (host, field, missing) => {
        if (!missing) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "queue-date-pencil-v318";
        button.textContent = "✎";
        button.title = `Uzupełnij datę ${field === "load" ? "załadunku" : "rozładunku"}`;
        button.setAttribute("aria-label", button.title);
        button.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          form.hidden = false;
          form.querySelector(`[data-queue-date-field="${field}"]`)?.focus();
        };
        host.appendChild(button);
      };
      addPencil(load, "load", !toIso(route.loadDate || route.date));
      addPencil(unload, "unload", !toIso(route.endDate));
      if (toIso(route.loadDate || route.date) && toIso(route.endDate)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "queue-date-pencil-v318";
        button.textContent = "✎";
        button.title = "Edytuj daty";
        button.setAttribute("aria-label", "Edytuj daty");
        button.onclick = event => { event.preventDefault(); event.stopPropagation(); form.hidden = !form.hidden; };
        line.appendChild(button);
      }
    }

    const existingDates = card.querySelector(".proposed-load-dates");
    if (existingDates) existingDates.remove();
    const meta = Array.from(card.querySelectorAll(".future-card-meta")).find(node => /^Data relacji:/i.test(String(node.textContent || "").trim()));
    if (meta) {
      meta.innerHTML = meta.innerHTML.replace(/^\s*Data relacji:\s*<b>[^<]*<\/b>\s*·\s*/i, "");
    }
    return template.innerHTML;
  }

  function saveQueueDate(event, kind, id, field) {
    event?.stopPropagation?.();
    const routes = kind === "proposed" ? state.proposedLoads : kind === "future" ? state.futureRoutes : [];
    const route = (routes || []).find(item => String(item.id) === String(id));
    if (!route || route.archived || !state.user?.login || state.user.role === "rozliczenia" || route.createdBy !== state.user.login || !["load", "unload"].includes(field)) return;
    const raw = String(event.target.value || "");
    const value = toIso(raw);
    if (raw && !value) return;
    const load = field === "load" ? value : toIso(route.loadDate || route.date);
    const unload = field === "unload" ? value : toIso(route.endDate);
    if (load && unload && unload < load) {
      event.target.value = field === "load" ? toIso(route.loadDate || route.date) : toIso(route.endDate);
      showAppMessage("Nieprawidłowe daty", "Data rozładunku nie może być wcześniejsza niż data załadunku.", "error");
      return;
    }
    if (field === "load") {
      route.date = value;
      route.loadDate = value;
      route.loadDateWindowFrom = "";
      route.loadDateWindowTo = "";
    } else route.endDate = value;
    route.dateUnknown = !load && !unload;
    route.dateDisplay = "";
    route.updatedAt = new Date().toISOString();
    route._centralLocalCreatedAt = Date.now();
    syncCentralLoadQueueDiff();
    scheduleCentralLoadQueueDiff(0);
    if (kind === "proposed") syncProposedPanel(); else syncFuturePanel();
    const attribute = kind === "proposed" ? "data-proposed-id" : "data-future-id";
    const card = Array.from(document.querySelectorAll(`[${attribute}]`)).find(node => node.getAttribute(attribute) === String(id));
    const form = card?.querySelector(".queue-date-edit-v314");
    if (form) {
      form.hidden = false;
      form.previousElementSibling?.setAttribute("aria-expanded", "true");
    }
  }

  function addRangeToModal(html) {
    const prefill = state.prefill || {};
    if (!prefill.futureQueue && !prefill.proposedLoad) return html;
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const form = template.content.querySelector(".route-details-add-form");
    const anchor = form && form.querySelector("#new-date");
    if (!anchor) return html;
    const dateLabel = anchor.previousElementSibling;
    if (dateLabel && dateLabel.classList.contains("map-date-nav")) {
      const label = dateLabel.previousElementSibling;
      if (label && label.classList.contains("field-label")) label.textContent = "Data załadunku";
    }

    const from = toIso(prefill.loadDateWindowFrom) || toIso(prefill.date) || currentAppDate();
    const to = toIso(prefill.loadDateWindowTo) || addDaysToIso(from, 1);
    const enabled = Boolean(toIso(prefill.loadDateWindowFrom) && toIso(prefill.loadDateWindowTo));
    const block = document.createElement("section");
    block.className = "queue-date-range-control-v309";
    block.innerHTML = '<label class="queue-range-toggle"><input id="queue-load-range-enabled-v309" type="checkbox"> Przedział dat załadunku (opcjonalnie)</label>' +
      '<div class="queue-date-range-fields" id="queue-load-range-fields-v309" hidden>' +
      '<label>Od<input id="queue-load-range-from-v309" type="date"></label>' +
      '<label>Do<input id="queue-load-range-to-v309" type="date"></label>' +
      '</div>';
    block.querySelector("#queue-load-range-enabled-v309").checked = enabled;
    block.querySelector("#queue-load-range-from-v309").value = from;
    block.querySelector("#queue-load-range-to-v309").value = to;
    block.querySelector("#queue-load-range-fields-v309").hidden = !enabled;
    block.querySelectorAll("input").forEach(input => {
      input.setAttribute("onchange", "updateQueueRangeFormV309()");
      if (input.type === "date") input.setAttribute("oninput", "updateQueueRangeFormV309()");
    });
    anchor.insertAdjacentElement("afterend", block);
    return template.innerHTML;
  }

  function updateQueueRangeForm() {
    const checked = Boolean(document.getElementById("queue-load-range-enabled-v309")?.checked);
    const fields = document.getElementById("queue-load-range-fields-v309");
    const from = toIso(document.getElementById("queue-load-range-from-v309")?.value);
    const to = toIso(document.getElementById("queue-load-range-to-v309")?.value);
    if (fields) fields.hidden = !checked;
    if (!state.prefill) return;
    state.prefill.loadDateWindowFrom = checked ? from : "";
    state.prefill.loadDateWindowTo = checked ? to : "";
    if (checked && from && state.prefill.date !== from) {
      updateNewRouteDateFromInput(from);
      const input = document.getElementById("new-date");
      if (input) input.value = from;
      const display = document.querySelector(".route-details-add-form .map-date-display");
      if (display) display.value = formatDateForInput(from);
    }
  }

  function updateBeforeQueueSync() {
    if (!pendingSave) return;
    const queue = pendingSave.kind === "proposed" ? (state.proposedLoads || []) : (state.futureRoutes || []);
    const matches = queue.filter(route => {
      if (!route || route.archived) return false;
      if (pendingSave.editId) return String(route.id) === pendingSave.editId;
      return !pendingSave.before.has(String(route.id));
    });
    matches.forEach(route => {
      if (pendingSave.enabled) {
        route.loadDateWindowFrom = pendingSave.from;
        route.loadDateWindowTo = pendingSave.to;
        route.date = pendingSave.from;
      } else {
        delete route.loadDateWindowFrom;
        delete route.loadDateWindowTo;
      }
      route.dateUnknown = !toIso(route.loadDate || route.date) && !toIso(route.endDate);
      route.dateDisplay = "";
    });
  }

  function install() {
    if (window.__topDragonQueueDatesV309) return true;
    if (typeof renderAddModal !== "function" ||
        typeof renderFutureRouteCard !== "function" ||
        typeof renderProposedLoadCard !== "function" ||
        typeof saveNewRoute !== "function" ||
        typeof syncCentralLoadQueueDiff !== "function" ||
        typeof state === "undefined") return false;

    window.__topDragonQueueDatesV309 = true;
    window.updateQueueRangeFormV309 = updateQueueRangeForm;
    window.saveQueueDateV314 = saveQueueDate;
    injectStyle();

    const previousFutureCard = renderFutureRouteCard;
    renderFutureRouteCard = function (route) {
      return decorateQueueCard(previousFutureCard.apply(this, arguments), route);
    };
    const previousProposedCard = renderProposedLoadCard;
    renderProposedLoadCard = function (route) {
      return decorateQueueCard(previousProposedCard.apply(this, arguments), route);
    };
    const previousAddModal = renderAddModal;
    renderAddModal = function () {
      return addRangeToModal(previousAddModal.apply(this, arguments));
    };
    const previousSyncQueue = syncCentralLoadQueueDiff;
    syncCentralLoadQueueDiff = function () {
      updateBeforeQueueSync();
      return previousSyncQueue.apply(this, arguments);
    };
    const previousSave = saveNewRoute;
    saveNewRoute = async function (event) {
      const proposedMode = Boolean(state.prefill && state.prefill.proposedLoad);
      const futureMode = Boolean(state.prefill && state.prefill.futureQueue);
      if (!proposedMode && !futureMode) return previousSave.apply(this, arguments);
      const enabled = Boolean(document.getElementById("queue-load-range-enabled-v309")?.checked);
      const from = toIso(document.getElementById("queue-load-range-from-v309")?.value);
      const to = toIso(document.getElementById("queue-load-range-to-v309")?.value);
      if (enabled && (!from || !to || to < from)) {
        event?.preventDefault?.();
        showAppMessage("Nieprawidłowy przedział", "Wybierz poprawne daty załadunku: data „Do” nie może być wcześniejsza niż data „Od”.");
        return;
      }
      pendingSave = {
        kind: proposedMode ? "proposed" : "future",
        editId: String((proposedMode ? state.proposedEditId : state.futureEditId) || ""),
        enabled: enabled,
        from: from,
        to: to,
        before: new Set(((proposedMode ? state.proposedLoads : state.futureRoutes) || []).map(item => String(item.id)))
      };
      if (enabled && from) {
        const currentDateInput = document.getElementById("new-date");
        if (currentDateInput) currentDateInput.value = from;
      }
      try {
        return await previousSave.apply(this, arguments);
      } finally {
        pendingSave = null;
      }
    };

    try {
      if (state.futurePanelOpen && typeof syncFuturePanel === "function") syncFuturePanel();
      if (state.proposedPanelOpen && typeof syncProposedPanel === "function") syncProposedPanel();
    } catch (error) {
      console.warn("Nie udało się odświeżyć kart dat po aktywacji:", error);
    }
    return true;
  }

  if (!install()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 50) clearInterval(interval);
    }, 100);
  }
})();
