(function () {
  const PATCH_FLAG = '__topDragonMapArchiveCenterFixV306';

  function injectFix(frame) {
    if (!frame || frame.dataset.mapArchiveCenterFix === '306') return;

    const apply = () => {
      try {
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        if (!doc || !win || doc.URL === "about:blank" || doc.readyState === 'loading') return false;
        if (win[PATCH_FLAG]) {
          frame.dataset.mapArchiveCenterFix = '306';
          return true;
        }

        const patchScript = doc.createElement('script');
        patchScript.textContent = String.raw`
          (function () {
            if (window.${PATCH_FLAG}) return;
            window.${PATCH_FLAG} = true;

            function clampReportDateToArchive(value) {
              const today = currentAppDate();
              const earliest = addDaysToIso(today, -BOARD_ARCHIVE_DAYS);
              const latest = addDaysToIso(today, BOARD_FUTURE_DAYS);
              const candidate = isIsoDateValue(value) ? value : today;
              if (candidate < earliest) return earliest;
              if (candidate > latest) return latest;
              return candidate;
            }

            window.setReportDate = function (value) {
              state.reportDate = clampReportDateToArchive(value || currentAppDate());
              state.proposedSignalSilentOnce = true;
              syncUnloadMapCard();
              scheduleReportDateDependentPanelsSync();
            };

            window.shiftReportDate = function (direction) {
              const step = Number(direction || 0);
              state.reportDate = clampReportDateToArchive(addDaysToIso(state.reportDate || currentAppDate(), step));
              state.proposedSignalSilentOnce = true;
              syncUnloadMapCard();
              scheduleReportDateDependentPanelsSync();
            };

            function forcePolandMapCenter() {
              if (!state.leafletMap) return;
              try {
                state.leafletMap.stop?.();
                state.leafletMap.invalidateSize?.({ animate: false, pan: false });
                state.leafletMap.setView([52.0, 19.2], 6, { animate: false });
              } catch (error) {}
            }

            window.centerLeafletMapHome = function () {
              forcePolandMapCenter();
              requestAnimationFrame(() => requestAnimationFrame(forcePolandMapCenter));
              setTimeout(forcePolandMapCenter, 180);
              setTimeout(forcePolandMapCenter, 420);
            };

            window.fitLeafletMapToPoints = function (points, fitSignature) {
              if (!state.leafletMap) return;
              forcePolandMapCenter();
              state.leafletFitSignature = fitSignature;
              requestAnimationFrame(() => requestAnimationFrame(forcePolandMapCenter));
              setTimeout(forcePolandMapCenter, 100);
              setTimeout(forcePolandMapCenter, 260);
            };

            setTimeout(forcePolandMapCenter, 0);
            setTimeout(forcePolandMapCenter, 180);
            setTimeout(forcePolandMapCenter, 420);
          })();
        `;
        (doc.head || doc.documentElement).appendChild(patchScript);
        patchScript.remove();
        frame.dataset.mapArchiveCenterFix = '306';
        return true;
      } catch (error) {
        console.warn('Nie udało się zastosować poprawki mapy TMS:', error);
        return false;
      }
    };

    if (!apply()) {
      frame.addEventListener('load', () => {
        apply();
        setTimeout(apply, 50);
      }, { once: true });
    }
  }

  const frameHooks = new WeakSet();

  function installQueueDatesInFrame(frame) {
    let doc = null;
    try { doc = frame && frame.contentDocument; } catch (error) { return; }
    if (!doc || doc.URL === "about:blank" || doc.readyState === "loading" || !doc.head) return;
    if (doc.querySelector('script[data-topdragon-queue-dates-v309]')) return;
    const script = doc.createElement("script");
    script.src = "/tms-queue-dates.js?build=v318-compact-pencil-dates";
    script.async = false;
    script.setAttribute("data-topdragon-queue-dates-v309", "true");
    script.onerror = () => {
      script.remove();
      console.warn("Nie udało się załadować obsługi dat planowanych relacji i wolnych ładunków.");
    };
    doc.head.appendChild(script);
  }

  function installAiQuickAddInFrame(frame) {
    let doc = null;
    try { doc = frame && frame.contentDocument; } catch (error) { return; }
    if (!doc || doc.URL === "about:blank" || doc.readyState === "loading" || !doc.head) return;
    if (doc.querySelector('script[data-topdragon-ai-quick-add-v312]')) return;
    const script = doc.createElement("script");
    script.src = "/tms-ai-quick-add-v312.js?build=v318-clean-text-import";
    script.async = false;
    script.setAttribute("data-topdragon-ai-quick-add-v312", "true");
    script.onerror = () => {
      script.remove();
      console.warn("Nie udało się załadować uproszczonego dodawania relacji przez AI.");
    };
    doc.head.appendChild(script);
  }

  function installRouteOptimizationInFrame(frame) {
    let doc = null;
    try { doc = frame && frame.contentDocument; } catch (error) { return; }
    if (!doc || doc.URL === "about:blank" || doc.readyState === "loading" || !doc.head) return;
    if (doc.querySelector('script[data-topdragon-route-optimization-v311]')) return;
    const script = doc.createElement("script");
    script.src = "/tms-route-optimization-v311.js?build=v334-responsive-analysis";
    script.async = false;
    script.setAttribute("data-topdragon-route-optimization-v311", "true");
    script.onerror = () => {
      script.remove();
      console.warn("Nie udało się załadować optymalizacji przyszłych relacji.");
    };
    doc.head.appendChild(script);
  }

  function installFrameScripts(frame) {
    if (!frame) return;
    if (!frameHooks.has(frame)) {
      frameHooks.add(frame);
      frame.addEventListener("load", () => {
        installQueueDatesInFrame(frame);
        installRouteOptimizationInFrame(frame);
        installAiQuickAddInFrame(frame);
        requestAnimationFrame(() => { installQueueDatesInFrame(frame); installRouteOptimizationInFrame(frame); installAiQuickAddInFrame(frame); });
      });
    }
  }

  function scan() {
    const frame = document.querySelector('#tms-frame');
    installFrameScripts(frame);
    installQueueDatesInFrame(frame);
    installRouteOptimizationInFrame(frame);
    installAiQuickAddInFrame(frame);
    injectFix(frame);
  }

  new MutationObserver(scan).observe(document.querySelector('#app'), { childList: true });
  window.addEventListener('pageshow', scan);
  scan();
})();
