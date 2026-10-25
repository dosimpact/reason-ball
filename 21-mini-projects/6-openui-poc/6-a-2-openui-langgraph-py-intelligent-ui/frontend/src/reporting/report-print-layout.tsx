"use client";
import { useEffect } from "react";

/** Label cells so wide evidence tables can print as readable vertical records. */
export function ReportPrintLayout() {
  useEffect(() => {
    const originals = new Map<SVGSVGElement, string | null>();
    const fitCharts = () => document.querySelectorAll<SVGSVGElement>(".iui-chart svg").forEach((svg) => {
      if (!originals.has(svg)) originals.set(svg, svg.getAttribute("viewBox"));
      svg.setAttribute("viewBox", `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
    });
    const observer = new MutationObserver(fitCharts);
    const prepare = () => {
      document.querySelectorAll<HTMLTableElement>(".iui-table").forEach((table) => {
        const labels = Array.from(table.querySelectorAll("thead th"), (cell) => cell.textContent ?? "");
        table.querySelectorAll("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            (cell as HTMLElement).dataset.printLabel = labels[index] ?? "";
          });
        });
      });
      fitCharts();
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["width", "height"] });
    };
    const finish = () => {
      observer.disconnect();
      for (const [svg, value] of originals) {
        if (value === null) svg.removeAttribute("viewBox"); else svg.setAttribute("viewBox", value);
      }
      originals.clear();
    };
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", finish);
    return () => { finish(); window.removeEventListener("beforeprint", prepare); window.removeEventListener("afterprint", finish); };
  }, []);
  return null;
}
