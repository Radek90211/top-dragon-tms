(function () {
  const PATCH_FLAG = '__topDragonMapArchiveCenterFixV306';

  function injectFix(frame) {
    if (!frame || frame.dataset.mapArchiveCenterFix === '306') return;

    const apply = () => {
      try {
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        if (!doc || !win || doc.readyState === 'loading') return false;
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

            function removeFpsButtonFromMap() {
              document.querySelectorAll('.map-card button, .map-card [role="button"]').forEach(control => {
                if (String(control.textContent || '').trim().toUpperCase() === 'FPS') {
                  control.remove();
                }
              });
            }

            // Mapa jest przebudowywana po zmianie filtrów i dat; usuwamy FPS po każdym renderze.
            removeFpsButtonFromMap();
            if (document.body) {
              new MutationObserver(removeFpsButtonFromMap).observe(document.body, { childList: true, subtree: true });
            }

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

  // Przyciski mapy są generowane ponownie przy odświeżeniu dat i filtrów.
  // Obserwujemy właściwy dokument iframe (nie tylko stronę nadrzędną).
  const fpsFrameHooks = new WeakSet();
  const fpsDocumentObservers = new WeakMap();

  function removeMapFpsButton(doc) {
    if (!doc || !doc.querySelectorAll) return;
    const map = doc.querySelector(".map-card");
    if (!map) return;
    map.querySelectorAll("button, [role='button']").forEach(button => {
      const text = String(button.textContent || "").replace(/\s+/g, " ").trim();
      const action = String(button.getAttribute("data-action") || "");
      const description = String(button.getAttribute("aria-label") || button.getAttribute("title") || "");
      if (/^fps$/i.test(text) || /^fps$/i.test(description.trim()) || /^(?:map-)?fps(?:-toggle)?$/i.test(action)) {
        button.remove();
      }
    });
  }

  function attachFpsObserver(frame) {
    let doc = null;
    try { doc = frame.contentDocument; } catch (error) { return; }
    if (!doc || doc.URL === "about:blank" || !doc.documentElement || fpsDocumentObservers.has(doc)) return;
    const scanFps = () => removeMapFpsButton(doc);
    scanFps();
    const observer = new MutationObserver(scanFps);
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    fpsDocumentObservers.set(doc, observer);
  }

  function installFpsObserver(frame) {
    if (!frame) return;
    if (!fpsFrameHooks.has(frame)) {
      fpsFrameHooks.add(frame);
      frame.addEventListener("load", () => {
        attachFpsObserver(frame);
        requestAnimationFrame(() => attachFpsObserver(frame));
      });
    }
    attachFpsObserver(frame);
  }

  function scan() {
    const frame = document.querySelector('#tms-frame');
    installFpsObserver(frame);
    injectFix(frame);
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', scan);
  scan();
})();
