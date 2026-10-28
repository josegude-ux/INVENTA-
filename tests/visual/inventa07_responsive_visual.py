#!/usr/bin/env python3
"""VISURA INVENTA 07 — optional local responsive smoke test.

Requires: pip install playwright; Chromium installed / playwright install chromium.
Runs only on synthetic inventory-ui/preview.html, never against production.
CSS is embedded in the page so this works under file://-restricted sandboxes.
This script is intentionally NOT part of the default Node CI.
"""
from __future__ import annotations
import argparse
import json
import os
import re
from pathlib import Path

DEFAULT_ROOT=Path(__file__).resolve().parents[2]
VIEWPORTS=[
    ("mobile-portrait",390,844),
    ("mobile-landscape",844,390),
    ("tablet-portrait",768,1024),
    ("tablet-landscape",1024,768),
    ("desktop-medium",1366,768),
    ("desktop-wide",1920,1080),
]
VIEWS=["count","locations","assignments","admin","provisionals","incidents","reports","close"]

def run(root:Path,output:Path,chromium_path:str|None=None)->list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit("Instala Playwright y Chromium para ejecutar las pruebas visuales.") from exc
    css=(root/"inventory-ui/responsive.css").read_text(encoding="utf-8")
    html=(root/"inventory-ui/preview.html").read_text(encoding="utf-8")
    match=re.search(r'<link\s+rel="stylesheet"\s+href="responsive\.css"\s*/?>',html)
    if not match:
        raise RuntimeError("No se ha encontrado la hoja de estilo esperada.")
    html=html[:match.start()]+"<style>"+css+"</style>"+html[match.end():]
    output.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as p:
        opts={"headless":True}
        if chromium_path: opts["executable_path"]=chromium_path
        browser=p.chromium.launch(**opts)
        try:
            for name,w,h in VIEWPORTS:
                page=browser.new_page(viewport={"width":w,"height":h},device_scale_factor=1)
                page.set_content(html,wait_until="load")
                for view in VIEWS:
                    page.evaluate("(view)=>{location.hash='#'+view;window.dispatchEvent(new Event('hashchange'));}",view)
                    visible=page.locator('[data-view]:visible')
                    if visible.count()!=1 or visible.first.get_attribute("id")!=view:
                        raise AssertionError(f"{name}/{view}: navegación de secciones incorrecta")
                    metrics=page.evaluate("""() => {
                        const nav=document.querySelector('.vi07-nav');
                        const main=document.querySelector('.vi07-main');
                        return {scrollWidth:document.documentElement.scrollWidth,
                            viewportWidth:innerWidth,
                            navDirection:getComputedStyle(nav).flexDirection,
                            navWidth:Math.round(nav.getBoundingClientRect().width),
                            mainWidth:Math.round(main.getBoundingClientRect().width)};
                    }""")
                    if metrics["scrollWidth"]>w:
                        raise AssertionError(f"{name}/{view}: desbordamiento horizontal {metrics}")
                    expected="row" if w<700 else "column"
                    if metrics["navDirection"]!=expected:
                        raise AssertionError(f"{name}/{view}: navegación esperada {expected}")
                    if w>=1180 and metrics["mainWidth"] < w*0.68:
                        raise AssertionError(f"{name}/{view}: el escritorio sigue excesivamente estrecho")
                    if view=="count":
                        detail=page.evaluate("""() => {
                            const f=document.querySelector('.vi07-count-fields').getBoundingClientRect();
                            const p=document.querySelector('.vi07-pallet-toggle').getBoundingClientRect();
                            const scans=[...document.querySelectorAll('.vi07-scan')];
                            const confirmed=document.querySelector('.vi07-confirmed');
                            return {palletBelowFields:p.top>=f.bottom,
                                minScanHeight:Math.min(...scans.map(x=>x.getBoundingClientRect().height)),
                                confirmedClosed:!confirmed.open};
                        }""")
                        if not(detail["palletBelowFields"] and detail["minScanHeight"]>=48 and detail["confirmedClosed"]):
                            raise AssertionError(f"{name}/count: controles mal distribuidos: {detail}")
                    if view=="count" or (name in ("mobile-portrait","desktop-wide") and view in ("assignments","incidents","close")):
                        page.screenshot(path=str(output/(name+"-"+view+".png")),full_page=True)
                    results.append(dict(view=view,viewport=name,width=w,height=h,**metrics))
                page.close()
        finally:
            browser.close()
    (output/"metrics.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    return results

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=DEFAULT_ROOT)
    parser.add_argument("--out",type=Path,default=Path("inventa07-responsive-artifacts"))
    parser.add_argument("--chromium",default=os.getenv("CHROMIUM_PATH"))
    args=parser.parse_args()
    result=run(args.root,args.out,args.chromium)
    print(f"PASS: {len(result)} combinaciones de viewport y vista, capturas en {args.out}")
