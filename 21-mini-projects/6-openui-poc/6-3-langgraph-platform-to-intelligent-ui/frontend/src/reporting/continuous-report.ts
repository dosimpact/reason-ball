const tabbedRoot = 'root = Col([heading, quality, navigation, body])';
const continuousRoot = 'root = Col([heading, quality, overview, campaignView, inventoryView, actionView, evidenceView])';

/** Upgrade only the application's known vendor scaffold, preserving every source row and AI insight. */
export function continuousVendorReport(program: string): string {
  if (!(program.startsWith(tabbedRoot + "\n") || program.startsWith(continuousRoot + "\n"))
    || !program.includes('stockChart = Card(')) return program;
  return program.split("\n").flatMap((line) => {
    if (line === tabbedRoot) return [continuousRoot];
    if (/^(?:\$section|\$riskView|navigation|body) = /.test(line)) return [];
    if (line.startsWith('overview = Col([') && !line.startsWith('overview = Col([Title("성과 개요", "lg"), ')) return [line.replace('overview = Col([', 'overview = Col([Title("성과 개요", "lg"), ')];
    if (line.startsWith('inventoryView = Col([')) line = line
      .replace('SegmentedControl($riskView, ["제약 시간", "매출 위험"]), $riskView == "제약 시간" ? Card([', 'Card([Title("광고 적격성 제약 시간", "md"), ')
      .replace('Caption("섹션 7B · 단위: 시간")]) : Card([', 'Caption("섹션 7B · 단위: 시간")]), Card([Title("매출 위험 추정액", "md"), ');
    // Bare Unicode keys collapse during DSL evaluation even when parsing reports no errors.
    if (/^(?:campaignView|inventoryView|stockChart) = /.test(line)) {
      line = line.replace(/([{,]\s*)(캠페인|광고매출|광고수익률|목표|제약시간|위험추정액):/g, '$1"$2":');
    }
    return [line];
  }).join("\n");
}
