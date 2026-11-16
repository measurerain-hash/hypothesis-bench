#!/usr/bin/env python3
"""Headless end-to-end check for Hypothesis Bench.

Serves the site from an in-process server on an OS-assigned port (so it can never
collide with another process on this box), stubs the Pollinations completion with a
canned spec, then drives the real UI: build -> sliders -> chart. Also checks the
fallback path.
"""
import json
import pathlib
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome"
SPEC = json.loads(open("/tmp/spec_raw.txt").read().strip())
SPEC_TEXT = json.dumps(SPEC)


def start_server():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def completion_body(text):
    return {"choices": [{"message": {"role": "assistant", "content": text}}]}


def wait_widget(page, tries=60):
    for _ in range(tries):
        if page.evaluate("!!document.querySelector('polli-connect')"):
            return
        page.wait_for_timeout(150)
    raise AssertionError("polli-connect never appeared")


def set_key(page):
    page.evaluate("document.querySelector('polli-connect').apiKey='sk_test_key'")


def main():
    httpd, port = start_server()
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            page = browser.new_page(viewport={"width": 1280, "height": 1000})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

            url = f"http://127.0.0.1:{port}/index.html"

            # --- happy path ---
            page.route(
                "**/v1/chat/completions",
                lambda r: r.fulfill(
                    status=200, content_type="application/json",
                    body=json.dumps(completion_body(SPEC_TEXT)),
                ),
            )
            page.goto(url, wait_until="domcontentloaded")
            wait_widget(page)
            set_key(page)
            page.fill("#topic", "radioactive decay")
            page.click("#build")
            page.wait_for_selector("#bench:not([hidden])", timeout=10000)

            nvar = len(SPEC["variables"])
            assert page.locator("#controls .control").count() == nvar, "wrong slider count"
            assert "=" in page.inner_text("#readout"), "readout empty"

            painted = page.evaluate(
                """() => {
                    const c=document.getElementById('chart');
                    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                    const seen=new Set();
                    for(let i=0;i<d.length;i+=4){ seen.add(d[i]+','+d[i+1]+','+d[i+2]); if(seen.size>4) return true; }
                    return false;
                }"""
            )
            assert painted, "canvas looks blank"

            before = page.inner_text("#readout")
            page.locator("#controls input[type=range]").first.evaluate(
                "el => { el.value = el.max; el.dispatchEvent(new Event('input',{bubbles:true})); }"
            )
            after = page.inner_text("#readout")
            assert before != after, "readout did not change when a slider moved"

            print(f"  HAPPY PATH ok — title={page.inner_text('#b-title')!r}, sliders={nvar}")
            page.screenshot(path=str(ROOT / "images" / "screenshot.png"), full_page=True)

            # --- fallback path ---
            page.unroute("**/v1/chat/completions")
            page.route(
                "**/v1/chat/completions",
                lambda r: r.fulfill(
                    status=200, content_type="application/json",
                    body=json.dumps(completion_body("sorry, no json here")),
                ),
            )
            page.reload(wait_until="domcontentloaded")
            wait_widget(page)
            set_key(page)
            page.fill("#topic", "anything")
            page.click("#build")
            page.wait_for_selector("#bench:not([hidden])", timeout=10000)
            assert page.locator("#controls .control").count() >= 1, "fallback bench has no sliders"
            print("  FALLBACK PATH ok — placeholder bench rendered")

            browser.close()
    finally:
        httpd.shutdown()

    hard = [e for e in errors if "favicon" not in e and "jsdelivr" not in e]
    if hard:
        print("  console errors:", hard)
        return 1
    print("  no page/console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())