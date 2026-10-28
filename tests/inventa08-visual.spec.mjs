import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const url="http://127.0.0.1:8765/fixed-stock-08/preview.html";
for(const [name,width] of [["escritorio",1440],["tableta",820],["móvil",390]]){
 test("VISURA 08 responsive "+name,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  const page=await context.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading",{name:"Control de posiciones fijas y stock"})).toBeVisible();
  await expect(page.locator("#resultCount")).toContainText("4 asociaciones");
  const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.view+1);
  if(width<=620){
   await expect(page.locator("#reportCards")).toBeVisible();
   await expect(page.locator(".tableWrap")).toBeHidden();
  }else await expect(page.locator(".tableWrap")).toBeVisible();
  await page.locator("#location").fill("K02");
  await expect(page.locator("#resultCount")).toContainText("2 asociaciones");
  const first=(width<=620?page.locator("#reportCards"):page.locator("#reportRows"));
  await first.getByRole("button",{name:"Abrir ficha"}).first().click();
  await expect(page.locator("#detail")).toBeVisible();
  await page.getByRole("button",{name:"Volver al informe"}).click();
  await expect(page.locator("#location")).toHaveValue("K02");
  await expect(page.locator("#resultCount")).toContainText("2 asociaciones");
  if(name==="escritorio"){
   const promise=page.waitForEvent("download");
   await page.getByRole("button",{name:/Exportar XLSX/}).click();
   const download=await promise;
   const path=await download.path(),buf=readFileSync(path);
   expect(buf.subarray(0,2).toString()).toBe("PK");
   expect(buf.includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(true);
   expect(buf.includes(Buffer.from("xl/worksheets/sheet2.xml"))).toBe(false);
  }
  await context.close();
 });
}
