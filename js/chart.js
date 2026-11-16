/**
 * chart.js — a dependency-free plot for the bench: one swept variable, current value
 * marked, everything drawn from the spec's own numbers.
 */
(function (root) {
    const SAMPLES = 240;
    const PAD = { l: 52, r: 16, t: 16, b: 34 };

    function fmt(n) {
        if (!Number.isFinite(n)) return "—";
        const a = Math.abs(n);
        if (a !== 0 && (a < 1e-3 || a >= 1e5)) return n.toExponential(2);
        if (a >= 100) return n.toFixed(1);
        if (a >= 1) return n.toFixed(2);
        return n.toFixed(3);
    }

    function niceStep(span) {
        if (!(span > 0)) return 1;
        const rough = span / 4;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm = rough / mag;
        const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
        return step * mag;
    }

    function draw(canvas, spec, values) {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 620;
        const cssH = canvas.clientHeight || 360;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const xv = spec.variables[spec.x_index];
        const x0 = xv.min;
        const x1 = xv.max;

        const getVal = (sym) =>
            sym === xv.symbol ? values[sym] : values[sym] ?? 0;

        const pts = [];
        for (let i = 0; i <= SAMPLES; i++) {
            const x = x0 + ((x1 - x0) * i) / SAMPLES;
            const vals = {};
            for (const v of spec.variables) vals[v.symbol] = getVal(v.symbol);
            vals[xv.symbol] = x;
            const y = spec._eval ? spec._eval(vals) : NaN;
            pts.push({ x, y });
        }

        const finite = pts.filter((p) => Number.isFinite(p.y));
        if (!finite.length) {
            ctx.fillStyle = "#8fa3b5";
            ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
            ctx.fillText("No finite values in this range — move the sliders.", PAD.l, 40);
            return;
        }
        let yMin = Math.min(...finite.map((p) => p.y));
        let yMax = Math.max(...finite.map((p) => p.y));
        if (yMax - yMin < 1e-9) {
            yMin -= 0.5;
            yMax += 0.5;
        }
        const yPad = (yMax - yMin) * 0.08;
        yMin -= yPad;
        yMax += yPad;
        // Include zero when it is close, so a baseline reads naturally.
        if (yMin > 0 && yMin < (yMax - yMin) * 0.6) yMin = 0;
        if (yMax < 0 && -yMax < (yMax - yMin) * 0.6) yMax = 0;

        const plotW = cssW - PAD.l - PAD.r;
        const plotH = cssH - PAD.t - PAD.b;
        const sx = (x) => PAD.l + (plotW * (x - x0)) / (x1 - x0 || 1);
        const sy = (y) => PAD.t + plotH - (plotH * (y - yMin)) / (yMax - yMin || 1);

        // grid + y ticks
        ctx.font = "11.5px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "#8fa3b5";
        ctx.strokeStyle = "#223140";
        ctx.lineWidth = 1;
        const yStep = niceStep(yMax - yMin);
        for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
            const py = sy(y);
            ctx.beginPath();
            ctx.moveTo(PAD.l, py);
            ctx.lineTo(cssW - PAD.r, py);
            ctx.stroke();
            ctx.fillText(fmt(y), 6, py + 4);
        }

        // zero line
        if (yMin < 0 && yMax > 0) {
            ctx.strokeStyle = "#3a4a5a";
            ctx.beginPath();
            ctx.moveTo(PAD.l, sy(0));
            ctx.lineTo(cssW - PAD.r, sy(0));
            ctx.stroke();
        }

        // x ticks
        ctx.strokeStyle = "#223140";
        const xStep = niceStep(x1 - x0);
        ctx.textAlign = "center";
        for (let x = Math.ceil(x0 / xStep) * xStep; x <= x1; x += xStep) {
            const px = sx(x);
            ctx.beginPath();
            ctx.moveTo(px, PAD.t);
            ctx.lineTo(px, cssH - PAD.b);
            ctx.stroke();
            ctx.fillText(fmt(x), px, cssH - PAD.b + 18);
        }
        ctx.textAlign = "left";

        // curve
        ctx.strokeStyle = "#4dd0a7";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        let started = false;
        for (const p of pts) {
            if (!Number.isFinite(p.y)) {
                started = false;
                continue;
            }
            const px = sx(p.x);
            const py = sy(p.y);
            if (!started) {
                ctx.moveTo(px, py);
                started = true;
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        // current point
        const cv = getVal(xv.symbol);
        const vals = {};
        for (const v of spec.variables) vals[v.symbol] = getVal(v.symbol);
        vals[xv.symbol] = values[xv.symbol];
        const cy = spec._eval ? spec._eval(vals) : NaN;
        if (Number.isFinite(cy)) {
            const px = sx(values[xv.symbol]);
            const py = sy(cy);
            ctx.fillStyle = "#6aa8ff";
            ctx.beginPath();
            ctx.arc(px, py, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#0c1116";
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = "#e8eef4";
            ctx.font = "12.5px ui-sans-serif, system-ui, sans-serif";
            const label = fmt(cy) + (spec.y_unit ? " " + spec.y_unit : "");
            const tx = Math.min(px + 10, cssW - PAD.r - 60);
            ctx.fillText(label, tx, py - 8);
        }
    }

    root.Chart = { draw, fmt };
})(typeof self !== "undefined" ? self : globalThis);