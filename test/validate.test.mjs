// Guards the formula whitelist: decimal literals must survive, member access
// must not. The first version rejected every dot outside Math.*, so a model
// reply like "0.5 * k * x" was silently replaced by y = x.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ctx = { Math, console };
ctx.self = { PolliClient: { extractJson: (t) => t } };
vm.createContext(ctx);
vm.runInContext(readFileSync("js/validate.js", "utf8"), ctx);
const V = ctx.self.Validate;

const spec = (formula) =>
    V.parseSpec(
        JSON.stringify({
            title: "t",
            variables: [
                { symbol: "x", min: 0, max: 10, default: 5 },
                { symbol: "k", min: 0.1, max: 3, default: 1 },
            ],
            formula,
            y_label: "y",
        }),
    );

test("decimal literals compile", () => {
    for (const f of ["0.5 * x", "x * 1.5", ".5 * x", "1. * x", "k * x + 2.5"]) {
        const fn = V.compileFormula(f, ["x", "k"]);
        assert.ok(fn, `${f} should compile`);
    }
});

test("a decimal formula is evaluated, not swapped for y = x", () => {
    const s = spec("0.5 * k * x");
    assert.equal(s.formula, "0.5 * k * x");
    assert.equal(s._formulaRejected, false);
    assert.equal(s._eval({ x: 4, k: 1 }), 2);
});

test("Math.* keeps working", () => {
    assert.equal(V.compileFormula("Math.sqrt(x)", ["x"])({ x: 4 }), 2);
    assert.ok(Math.abs(V.compileFormula("Math.PI * x", ["x"])({ x: 1 }) - Math.PI) < 1e-12);
});

test("member access is still rejected", () => {
    for (const f of ["x.constructor", "x . toString()", "x.at(0)", "x..y"]) {
        assert.equal(V.compileFormula(f, ["x", "k"]), null, `${f} must not compile`);
    }
});

test("a rejected formula is reported instead of passed off as the model's", () => {
    const s = spec("x.at(0)");
    assert.equal(s.formula, "x");
    assert.equal(s._formulaRejected, true);
});
