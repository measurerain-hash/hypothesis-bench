/**
 * validate.js — turn a model reply into a spec the chart can trust, or fall back.
 *
 * The model is not trusted with anything executable. `formula` is checked against a
 * whitelist and compiled with the variable symbols plus `Math` in scope, so a bad or
 * hostile expression degrades to a plain linear bench instead of running.
 */
(function (root) {
    const MAX_VARS = 4;
    const BANNED = /(;|\{|\}|\[|\]|=>|`|\\|'|"|\bwindow\b|\bdocument\b|\bfetch\b|\bthis\b|\beval\b|\bnew\b|\bimport\b|\bprocess\b|\bglobalThis\b|\bfunction\b)/i;

    function str(x, fallback) {
        return typeof x === "string" && x.trim() ? x.trim() : fallback;
    }

    function num(x, fallback) {
        const n = typeof x === "number" ? x : Number.parseFloat(x);
        return Number.isFinite(n) ? n : fallback;
    }

    function strList(x, limit) {
        if (!Array.isArray(x)) return [];
        return x
            .filter((s) => typeof s === "string" && s.trim())
            .map((s) => s.trim())
            .slice(0, limit);
    }

    function sanitizeVariable(raw, index) {
        if (!raw || typeof raw !== "object") return null;
        let symbol = str(raw.symbol, "x" + index).replace(/[^A-Za-z0-9_]/g, "");
        if (!symbol || /^[0-9]/.test(symbol)) symbol = "x" + index;
        if (symbol === "Math") symbol = "x" + index;
        let min = num(raw.min, 0);
        let max = num(raw.max, min + 10);
        if (!(max > min)) max = min + 10;
        let def = num(raw.default, (min + max) / 2);
        def = Math.min(max, Math.max(min, def));
        const real = num(raw.real, def);
        return {
            symbol,
            name: str(raw.name, symbol),
            unit: str(raw.unit, ""),
            min,
            max,
            default: def,
            real: Math.min(max, Math.max(min, real)),
            note: str(raw.note, ""),
        };
    }

    function compileFormula(expr, symbols) {
        const e = str(expr, "");
        if (!e || BANNED.test(e)) return null;
        // Only Math.* may use a dot; every other dot is rejected.
        if (e.replace(/Math\./g, "").includes(".")) return null;
        if (!/^[A-Za-z0-9_+\-*/%(),.\s]+$/.test(e)) return null;
        try {
            const fn = new Function(...symbols, "Math", "return (" + e + ");");
            const probe = {};
            for (const s of symbols) probe[s] = 1;
            const v = fn(...symbols.map((s) => 1), Math);
            if (typeof v !== "number") return null;
            return (values) => {
                try {
                    const out = fn(...symbols.map((s) => values[s]), Math);
                    return Number.isFinite(out) ? out : NaN;
                } catch (_err) {
                    return NaN;
                }
            };
        } catch (_err) {
            return null;
        }
    }

    function fallbackSpec(topic) {
        return {
            title: "A first model of " + (topic || "this topic"),
            hook: "The model could not be reached, so here is a placeholder you can still steer.",
            variables: [
                { symbol: "x", name: "input", unit: "", min: 0, max: 10, default: 5, real: 5, note: "the quantity you change" },
                { symbol: "k", name: "rate constant", unit: "1/unit", min: 0.1, max: 3, default: 1, real: 1, note: "how fast it responds" },
            ],
            x_index: 0,
            formula: "k * x",
            y_label: "response",
            y_unit: "",
            explain: [
                "This is a stand-in, not the real relationship for your topic.",
                "Use the sliders to see how a change in one quantity moves the response.",
                "Retry with a key connected to get the real model for your topic.",
            ],
            try_this: ["Move the rate slider and watch the slope.", "Reset to defaults and compare."],
            facts: ["A placeholder model says nothing about the real topic."],
            sources: [],
            _fallback: true,
        };
    }

    function parseSpec(text) {
        let raw;
        try {
            raw = JSON.parse(root.PolliClient.extractJson(text));
        } catch (_err) {
            return fallbackSpec("");
        }
        if (!raw || typeof raw !== "object") return fallbackSpec("");

        const vars = (Array.isArray(raw.variables) ? raw.variables : [])
            .slice(0, MAX_VARS)
            .map(sanitizeVariable)
            .filter(Boolean);
        if (!vars.length) return fallbackSpec("");

        let formula = str(raw.formula, "");
        const symbols = vars.map((v) => v.symbol);
        let fn = compileFormula(formula, symbols);
        if (!fn) {
            formula = symbols[0];
            fn = compileFormula(formula, symbols);
        }

        let xIndex = Math.round(num(raw.x_index, 0));
        if (xIndex < 0 || xIndex >= vars.length) xIndex = 0;

        return {
            title: str(raw.title, "Untitled bench"),
            hook: str(raw.hook, ""),
            variables: vars,
            x_index: xIndex,
            formula,
            y_label: str(raw.y_label, "response"),
            y_unit: str(raw.y_unit, ""),
            explain: strList(raw.explain, 6),
            try_this: strList(raw.try_this, 6),
            facts: strList(raw.facts, 6),
            sources: strList(raw.sources, 6),
            _eval: fn,
        };
    }

    root.Validate = { parseSpec, fallbackSpec, compileFormula };
})(typeof self !== "undefined" ? self : globalThis);