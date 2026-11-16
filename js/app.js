/**
 * app.js — glue: topic -> spec -> steerable bench.
 */
(function () {
    const el = (id) => document.getElementById(id);
    const chips = el("chips");
    const topic = el("topic");
    const build = el("build");
    const status = el("status");
    const bench = el("bench");
    const canvas = el("chart");
    const controls = el("controls");
    const readout = el("readout");
    const widget = document.querySelector("polli-connect");

    let spec = null;
    let values = {};
    let built = false;

    const unit = (u) => (u ? " " + u : "");

    function currentKey() {
        return widget && widget.apiKey ? widget.apiKey : null;
    }

    function setStatus(msg, isError) {
        status.textContent = msg || "";
        status.classList.toggle("error", !!isError);
    }

    function fillChips() {
        for (const ex of Prompt.EXAMPLES) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "chip";
            b.textContent = ex;
            b.addEventListener("click", () => {
                topic.value = ex;
                run();
            });
            chips.appendChild(b);
        }
    }

    function slider(v) {
        const wrap = document.createElement("div");
        wrap.className = "control";
        const lab = document.createElement("label");
        const name = document.createElement("span");
        name.textContent = v.name + unit(v.unit);
        const val = document.createElement("b");
        val.textContent = Chart.fmt(values[v.symbol]);
        lab.append(name, val);
        const input = document.createElement("input");
        input.type = "range";
        input.min = v.min;
        input.max = v.max;
        input.step = (v.max - v.min) / 200 || 0.01;
        input.value = values[v.symbol];
        input.addEventListener("input", () => {
            values[v.symbol] = Number.parseFloat(input.value);
            val.textContent = Chart.fmt(values[v.symbol]);
            render();
        });
        wrap.append(lab, input);
        return wrap;
    }

    function render() {
        if (!spec) return;
        Chart.draw(canvas, spec, values);
        const parts = spec.variables.map(
            (v) => v.symbol + " = " + Chart.fmt(values[v.symbol]) + unit(v.unit),
        );
        const vals = {};
        for (const v of spec.variables) vals[v.symbol] = values[v.symbol];
        const y = spec._eval ? spec._eval(vals) : NaN;
        readout.textContent =
            parts.join("   ·   ") +
            "   →   " +
            spec.y_label +
            " = " +
            Chart.fmt(y) +
            unit(spec.y_unit);
    }

    function renderBench() {
        el("b-title").textContent = spec.title;
        el("b-hook").textContent = spec.hook;

        const prose = el("b-explain");
        prose.innerHTML = "";
        for (const p of spec.explain) {
            const node = document.createElement("p");
            node.textContent = p;
            prose.appendChild(node);
        }

        const tryList = el("b-try");
        tryList.innerHTML = "";
        for (const t of spec.try_this) {
            const li = document.createElement("li");
            li.textContent = t;
            tryList.appendChild(li);
        }

        const factList = el("b-facts");
        factList.innerHTML = "";
        for (const f of spec.facts) {
            const li = document.createElement("li");
            li.textContent = f;
            factList.appendChild(li);
        }

        const src = el("b-sources");
        src.innerHTML = "";
        for (const s of spec.sources) {
            const li = document.createElement("li");
            li.textContent = s;
            src.appendChild(li);
        }
        if (!spec.sources.length) {
            const li = document.createElement("li");
            li.textContent = "No sources returned — verify with a textbook.";
            src.appendChild(li);
        }

        el("x-label").textContent =
            spec.variables[spec.x_index].name +
            unit(spec.variables[spec.x_index].unit);
        el("y-label").textContent = spec.y_label + unit(spec.y_unit);

        controls.innerHTML = "";
        for (const v of spec.variables) controls.appendChild(slider(v));

        el("l-title").textContent = "Interactive model";
        bench.hidden = false;
        render();
    }

    function defaults() {
        const out = {};
        for (const v of spec.variables) out[v.symbol] = v.default;
        return out;
    }

    function repaintControls() {
        controls.innerHTML = "";
        for (const v of spec.variables) controls.appendChild(slider(v));
        render();
    }

    function reset() {
        if (!spec) return;
        values = defaults();
        repaintControls();
    }

    function realValues() {
        if (!spec) return;
        for (const v of spec.variables) values[v.symbol] = v.real;
        repaintControls();
        setStatus("Set to the value a real system of this kind has.");
    }

    async function run() {
        const t = topic.value.trim();
        if (!t) {
            setStatus("Type a science topic first.", true);
            return;
        }
        if (!currentKey()) {
            setStatus("Connect a Pollinations key first — use the button at the top.", true);
            return;
        }
        build.disabled = true;
        setStatus("Building the bench… (one model call)");
        try {
            const reply = await PolliClient.chatCompletion(Prompt.messages(t), {
                apiKey: currentKey(),
                maxTokens: 2200,
                // deepseek-v4-flash rejects "low" (allowed: none/high/max) and its
                // default reasoning eats the whole output budget; "none" is what
                // returns a complete JSON spec.
                reasoningEffort: "none",
            });
            spec = Validate.parseSpec(reply);
            values = defaults();
            renderBench();
            built = true;
            setStatus(
                spec._fallback
                    ? "The model reply could not be parsed — showing a placeholder bench. Try again."
                    : "Ready. Drag the sliders.",
                spec._fallback,
            );
        } catch (err) {
            setStatus(String(err.message || err), true);
        } finally {
            build.disabled = false;
        }
    }

    build.addEventListener("click", run);
    topic.addEventListener("keydown", (e) => {
        if (e.key === "Enter") run();
    });
    el("reset").addEventListener("click", reset);
    el("real").addEventListener("click", realValues);
    window.addEventListener("resize", () => {
        if (built) render();
    });
    if (widget) widget.addEventListener("change", () => {
        if (currentKey() && status.classList.contains("error"))
            setStatus("Key connected. Press Build the bench.");
    });

    fillChips();
})();