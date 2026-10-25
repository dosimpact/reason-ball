/** Source-derived report scaffold/fallback. No filesystem access or vendor-specific facts. */
export type SourceTable = { section: string; columns: string[]; rows: string[][] };
const clean = (text: string) => text.replace(/<br\s*\/?\s*>/gi, " · ").replace(/\*\*/g, "").trim();
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((cell) => clean(cell.replace(/\\\|/g, "|")));
export function parseSourceTables(source: string): SourceTable[] {
  const tables: SourceTable[] = [];
  const lines = source.split(/\r?\n/);
  let section = "원문";
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) section = clean(lines[i].replace(/^#+\s*/, ""));
    if (!lines[i].trim().startsWith("|") || !/^\s*\|?[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) continue;
    const columns = cells(lines[i]);
    const rows: string[][] = [];
    i += 2;
    while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
    i--;
    tables.push({ section, columns, rows });
  }
  return tables;
}

export function sourceNumber(value: string): number | null {
  const text = value.replace(/,/g, "").replace(/[−–]/g, "-");
  if (/확인 불가|정량화|미정|이용 불가|N\/A/i.test(text)) return null;
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function sourceHours(value: string): number | null {
  const hours = [...value.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(?:시간|hours?\b|h\b)/gi)].map((match) => Number(match[1]));
  const unique = [...new Set(hours)];
  return unique.length === 1 ? unique[0] : null;
}

const column = (table: SourceTable, pattern: RegExp) => table.columns.findIndex((label) => pattern.test(label));
const q = (value: unknown) => JSON.stringify(value);
const field = (row: string[], index: number) => index >= 0 ? (row[index] ?? "") : "";
const tableFor = (tables: SourceTable[], pattern: RegExp) => tables.find((table) => pattern.test(table.section));

export function reportSource(messages: { role: string; content?: unknown }[]): string | null {
  for (const message of messages) {
    if (typeof message.content !== "string") continue;
    let source: string;
    if (message.role === "assistant") {
      // A classifier may select the prior report itself. Recover its preserved
      // original document rather than asking the model to rewrite numeric rows.
      if (!/^root = Col\(\[heading, quality, (?:navigation, body|overview, campaignView, inventoryView, actionView, evidenceView)\]\)/.test(message.content)
        || !message.content.includes('stockChart = Card(')) continue;
      const literal = message.content.match(/Popover\("전체 원문 보기", \[Markdown\(("(?:[^"\\]|\\.)*")\)\]\)/)?.[1];
      if (!literal) continue;
      try { source = JSON.parse(literal); } catch { continue; }
    } else if (message.role === "user") {
      const match = message.content.match(/<report-source>\n([\s\S]*)\n<\/report-source>/);
      source = match?.[1] ?? message.content;
    } else continue;
    const tables = parseSourceTables(source);
    if (tables.length >= 3 && tables[0].columns.length === 4 && /지표/.test(tables[0].columns[0])) return source;
  }
  return null;
}

export function buildVendorReport(source: string): string | null {
  const tables = parseSourceTables(source);
  const metrics = tables[0];
  const campaignTable = tableFor(tables, /3\s*A/i);
  const riskTable = tableFor(tables, /7\s*B/i);
  if (!metrics || !campaignTable || !riskTable) return null;
  const diagnosisTable = tableFor(tables, /3\s*B/i);
  const actionTable = tables.find((table) => table.columns.some((label) => /우선 조치|우선.*액션/.test(label)));
  const title = clean(source.match(/공급업체\d+[^\n]*?보고서/)?.[0] ?? source.match(/공급업체\d+/)?.[0] ?? "벤더 성과 분석");
  const period = source.match(/\d{4}년[^\n]*?(?:14일|14일\))/)?.[0] ?? "원문에 기재된 분석 기간 · W1 / W2";
  const discrepancies = metrics.rows.flatMap(([label, w1, w2, delta]) => {
    const a = sourceNumber(w1), b = sourceNumber(w2), d = sourceNumber(delta);
    if (a === null || b === null || d === null || /%/.test(w1) || !/원/.test(w1)) return [];
    return Math.abs((b - a) - d) > .01 ? [`${label}: ${w1} → ${w2}, 원문 변화 ${delta}. 기간별 값과 변화량 확인 필요.`] : [];
  });
  // Period amounts and stated deltas stay separate; nothing gets "corrected".
  const metricRows = metrics.rows.map(([label, w1, w2, delta]) => ({ label, w1, w2, delta }));
  const metric = (pattern: RegExp) => metrics.rows.find((row) => pattern.test(row[0]));
  const revenue = metric(/광고\s*매출/), spend = metric(/광고비/), roas = metric(/광고수익률|ROAS/), cvr = metric(/전환율|CVR/);
  if (![revenue, spend, roas, cvr].every((row) => row && sourceNumber(row[1]) !== null && sourceNumber(row[2]) !== null)) return null;
  const periodRows = [1, 2].map((i) => ({ "기간": i === 1 ? "W1" : "W2", "광고매출": revenue ? sourceNumber(revenue[i]) : null, "광고비": spend ? sourceNumber(spend[i]) : null }));
  const ratioRows = [1, 2].map((i) => ({ "기간": i === 1 ? "W1" : "W2", "광고수익률": roas ? sourceNumber(roas[i]) : null, 전환율: cvr ? sourceNumber(cvr[i]) : null }));
  const campaignId = column(campaignTable, /캠페인\s*ID/i);
  const campaignName = column(campaignTable, /캠페인명|캠페인 이름/);
  const currentRevenue = column(campaignTable, /이후.*매출|W2.*매출|현재.*매출|2주차.*매출|매출.*(?:W2|이후)/);
  const campaignRoas = column(campaignTable, /^(?:광고수익률|ROAS)(?:\s*\(ROAS\))?$/i);
  const target = column(campaignTable, /목표.*(?:광고수익률|ROAS)|T\.?\s*ROAS/i);
  const campaigns = campaignTable.rows.map((row) => {
    const id = field(row, campaignId);
    const diagnosis = diagnosisTable?.rows.find((entry) => entry.some((cell) => cell === id));
    const descriptionIndex = diagnosisTable ? column(diagnosisTable, /^진단/) : -1;
    const actionIndex = diagnosisTable ? column(diagnosisTable, /추천|권장|권고|제안/) : -1;
    return { id, name: field(row, campaignName) || id, revenue: sourceNumber(field(row, currentRevenue)), roas: sourceNumber(field(row, campaignRoas)), target: sourceNumber(field(row, target)), diagnosis: diagnosis ? field(diagnosis, descriptionIndex) : "원문 진단 참조", action: diagnosis ? field(diagnosis, actionIndex) : "추가 근거 확인" };
  });
  const riskId = column(riskTable, /^VID$/i);
  const riskName = column(riskTable, /상품|아이템|VID.*옵션/);
  const issue = column(riskTable, /(?:적격|자격).*상태/);
  const hours = column(riskTable, /(?:이슈|문제).*근거|근거.*시간/);
  const riskAmount = column(riskTable, /매출.*(?:영향|위험)/);
  const riskShare = column(riskTable, /(?:매출.*기여|기여도)/);
  const riskSummary = column(riskTable, /핵심|요약/);
  const risks = riskTable.rows.map((row) => ({
    id: field(row, riskId), name: field(row, riskName),
    // Zero is allowed only when the original explicitly states zero.
    hours: sourceHours(field(row, hours)), amount: sourceNumber(field(row, riskAmount)),
    share: sourceNumber(field(row, riskShare)), issue: field(row, issue), summary: field(row, riskSummary),
  }));
  if (!campaigns.length || !risks.length || campaigns.some((row) => !row.id) || risks.some((row) => !row.id)) return null;
  const actions = (actionTable?.rows ?? []).map((row, i) => ({ id: `action${i}`, title: row[2] ?? row[1], evidence: row.at(-1) ?? "", impact: row[3] ?? "확인 불가" }));
  if (!actions.length) {
    for (const [i, campaign] of campaigns.entries()) actions.push({ id: `action${i}`, title: `${campaign.name} · 원문 조치 검토`, evidence: campaign.action, impact: "원문 기준 · 추가 추정 없음" });
  }
  const hasEqualBudget = tables.some((table) => {
    const current = column(table, /현재.*예산/), recommended = column(table, /추천.*예산|권장.*예산/);
    return current >= 0 && recommended >= 0 && table.rows.some((row) => sourceNumber(row[current]) !== null && sourceNumber(row[current]) === sourceNumber(row[recommended]));
  });
  if (hasEqualBudget) discrepancies.push("현재 예산과 추천 예산이 같은 행이 있습니다. 원문의 '증액' 권고는 실행 전 확인이 필요합니다.");
  const warnings = discrepancies.length ? discrepancies : ["섹션별 집계 기간과 단위를 구분해 표시합니다. 원문 값과 추정 위험액을 임의로 합산하지 않습니다."];
  const warningTitle = discrepancies.length ? "원문 수치 확인 필요" : "원문 기준과 해석 범위";
  const evidenceTables = tables.map((table) => ({ section: table.section, columns: table.columns, rows: table.rows }));
  const maxHours = Math.max(1, ...risks.map((row) => row.hours ?? 0)) + 1;
  const code = [
    'root = Col([heading, quality, overview, campaignView, inventoryView, actionView, evidenceView])',
    '$campaign = "전체"', '$done = []', '$minHours = 0', '$evidence = "전체"',
    `heading = Col([Title(${q(`${title} · 인터랙티브 보고서`)}, "xl"), Text(${q(period)}, "sm", "muted"), Row([Badge("원문 기반", "info"), Badge("W1 / W2 비교", "purple"), Badge("로컬 필터 · 상태 저장", "success")], 2)])`,
    `quality = Card([Row([Title(${q(warningTitle)}, "md"), Badge(${q(`${warnings.length}개 확인 사항`)}, "warning")], 2), Text(${q(warnings[0])}, "sm", "warning"), Popover("확인 사항 전체", [Col(@Each(${q(warnings)}, "w", Text(w, "sm")), 2)]), Caption("원문 기재 값 유지 · 다른 기간과 단위를 합산하지 않음")], "soft")`,
    `metrics = ${q(metricRows)}`, `periods = ${q(periodRows)}`, `ratios = ${q(ratioRows)}`, `campaigns = ${q(campaigns)}`, `knownTargetCampaigns = ${q(campaigns.filter((row) => row.target !== null && row.roas !== null))}`, `risks = ${q(risks)}`, `knownHourRisks = ${q(risks.filter((row) => row.hours !== null))}`, `knownAmountRisks = ${q(risks.filter((row) => row.hours !== null && row.amount !== null))}`, `actions = ${q(actions)}`, `evidence = ${q(evidenceTables)}`,
    'kpis = Grid(@Each(metrics, "m", Card([Caption(m.label), Title(m.w2, "md"), Row([Badge("W1 " + m.w1), Badge("기재 변화 " + m.delta, "info")], 1, null, null, true)])), 3, 175, 3)',
    'moneyChart = Card([Title("기간별 광고 매출 · 광고비", "md"), Chart("bar", periods, "기간", ["광고매출", "광고비"], "currency", "KRW"), Caption("섹션 1의 기간별 원문 값 · 일별 추이 아님")])',
    'efficiencyChart = Card([Title("광고수익률 비교", "md"), Chart("bar", ratios, "기간", ["광고수익률"], "percent"), Caption("섹션 1 · 단위 %")])',
    'conversionChart = Card([Title("전환율 비교", "md"), Chart("bar", ratios, "기간", ["전환율"], "percent"), Caption("섹션 1 · ROAS와 별도 축으로 비교")])',
    'overview = Col([Title("성과 개요", "lg"), Text("주요 지표를 비교하고, 캠페인 진단과 재고 위험을 탐색한 뒤 실행할 조치를 확인하세요.", "sm", "muted"), kpis, moneyChart, Grid([efficiencyChart, conversionChart], 2, 280, 4), stockChart])',
    'visible = $campaign == "전체" ? campaigns : @Filter(campaigns, "id", "==", $campaign)',
    'visibleTargets = $campaign == "전체" ? knownTargetCampaigns : @Filter(knownTargetCampaigns, "id", "==", $campaign)',
    'campaignOptions = @Concat([{value: "전체", label: "전체 캠페인"}], @Each(campaigns, "c", {value: c.id, label: c.name + " · " + c.id}))',
    'campaignView = Col([Title("캠페인 탐색", "lg"), Select($campaign, campaignOptions, "캠페인 선택"), Grid([Card([Title("광고 매출", "md"), Chart("bar", @Each(visible, "c", {"캠페인": c.name, "광고매출": c.revenue}), "캠페인", ["광고매출"], "currency", "KRW"), Caption("섹션 3A · 이후 매출")]), Card([Title("캠페인 ROAS", "md"), Chart("bar", @Each(visible, "c", {"캠페인": c.name, "광고수익률": c.roas}), "캠페인", ["광고수익률"], "percent"), Caption("섹션 3A의 원문 값 · 다른 섹션 수치와 혼합하지 않음")])], 2, 280, 4), @Count(visibleTargets) > 0 ? Card([Title("목표 대비 ROAS", "md"), Chart("bar", @Each(visibleTargets, "c", {"캠페인": c.name, "광고수익률": c.roas, "목표": c.target}), "캠페인", ["광고수익률", "목표"], "percent"), Caption("목표가 수치로 제공된 캠페인만 표시 · 미기재 목표는 0으로 보정하지 않음")]) : Text("선택 캠페인의 목표 ROAS 수치가 없습니다.", "sm", "muted"), Col(@Each(visible, "c", Card([Row([Title(c.name, "md"), Badge(c.id, "info")], 2), Text(c.diagnosis, "sm"), Popover("추천 조치와 근거", [Text(c.action, "sm"), Caption("섹션 3B 원문")])])))])',
    'filteredRisks = @Filter(knownHourRisks, "hours", ">=", $minHours)',
    'filteredAmounts = @Filter(knownAmountRisks, "hours", ">=", $minHours)',
    'stockChart = Card([Title("VID별 광고 적격성 제약 시간", "md"), @Count(knownHourRisks) > 0 ? Chart("bar", @Each(knownHourRisks, "r", {VID: r.id, "제약시간": r.hours}), "VID", ["제약시간"]) : Text("수치로 제공된 제약 시간이 없습니다. 원문 근거에서 상태를 확인하세요.", "sm", "muted"), Caption("섹션 7B · 원문 이슈 시간 · 품절/노출 제한 등 유형을 구분하며 중복 시간은 합산하지 않음")])',
    `inventoryView = Col([Title("재고 위험 탐색", "lg"), Slider($minHours, 0, ${maxHours}, 1, "최소 제약 시간", "시간"), Caption(@Count(filteredRisks) + "개 VID 표시"), Card([Title("광고 적격성 제약 시간", "md"), @Count(filteredRisks) > 0 ? Chart("bar", @Each(filteredRisks, "r", {VID: r.id, "제약시간": r.hours}), "VID", ["제약시간"]) : Text("표시할 제약 시간 데이터가 없습니다.", "sm", "muted"), Caption("섹션 7B · 단위: 시간")]), Card([Title("매출 위험 추정액", "md"), @Count(filteredAmounts) > 0 ? Chart("bar", @Each(filteredAmounts, "r", {VID: r.id, "위험추정액": r.amount}), "VID", ["위험추정액"], "currency", "KRW") : Text("수치로 제공된 매출 위험 추정액이 없습니다.", "sm", "muted"), Caption("섹션 7B의 추정 위험액 · 확정 손실이 아니며 중복 위험을 합산하지 않음")]), Grid(@Each(filteredRisks, "r", Card([Title(r.id, "md"), Text(r.name, "sm"), Badge(r.issue, "warning"), Text(r.summary, "sm")])), 2, 260, 3), Popover("재고 원문 전체", [Table(["VID", "시간 원문 여부", "근거"], @Each(risks, "r", [r.id, r.hours == null ? "확인 불가" : r.hours + "시간", r.summary]))])])`,
    'actionView = Col([Title("실행 체크리스트", "lg"), Text("원문 권고와 실행 가능 여부를 함께 확인하세요. 체크는 개인 진행 상태이며 실제 예산이나 재고를 변경하지 않습니다.", "sm", "muted"), Caption(@Count($done) + " / " + @Count(actions) + " 완료"), Col(@Each(actions, "a", Pressable([Row([Icon(@Includes($done, a.id) ? "check-circle" : "circle", "sm"), Title(a.title, "md")], 2), Text(a.evidence, "sm"), Badge("원문 예상 효과: " + a.impact, "info")], @Set($done, @Toggle($done, a.id)), @Includes($done, a.id), 4))), Button("조치 요약 복사", @CopyToClipboard(@Join(@Each(actions, "a", a.title + " · " + a.evidence), "\\n")), "outline", null, "sm", "copy")])',
    'evidenceOptions = @Concat([{value: "전체", label: "전체 섹션"}], @Each(evidence, "e", {value: e.section, label: e.section}))',
    'visibleEvidence = $evidence == "전체" ? evidence : @Filter(evidence, "section", "==", $evidence)',
    `evidenceView = Col([Title("원문 근거", "lg"), Select($evidence, evidenceOptions, "근거 섹션 선택"), Col(@Each(visibleEvidence, "e", Col([Title(e.section, "md"), Table(e.columns, e.rows)]))), Popover("전체 원문 보기", [Markdown(${q(source)})])])`,
  ];
  return code.join("\n");
}
