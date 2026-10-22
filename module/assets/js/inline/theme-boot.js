try {
    var preference = localStorage.getItem("theme-preference");
    if (!["auto", "light", "dark"].includes(preference)) preference = "auto";
    var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    var theme = preference === "auto"
        ? ((media && media.matches) ? "dark" : "light")
        : preference;

    document.documentElement.setAttribute("data-theme", theme);
} catch (_) { }
