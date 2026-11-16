/**
 * prompt.js — the single instruction that turns a topic into a bench spec.
 *
 * The reply is a FLAT JSON object. No nested state objects: a model that has to open
 * `state.stock.credit` gets numbers wrong and burns output; flattened keys are what it
 * gets right (measured on earlier quests).
 */
(function (root) {
    const EXAMPLES = [
        "radioactive decay",
        "herd immunity",
        "orbital period",
        "enzyme kinetics",
        "why the sky is blue",
        "compound interest as growth",
    ];

    function systemPrompt() {
        return [
            "You turn a science topic into a small interactive model for a non-specialist.",
            "Answer with ONE JSON object and nothing else — no prose, no markdown fence.",
            "",
            "Schema (all keys required):",
            "{",
            '  "title": "<= 60 chars, plain title",',
            '  "hook": "one sentence that poses the question the model answers",',
            '  "variables": [ up to 4 entries, each:',
            '     { "symbol": "one ascii letter or short ascii word (a JS identifier, e.g. t, D, rate)",',
            '       "name": "short human name", "unit": "SI unit or \\"\\"",',
            '       "min": number, "max": number, "default": number,',
            '       "real": number, "note": "what it means in one clause" } ],',
            '  "x_index": 0,',
            '  "formula": "a single JavaScript expression for the y value, using only the variable symbols and Math.* (Math.exp, Math.sqrt, Math.sin, Math.pow, Math.abs, ...). No statements, no semicolons, no property access other than Math.",',
            '  "y_label": "what the vertical axis is", "y_unit": "unit or empty",',
            '  "explain": [3 short paragraphs in plain language],',
            '  "try_this": [3 short concrete experiments the reader can run with the sliders],',
            '  "facts": [2 short cautions: where the simple model stops being true],',
            '  "sources": [2..3 entries like \\"Feynman Lectures, Vol I, ch. 6\\" or \\"OpenStax Physics, ch. 6\\" — real works, no invented URLs]"',
            "}",
            "",
            "Rules:",
            "- variables[0] is swept along the x-axis; the rest are sliders held at their default.",
            "- `formula` must be finite across the whole slider range; guard the domain (log, sqrt, division).",
            "- Use SI units. Set `real` to the value a real system of this kind has.",
            "- Keep every string short. Plain language, no hype, no emoji.",
        ].join("\n");
    }

    function userPrompt(topic) {
        return "Science topic: " + topic;
    }

    function messages(topic) {
        return [
            { role: "system", content: systemPrompt() },
            { role: "user", content: userPrompt(topic) },
        ];
    }

    root.Prompt = { EXAMPLES, systemPrompt, userPrompt, messages };
})(typeof self !== "undefined" ? self : globalThis);