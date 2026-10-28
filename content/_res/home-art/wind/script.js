(function () {
    const SIGNAL_CONTROL_SELECTOR = "[data-page-home-signal]";
    const pageHomes = Array.from(document.querySelectorAll(".page-home"));
    const scenePauseStates = new Map();
    let selectedSignalControl = null;

    const setScenePaused = (pageHome, reason, paused) => {
        if (!pageHome) {
            return;
        }

        const state = scenePauseStates.get(pageHome) || {
            document: document.hidden,
            viewport: false,
        };

        state[reason] = paused;
        scenePauseStates.set(pageHome, state);
        pageHome.classList.toggle("is-paused", state.document || state.viewport);
    };

    const syncDocumentPauseState = () => {
        pageHomes.forEach((pageHome) => {
            setScenePaused(pageHome, "document", document.hidden);
        });
    };

    const initSignalButtons = () => {
        pageHomes.forEach((pageHome) => {
            pageHome.querySelectorAll("button[data-page-home-signal]").forEach((button) => {
                button.setAttribute("aria-pressed", "false");
            });
        });
    };

    const setSignalSelected = (control, selected) => {
        const signal = control.closest(".page-home__signal");
        control.toggleAttribute("data-page-home-signal-selected", selected);
        if (control instanceof HTMLButtonElement) {
            control.setAttribute("aria-pressed", selected ? "true" : "false");
        }
        signal?.classList.toggle("is-selected", selected);
    };

    const clearSelectedSignal = () => {
        if (!selectedSignalControl) {
            return;
        }

        setSignalSelected(selectedSignalControl, false);
        selectedSignalControl = null;
    };

    const isSignalLink = (control) => control instanceof HTMLAnchorElement && control.hasAttribute("href");

    document.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const control = target.closest(SIGNAL_CONTROL_SELECTOR);

        if (!control) {
            if (!target.closest(".page-home__signals")) {
                clearSelectedSignal();
            }
            return;
        }

        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        if (control === selectedSignalControl) {
            if (isSignalLink(control)) {
                clearSelectedSignal();
                return;
            }

            event.preventDefault();
            clearSelectedSignal();
            return;
        }

        event.preventDefault();
        clearSelectedSignal();
        selectedSignalControl = control;
        setSignalSelected(control, true);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            clearSelectedSignal();
        }
    });

    document.addEventListener("visibilitychange", syncDocumentPauseState);
    initSignalButtons();
    syncDocumentPauseState();

    if ("IntersectionObserver" in window) {
        const sceneObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                setScenePaused(entry.target.closest(".page-home"), "viewport", !entry.isIntersecting);
            });
        });

        pageHomes.forEach((pageHome) => {
            sceneObserver.observe(pageHome.querySelector(".page-home__scene") || pageHome);
        });
    }
})();
