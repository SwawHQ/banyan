(function () {
    const SIGNAL_CONTROL_SELECTOR = "[data-home-art-wind-signal]";
    const windScenes = Array.from(document.querySelectorAll(".home-art-wind"));
    const scenePauseStates = new Map();
    const selections = new Map();

    const setScenePaused = (windScene, reason, paused) => {
        if (!windScene) {
            return;
        }

        const state = scenePauseStates.get(windScene) || {
            document: document.hidden,
            viewport: false,
        };

        state[reason] = paused;
        scenePauseStates.set(windScene, state);
        windScene.classList.toggle("is-paused", state.document || state.viewport);
    };

    const syncDocumentPauseState = () => {
        windScenes.forEach((windScene) => {
            setScenePaused(windScene, "document", document.hidden);
        });
    };

    const initSignalButtons = () => {
        windScenes.forEach((windScene) => {
            windScene.querySelectorAll("button[data-home-art-wind-signal]").forEach((button) => {
                button.setAttribute("aria-pressed", "false");
            });
        });
    };

    const setSignalSelected = (control, selected) => {
        const signal = control.closest(".home-art-wind__signal");
        if (control instanceof HTMLButtonElement) {
            control.setAttribute("aria-pressed", selected ? "true" : "false");
        }
        signal?.classList.toggle("is-selected", selected);
    };

    const clearSelection = (scene) => {
        const control = selections.get(scene);
        if (control) {
            setSignalSelected(control, false);
            selections.delete(scene);
        }
    };

    const clearAll = () => selections.forEach((_, scene) => clearSelection(scene));

    const isSignalLink = (control) => control instanceof HTMLAnchorElement && control.hasAttribute("href");

    document.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const control = target.closest(SIGNAL_CONTROL_SELECTOR);

        if (!control) {
            const scene = target.closest(".home-art-wind");
            if (!scene) {
                clearAll();
            } else if (!target.closest(".home-art-wind__signals")) {
                clearSelection(scene);
            }
            return;
        }

        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const scene = control.closest(".home-art-wind");
        if (control === selections.get(scene)) {
            if (isSignalLink(control)) {
                clearSelection(scene);
                return;
            }

            event.preventDefault();
            clearSelection(scene);
            return;
        }

        event.preventDefault();
        clearSelection(scene);
        selections.set(scene, control);
        setSignalSelected(control, true);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            clearAll();
        }
    });

    document.addEventListener("visibilitychange", syncDocumentPauseState);
    initSignalButtons();
    syncDocumentPauseState();

    if ("IntersectionObserver" in window) {
        const sceneObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                setScenePaused(entry.target.closest(".home-art-wind"), "viewport", !entry.isIntersecting);
            });
        });

        windScenes.forEach((windScene) => {
            sceneObserver.observe(windScene.querySelector(".home-art-wind__scene") || windScene);
        });
    }
})();
