(function () {
  "use strict";
  if (window.__topDragonRouteOptimizationV311) return;

  var MAX_ROUTES = 160;
  var FUTURE_DAYS = 45;
  var PAIR_MAX_DAY_GAP = 1;

  function iso(value) {
    var text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function futureRouteSetV311() {
    var today = currentAppDate();
    var horizon = addDaysToIso(today, FUTURE_DAYS);
    var includeSampleRoutes = typeof isAdminUser === "function" && isAdminUser();
    var ordered = activeRoutes()
      .filter(function (route) {
        if (!route || route.futureQueue || (!includeSampleRoutes && route.sampleRelationV167) || isFreeDayRoute(route)) return false;
        if (!route.driverId || (!route.load && !(route.orderStops || []).some(function (stop) { return stop && stop.type === "pickup"; }))) return false;
        if (route.approvalStatus === "rejected") return false;
        var date = iso(route.date);
        return Boolean(date && date >= today && date <= horizon);
      })
      .map(function (route) { return { route: route, start: routeGlobalStart(route) }; })
      .sort(function (a, b) {
        return a.start - b.start || String(a.route.id).localeCompare(String(b.route.id));
      });
    var selected = [];
    for (var item of ordered) {
      if (!routeSwapEndpoint(item.route, "pickup")) continue;
      selected.push(item.route);
      if (selected.length === MAX_ROUTES) break;
    }
    return selected;
  }

  function scoreV311(item) {
    var saving = Math.max(0, Number(item && item.savingKm || 0));
    var percent = Math.max(0, Number(item && item.savingPercent || 0));
    var date = iso(item && item.date) || currentAppDate();
    var daysAhead = Math.max(0, isoDayDifference(currentAppDate(), date));
    return saving + percent * 1.7 - Math.min(20, daysAhead * 0.35);
  }

  function routeLabelV311(route) {
    var load = routeSwapEndpointLabel(route, "pickup"), unload = routeSwapEndpointLabel(route, "delivery");
    return (displayCity(load) || load || "-") + " → " + (displayCity(unload) || unload || "-");
  }

  async function buildSuggestionsV311(routes, isCurrent) {
    routes = routes || futureRouteSetV311();
    isCurrent = isCurrent || function () { return true; };
    var routeTimes = new WeakMap();
    var realPlan = routeSwapDriverBuckets(false);
    var samplePlan = routeSwapDriverBuckets(true);

    var candidates = [];
    var sliceStarted = performance.now();

    for (var left = 0; left < routes.length; left += 1) {
      // Instalowany dodatek musi także oddawać sterowanie przeglądarce.
      // Krótkie porcje pozwalają klikać plan podczas obliczeń w tle.
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
      sliceStarted = performance.now();
      if (!isCurrent()) return [];
      var first = routes[left];
      var routesByDriver = first.sampleRelationV167 ? samplePlan : realPlan;
      var firstDriver = driverById(first.driverId);
      var firstDispatcher = routeDispatcherLogin(first);
      if (!firstDriver || !firstDispatcher) continue;

      for (var right = left + 1; right < routes.length; right += 1) {
        if ((right - left) % 5 === 0) {
          if (performance.now() - sliceStarted >= 6) {
            await new Promise(function (resolve) { setTimeout(resolve, 0); });
            sliceStarted = performance.now();
          }
          if (!isCurrent()) return [];
        }
        var second = routes[right];
        if (Boolean(first.sampleRelationV167) !== Boolean(second.sampleRelationV167)) continue;
        if (first.driverId === second.driverId) continue;

        var firstDate = iso(first.date);
        var secondDate = iso(second.date);
        if (!firstDate || !secondDate) continue;
        if (Math.abs(isoDayDifference(firstDate, secondDate)) > PAIR_MAX_DAY_GAP) continue;

        var secondDriver = driverById(second.driverId);
        var secondDispatcher = routeDispatcherLogin(second);
        if (!secondDriver || !secondDispatcher || firstDispatcher === secondDispatcher) continue;

        var ignoredIds = new Set([first.id, second.id]);
        if (!routeSwapDriverCanCover(firstDriver, second, routesByDriver, ignoredIds, routeTimes)) continue;
        if (!routeSwapDriverCanCover(secondDriver, first, routesByDriver, ignoredIds, routeTimes)) continue;

        var cost = routeSwapChangeCost(firstDriver, first, secondDriver, second, routesByDriver, routeTimes);
        var saving = routeSwapSaving(cost.currentKm, cost.candidateKm);
        if (!saving) continue;

        candidates.push({
          kind: "swap",
          id: [first.id, second.id].sort().join("::"),
          date: [firstDate, secondDate].sort()[0],
          firstDate: firstDate,
          secondDate: secondDate,
          firstRouteId: first.id,
          secondRouteId: second.id,
          firstDriverId: firstDriver.id,
          secondDriverId: secondDriver.id,
          firstDriver: firstDriver.driver,
          secondDriver: secondDriver.driver,
          firstDispatcher: firstDispatcher,
          secondDispatcher: secondDispatcher,
          firstRoute: routeLabelV311(first),
          secondRoute: routeLabelV311(second),
          sampleOptimization: Boolean(first.sampleRelationV167 || second.sampleRelationV167),
          currentKm: saving.currentKm,
          swappedKm: saving.swappedKm,
          savingKm: saving.savingKm,
          savingPercent: saving.savingPercent
        });
      }
    }

    for (var route of routes) {
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
      sliceStarted = performance.now();
      if (!isCurrent()) return [];
      var routesByDriver = route.sampleRelationV167 ? samplePlan : realPlan;
      var currentDriver = driverById(route.driverId);
      var currentDispatcher = routeDispatcherLogin(route);
      if (!currentDriver || !currentDispatcher) continue;

      var ignoredIds = new Set([route.id]);
      var currentPosition = routeSwapPosition(currentDriver, route, routesByDriver, ignoredIds, routeTimes);
      var currentKm = routeSwapDistance(currentPosition, route);
      if (!Number.isFinite(currentKm)) continue;

      var best = null;
      var candidateIndex = 0;
      for (var candidate of operationalDrivers()) {
        if (candidateIndex++ % 5 === 0) {
          if (performance.now() - sliceStarted >= 6) {
            await new Promise(function (resolve) { setTimeout(resolve, 0); });
            sliceStarted = performance.now();
          }
          if (!isCurrent()) return [];
        }
        if (!candidate || candidate.id === currentDriver.id) continue;
        if (String(candidate.dispatcher || "") === currentDispatcher) continue;
        if (!routeSwapDriverCanCover(candidate, route, routesByDriver, ignoredIds, routeTimes)) continue;

        var cost = routeSwapChangeCost(currentDriver, route, candidate, null, routesByDriver, routeTimes);
        var saving = routeSwapSaving(cost.currentKm, cost.candidateKm);
        if (!saving) continue;

        var score = saving.savingKm + saving.savingPercent;
        if (!best || score > best.score) {
          best = {
            candidate: candidate,
            currentKm: saving.currentKm,
            candidateKm: saving.swappedKm,
            savingKm: saving.savingKm,
            savingPercent: saving.savingPercent,
            score: score
          };
        }
      }

      if (!best) continue;
      var date = iso(route.date);
      candidates.push({
        kind: "reassign",
        id: String(route.id) + "::" + String(best.candidate.id),
        date: date,
        firstDate: date,
        secondDate: "",
        firstRouteId: route.id,
        secondRouteId: "",
        firstDriverId: currentDriver.id,
        secondDriverId: best.candidate.id,
        firstDriver: currentDriver.driver,
        secondDriver: best.candidate.driver,
        firstDispatcher: currentDispatcher,
        secondDispatcher: String(best.candidate.dispatcher || ""),
        firstRoute: routeLabelV311(route),
        secondRoute: "",
        sampleOptimization: Boolean(route.sampleRelationV167),
        currentKm: best.currentKm,
        swappedKm: best.candidateKm,
        savingKm: best.savingKm,
        savingPercent: best.savingPercent
      });
    }

    candidates.sort(function (a, b) {
      return scoreV311(b) - scoreV311(a)
        || String(a.date).localeCompare(String(b.date))
        || String(a.id).localeCompare(String(b.id));
    });

    var usage = new Map();
    var selected = [];
    candidates.forEach(function (item) {
      if (selected.length >= 12) return;
      var ids = [item.firstRouteId, item.secondRouteId].filter(Boolean).map(String);
      if (ids.some(function (id) { return (usage.get(id) || 0) >= 2; })) return;
      selected.push(item);
      ids.forEach(function (id) { usage.set(id, (usage.get(id) || 0) + 1); });
    });

    // Pokazujemy rzeczywiste punkty dolotu dla proponowanego przydziału,
    // żeby użytkownik mógł sprawdzić, skąd wzięły się kilometry.
    selected.forEach(function (item) {
      var plan = item.sampleOptimization ? samplePlan : realPlan;
      var ignored = new Set([item.firstRouteId, item.secondRouteId].filter(Boolean));
      var firstRoute = routes.find(function (route) { return route.id === item.firstRouteId; });
      var secondRoute = routes.find(function (route) { return route.id === item.secondRouteId; });
      function approach(driverId, route) {
        var driver = driverById(driverId);
        if (!driver || !route) return null;
        var position = routeSwapPosition(driver, route, plan, ignored, routeTimes);
        var km = routeSwapDistance(position, route);
        if (!position || !position.route || !Number.isFinite(km)) return null;
        return { driver:driver.driver, from:routeSwapEndpointLabel(position.route, "delivery"),
          to:routeSwapEndpointLabel(route, "pickup"), km:Math.round(km) };
      }
      item.approaches = [approach(item.secondDriverId, firstRoute),
        item.kind === "swap" ? approach(item.firstDriverId, secondRoute) : null].filter(Boolean);
    });

    return selected;
  }

  function routeByIdV311(routeId) {
    var id = String(routeId || "");
    return activeRoutes().find(function (route) { return String(route && route.id || "") === id; })
      || state.routes.find(function (route) { return String(route && route.id || "") === id; })
      || null;
  }

  function dateTextV311(value) {
    var date = iso(value);
    return date ? formatDateForInput(date) : "—";
  }

  function routeDateLabelV311(item) {
    var first = iso(item && (item.firstDate || item.date));
    var second = iso(item && item.secondDate);
    if (first && second && first !== second) return dateTextV311(first) + " – " + dateTextV311(second);
    return dateTextV311(first || second);
  }

  function injectStylesV311() {
    if (document.getElementById("route-optimization-v311-style")) return;
    var style = document.createElement("style");
    style.id = "route-optimization-v311-style";
    style.textContent = [
      ".route-swap-saving small{color:var(--muted);font-size:9px;font-weight:800}",
      ".route-swap-date-v311{flex:0 0 auto;padding:4px 7px;border:1px solid #bae6fd;border-radius:999px;background:#ecfeff;color:#155e75;font-size:10px;font-weight:950;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".route-swap-routes-v311{display:grid;gap:4px;padding-top:7px;border-top:1px solid var(--border)}",
      ".route-swap-route-v311{display:flex;align-items:center;gap:7px;min-width:0;color:var(--muted);font-size:10px;font-weight:700;line-height:1.25}",
      ".route-swap-route-v311 b{flex:0 0 auto;color:#0e7490;font-size:9px;font-variant-numeric:tabular-nums}",
      ".route-swap-route-v311 span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".route-swap-sample-v317{display:inline-flex;align-items:center;padding:3px 6px;border:1px solid #f59e0b;border-radius:999px;background:#fffbeb;color:#92400e;font-size:9px;font-weight:950;letter-spacing:.04em}",
      ".route-swap-offscreen-arrow-v311{position:fixed;z-index:7422;width:min(260px,calc(100vw - 24px));display:grid;grid-template-columns:36px 1fr;grid-template-rows:auto auto;align-items:center;column-gap:8px;padding:8px 10px;border:1px solid #67b9c8;border-radius:12px;background:#083344;color:#ecfeff;box-shadow:0 8px 24px rgba(8,51,68,.32);pointer-events:none}",
      ".route-swap-offscreen-arrow-v311>strong{grid-row:1/3;display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:#0e7490;color:#fff;font-size:25px;line-height:1;animation:routeSwapOffscreenV311 .8s ease-in-out infinite alternate}",
      ".route-swap-offscreen-arrow-v311>span{overflow:hidden;font-size:11px;font-weight:900;text-overflow:ellipsis;white-space:nowrap}",
      ".route-swap-offscreen-arrow-v311>small{color:#a5f3fc;font-size:9px;font-weight:800}",
      ".app.dark-mode .route-swap-date-v311{border-color:#155e75;background:#083344;color:#a5f3fc}",
      ".app.dark-mode .route-swap-route-v311 b{color:#67e8f9}",
      ".app.dark-mode .route-swap-sample-v317{border-color:#b45309;background:#451a03;color:#fde68a}",
      "@keyframes routeSwapOffscreenV311{from{transform:translateY(-2px)}to{transform:translateY(2px)}}",
      "@media(prefers-reduced-motion:reduce){.route-swap-offscreen-arrow-v311>strong{animation:none}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function renderDockV311() {
    var suggestions = routeSwapSuggestionsForUser();
    if (!suggestions.length) return "";

    var open = Boolean(state.routeSwapPanelOpen);
    var rows = suggestions.map(function (item) {
      var routeRows = '<div class="route-swap-routes-v311">';
      routeRows += '<div class="route-swap-route-v311"><b>' + esc(dateTextV311(item.firstDate || item.date)) + '</b><span>' + esc(item.firstRoute) + '</span></div>';
      if (item.secondRoute) {
        routeRows += '<div class="route-swap-route-v311"><b>' + esc(dateTextV311(item.secondDate || item.date)) + '</b><span>' + esc(item.secondRoute) + '</span></div>';
      }
      (item.approaches || []).forEach(function (approach) {
        var detail = approach.driver + ': ' + approach.from + ' → ' + approach.to + ' · ok. ' + approach.km + ' km';
        routeRows += '<div class="route-swap-route-v311"><b>DOLOT</b><span title="' + attr(detail) + '">' + esc(detail) + '</span></div>';
      });
      routeRows += "</div>";
      var sampleBadge = item.sampleOptimization ? '<span class="route-swap-sample-v317">PRZYKŁAD</span>' : "";

      return '<button type="button" class="route-swap-row" data-route-swap-suggestion="' + attr(item.id) + '" title="' + attr(item.firstRoute + (item.secondRoute ? " / " + item.secondRoute : "")) + '">'
        + '<div class="route-swap-row-top">'
        + '<span class="route-swap-saving" title="Szacunkowa suma zmienionych dolotów: od ostatniego rozładunku do pierwszego załadunku, także w kolejnych relacjach"><strong>-' + Math.round(item.savingKm) + ' km</strong><small>szac. ' + Math.round(item.savingPercent || 0) + '% mniej dojazdu</small></span>'
        + sampleBadge
        + '<span class="route-swap-date-v311">' + esc(routeDateLabelV311(item)) + '</span>'
        + '<span class="route-swap-km"><b>' + item.currentKm + ' km</b><i>&rarr;</i><b>' + item.swappedKm + ' km</b></span>'
        + '</div>'
        + '<div class="route-swap-drivers"><span>' + esc(item.firstDriver) + ' <b>' + (item.kind === "swap" ? "&harr;" : "&rarr;") + '</b> ' + esc(item.secondDriver) + '</span></div>'
        + '<div class="route-swap-dispatchers"><span class="dispatcher-map-badge ' + dispatcherBadgeClass(item.firstDispatcher) + '">' + esc(item.firstDispatcher) + '</span><span class="dispatcher-map-badge ' + dispatcherBadgeClass(item.secondDispatcher) + '">' + esc(item.secondDispatcher) + '</span></div>'
        + routeRows
        + '</button>';
    }).join("");

    var panelTitle = typeof isAdminUser === "function" && isAdminUser() ? "Wszystkie optymalizacje tras" : "Optymalizacja tras";
    return '<div class="route-swap-notice ' + (open ? "open" : "") + '">'
      + (open ? '<section class="route-swap-panel" aria-label="Propozycje optymalizacji tras"><header><b>' + esc(panelTitle) + '</b><button type="button" onclick="toggleRouteSwapPanel(event)" aria-label="Zamknij panel">&times;</button></header><div class="route-swap-list">' + rows + '</div></section>' : "")
      + '<button type="button" class="route-swap-dock" onclick="toggleRouteSwapPanel(event)" title="' + attr(String(suggestions.length) + " propozycji optymalizacji tras") + '" aria-label="Propozycje optymalizacji tras"><span>↔</span><b>' + suggestions.length + '</b></button>'
      + '</div>';
  }

  function ensureBoardContextV311(suggestion) {
    var routes = [routeByIdV311(suggestion && suggestion.firstRouteId), routeByIdV311(suggestion && suggestion.secondRouteId)].filter(Boolean);
    var dates = routes.map(function (route) { return iso(route.date); }).filter(Boolean).sort();
    var targetDate = dates[0] || iso(suggestion && suggestion.date);

    if (targetDate && !dateList().includes(targetDate)) {
      state.mobileBoardWindowTouched = true;
      state.boardWindowUserMoved = true;
      state.boardWindowStart = normalizedBoardWindowStart(addDaysToIso(targetDate, mobileViewportActive() ? -1 : -2));
      dateListMemo = { signature: "", dates: null, indexMap: null };
      boardRenderCache = null;
    }

    if (state.user && state.user.role === "spedytor" && state.onlyMine) {
      var ownLogin = String(state.user.login || "");
      var needsForeign = routes.some(function (route) {
        var dispatcher = routeDispatcherLogin(route);
        return dispatcher && dispatcher !== ownLogin;
      });
      if (needsForeign) state.onlyMine = false;
    }
  }

  function tileVisibleV311(tile, viewport) {
    if (!tile || !viewport) return false;
    var a = tile.getBoundingClientRect();
    var b = viewport.getBoundingClientRect();
    return a.bottom > b.top + 8 && a.top < b.bottom - 8 && a.right > b.left + 8 && a.left < b.right - 8;
  }

  function scrollToTilesV311(tiles) {
    var viewport = document.querySelector(".board-scroll");
    if (!viewport || !tiles.length) {
      if (tiles[0] && tiles[0].scrollIntoView) tiles[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      return;
    }

    var box = viewport.getBoundingClientRect();
    var rects = tiles.map(function (tile) { return tile.getBoundingClientRect(); });
    var x = rects.reduce(function (sum, rect) { return sum + rect.left + rect.width / 2; }, 0) / rects.length;
    var y = rects.reduce(function (sum, rect) { return sum + rect.top + rect.height / 2; }, 0) / rects.length;

    viewport.scrollTo({
      left: Math.max(0, viewport.scrollLeft + x - box.left - viewport.clientWidth / 2),
      top: Math.max(0, viewport.scrollTop + y - box.top - viewport.clientHeight / 2),
      behavior: "smooth"
    });
  }

  function renderOffscreenArrowV311(suggestion, visibleTiles) {
    var viewport = document.querySelector(".board-scroll");
    if (!viewport) return;

    var routes = [routeByIdV311(suggestion && suggestion.firstRouteId), routeByIdV311(suggestion && suggestion.secondRouteId)].filter(Boolean);
    var visibleIds = new Set(visibleTiles.map(function (tile) { return String(tile.dataset.routeId || ""); }));
    var missing = routes.find(function (route) { return !visibleIds.has(String(route.id || "")); }) || routes[0] || null;
    var drivers = boardDriversInStableOrderV192(DRIVERS);
    var missingIndex = missing ? drivers.findIndex(function (driver) { return String(driver.id) === String(missing.driverId); }) : -1;
    var anchor = visibleTiles[0] ? routeByIdV311(visibleTiles[0].dataset.routeId) : null;
    var anchorIndex = anchor ? drivers.findIndex(function (driver) { return String(driver.id) === String(anchor.driverId); }) : Math.floor(drivers.length / 2);
    var up = missingIndex >= 0 && missingIndex < anchorIndex;

    var box = viewport.getBoundingClientRect();
    var node = document.createElement("div");
    node.className = "route-swap-guide route-swap-guide-offscreen-v311";
    var label = missing
      ? ((driverById(missing.driverId) && driverById(missing.driverId).driver) || "Kafelek poza widokiem") + " · " + dateTextV311(missing.date)
      : "Kafelek poza widokiem · " + dateTextV311(suggestion && suggestion.date);

    var arrow = document.createElement("div");
    arrow.className = "route-swap-offscreen-arrow-v311";
    arrow.style.left = Math.max(12, Math.min(window.innerWidth - 272, box.left + box.width / 2 - 130)) + "px";
    arrow.style.top = (up ? Math.max(8, box.top + 10) : Math.min(window.innerHeight - 58, box.bottom - 52)) + "px";
    arrow.innerHTML = "<strong>" + (up ? "↑" : "↓") + "</strong><span>" + esc(label) + "</span><small>kafelek jest " + (up ? "wyżej" : "niżej") + " na planie</small>";
    node.appendChild(arrow);
    document.body.appendChild(node);
  }

  function renderGuideV311(suggestion) {
    clearRouteSwapGuide();
    if (!suggestion || Number(state.routeSwapHighlightUntil || 0) <= Date.now()) return;

    var wanted = [suggestion.firstRouteId, suggestion.secondRouteId].filter(Boolean).map(String);
    var tiles = routeSwapTilesForIds(wanted);
    var viewport = document.querySelector(".board-scroll");
    var visible = viewport ? tiles.filter(function (tile) { return tileVisibleV311(tile, viewport); }) : tiles;

    if (!tiles.length || visible.length < wanted.length) {
      visible.forEach(function (tile) {
        tile.classList.add("route-swap-guide-single");
        tile.dataset.routeSwapGuide = suggestion.kind === "swap" ? "↔ DRUGI KAFELEK" : "→ PRZYPISZ";
      });
      renderOffscreenArrowV311(suggestion, visible);
      return;
    }

    var first = tiles.find(function (tile) { return String(tile.dataset.routeId || "") === String(suggestion.firstRouteId); }) || tiles[0];
    var second = tiles.find(function (tile) { return String(tile.dataset.routeId || "") === String(suggestion.secondRouteId); });
    var instruction = suggestion.kind === "swap" ? "↔ ZAMIEŃ" : "→ " + String(suggestion.secondDriver || "").toUpperCase();

    first.classList.add(second ? "route-swap-guide-origin" : "route-swap-guide-single");
    first.dataset.routeSwapGuide = instruction;
    if (second) {
      second.classList.add("route-swap-guide-target");
      second.dataset.routeSwapGuide = instruction;
    }

    var layer = document.createElement("div");
    layer.className = "route-swap-guide";

    if (!second) {
      var rect = first.getBoundingClientRect();
      var label = document.createElement("span");
      label.className = "route-swap-guide-label single";
      label.style.left = Math.max(12, Math.min(window.innerWidth - 190, rect.left + rect.width / 2 - 95)) + "px";
      label.style.top = Math.max(10, rect.top - 34) + "px";
      label.innerHTML = esc(instruction) + " <b>−" + Math.round(suggestion.savingKm) + " km</b>";
      layer.appendChild(label);
      document.body.appendChild(layer);
      return;
    }

    var from = first.getBoundingClientRect();
    var to = second.getBoundingClientRect();
    var x1 = Math.round(from.left + from.width / 2);
    var y1 = Math.round(from.top + from.height / 2);
    var x2 = Math.round(to.left + to.width / 2);
    var y2 = Math.round(to.top + to.height / 2);
    var bend = Math.max(42, Math.abs(x2 - x1) * 0.28);
    var labelX = Math.max(12, Math.min(window.innerWidth - 170, Math.round((x1 + x2) / 2 - 85)));
    var labelY = Math.max(10, Math.min(window.innerHeight - 34, Math.round((y1 + y2) / 2 - 17)));
    layer.innerHTML = '<svg viewBox="0 0 ' + window.innerWidth + ' ' + window.innerHeight + '" aria-hidden="true"><defs><marker id="route-swap-arrowhead-v311" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs><path d="M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '" marker-start="url(#route-swap-arrowhead-v311)" marker-end="url(#route-swap-arrowhead-v311)" /></svg><span class="route-swap-guide-label" style="left:' + labelX + 'px;top:' + labelY + 'px;">' + esc(instruction) + ' <b>−' + Math.round(suggestion.savingKm) + ' km</b></span>';
    document.body.appendChild(layer);
  }

  function highlightV311(event, suggestionId) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    var suggestion = (state.routeSwapSuggestions || []).find(function (item) { return item.id === suggestionId; });
    if (!suggestion) return;

    var ids = [suggestion.firstRouteId, suggestion.secondRouteId].filter(Boolean).map(String);
    if (!ids.length) return;

    state.routeSwapPanelOpen = false;
    state.routeSwapHighlightIds = ids;
    state.routeSwapHighlightUntil = Date.now() + 8000;
    state.routeSwapGuideSuggestion = suggestion;
    clearTimeout(state.routeSwapHighlightTimer);

    ensureBoardContextV311(suggestion);
    syncRouteSwapDock();
    syncBoardOnly();

    function focus(attempt) {
      document.querySelectorAll(".time-route.route-swap-pulse").forEach(function (tile) {
        tile.classList.remove("route-swap-pulse");
      });

      var tiles = routeSwapTilesForIds(ids);
      tiles.forEach(function (tile) {
        void tile.offsetWidth;
        tile.classList.add("route-swap-pulse");
      });

      if (tiles.length) scrollToTilesV311(tiles);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { renderGuideV311(suggestion); });
      });

      if (tiles.length < ids.length && attempt < 3) {
        setTimeout(function () { focus(attempt + 1); }, 140 * (attempt + 1));
      }
    }

    requestAnimationFrame(function () { focus(0); });

    state.routeSwapHighlightTimer = setTimeout(function () {
      state.routeSwapHighlightIds = [];
      state.routeSwapHighlightUntil = 0;
      state.routeSwapGuideSuggestion = null;
      routeSwapTilesForIds(ids).forEach(function (tile) { tile.classList.remove("route-swap-pulse"); });
      clearRouteSwapGuide();
    }, 8000);
  }

  function disablePerformanceMonitorV311() {
    try { state.performanceMonitorEnabled = false; } catch (error) {}
    try {
      if (typeof performanceMonitorFrame !== "undefined" && performanceMonitorFrame) cancelAnimationFrame(performanceMonitorFrame);
      if (typeof performanceMonitorFrame !== "undefined") performanceMonitorFrame = 0;
    } catch (error) {}
    try { recordMapPerformance = function () {}; } catch (error) {}
    try {
      syncPerformanceMonitor = function () {
        document.getElementById("performance-monitor")?.remove();
      };
    } catch (error) {}
    try {
      togglePerformanceMonitor = function (event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        document.getElementById("performance-monitor")?.remove();
        document.querySelectorAll('[data-action="toggle-performance-monitor"]').forEach(function (button) { button.remove(); });
      };
    } catch (error) {}

    var style = document.getElementById("disable-performance-monitor-v311");
    if (!style) {
      style = document.createElement("style");
      style.id = "disable-performance-monitor-v311";
      style.textContent = '[data-action="toggle-performance-monitor"],#performance-monitor,.performance-monitor{display:none!important}';
      document.head.appendChild(style);
    }

    var remove = function () {
      document.getElementById("performance-monitor")?.remove();
      document.querySelectorAll('[data-action="toggle-performance-monitor"]').forEach(function (button) { button.remove(); });
    };
    remove();
  }

  function installV311() {
    if (window.__topDragonRouteOptimizationV311) return true;
    if (typeof state === "undefined"
      || typeof activeRoutes !== "function"
      || typeof routeSwapPosition !== "function"
      || typeof routeSwapDriverCanCover !== "function"
      || typeof routeSwapDistance !== "function"
      || typeof routeSwapSuggestionsForUser !== "function"
      || typeof syncRouteSwapDock !== "function"
      || typeof syncBoardOnly !== "function") return false;

    window.__topDragonRouteOptimizationV311 = true;
    injectStylesV311();
    disablePerformanceMonitorV311();

    routeSwapRouteSet = futureRouteSetV311;
    buildRouteSwapSuggestions = buildSuggestionsV311;
    renderRouteSwapDock = renderDockV311;
    renderRouteSwapGuide = renderGuideV311;
    highlightRouteSwapSuggestion = highlightV311;
    window.highlightRouteSwapSuggestion = highlightV311;

    state.routeSwapAnalysisSignature = "";
    scheduleRouteSwapAnalysis();
    return true;
  }

  if (!installV311()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (installV311() || attempts >= 60) clearInterval(timer);
    }, 100);
  }
})();
