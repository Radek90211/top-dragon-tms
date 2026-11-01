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

  function scan() {
    injectFix(document.querySelector('#tms-frame'));
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', scan);
  scan();
})();
