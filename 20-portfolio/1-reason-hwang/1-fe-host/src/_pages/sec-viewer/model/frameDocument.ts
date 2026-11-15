const tags = new Set("div p span h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td caption colgroup col ul ol li dl dt dd strong b em i u s sub sup br hr a blockquote pre".split(" "));
const removeSubtree = new Set("script style iframe object embed svg math form input button select textarea link meta base template noscript".split(" "));
const styles = new Set("color background-color font-family font-size font-weight font-style line-height text-align text-indent text-decoration vertical-align white-space width min-width max-width height border border-top border-bottom border-left border-right border-color border-width border-style border-collapse border-spacing padding padding-top padding-bottom padding-left padding-right margin margin-top margin-bottom margin-left margin-right".split(" "));

/** Rebuild display markup rather than attaching the parsed source to the Host DOM. */
function safeBody(source: string) {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const target = document.implementation.createHTMLDocument("");
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(target.createTextNode(node.textContent ?? "")); return; }
    if (!(node instanceof Element)) return;
    const tag = node.localName.toLowerCase();
    if (removeSubtree.has(tag)) return;
    if (!tags.has(tag)) { node.childNodes.forEach(child => copy(child, parent)); return; }
    const element = target.createElement(tag);
    const id = node.getAttribute("id"); const factId = node.getAttribute("data-fact-id");
    if (id && /^ix-segment-\d+-\d+$/.test(id)) element.id = id;
    if (factId && /^ix-fact-\d+$/.test(factId)) { element.setAttribute("data-fact-id", factId); element.tabIndex = 0; element.setAttribute("role", "button"); element.setAttribute("aria-label", "XBRL fact 상세"); }
    if (["td", "th", "col"].includes(tag)) for (const key of ["colspan", "rowspan", "span"]) { const value = node.getAttribute(key); if (value && /^[1-9]\d{0,3}$/.test(value)) element.setAttribute(key, value); }
    if (node instanceof HTMLElement) for (const key of Array.from(node.style)) {
      const value = node.style.getPropertyValue(key);
      if (styles.has(key) && !/url\s*\(|expression|@import|javascript:|vbscript:|behavior|-moz-binding/i.test(value)) element.style.setProperty(key, value);
    }
    node.childNodes.forEach(child => copy(child, element)); parent.appendChild(element);
  }
  parsed.body.childNodes.forEach(node => copy(node, target.body));
  return target.body.innerHTML;
}
export function createFrameDocument(source: string, sourceHash: string, channelId: string, hostOrigin: string) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const config = JSON.stringify({ sourceHash, channelId, hostOrigin }).replace(/</g, "\\u003c");
  const bridge = `(() => {
    const config = ${config}; const version = 1;
    const anchors = new Map();
    for (const node of document.querySelectorAll('[data-fact-id]')) { const id = node.getAttribute('data-fact-id'); if (!/^ix-fact-\\d+$/.test(id)) continue; if (!anchors.has(id)) anchors.set(id, []); anchors.get(id).push(node); }
    const send = (type, extra = {}) => parent.postMessage({type,version,channelId:config.channelId,sourceHash:config.sourceHash,...extra},config.hostOrigin);
    function select(id, scroll) { for (const node of document.querySelectorAll('.viewer-selected')) node.classList.remove('viewer-selected'); const found = anchors.get(id); if (!found?.length) { send('sec-ixbrl:missing',{factId:id}); return; } found.forEach(node=>node.classList.add('viewer-selected')); if(scroll) found[0].scrollIntoView({block:'center',behavior:'auto'}); }
    addEventListener('message', event => { const data = event.data; if(event.source!==parent || event.origin!==config.hostOrigin || !data || typeof data!=='object' || Array.isArray(data) || data.version!==version || data.channelId!==config.channelId || data.sourceHash!==config.sourceHash) return; if(Object.keys(data).some(key=>!['type','version','channelId','sourceHash','factId'].includes(key))) return; if(data.type==='sec-ixbrl:init') send('sec-ixbrl:ready',{anchorCount:[...anchors.values()].reduce((sum,list)=>sum+list.length,0)}); else if(data.type==='sec-ixbrl:focus' && typeof data.factId==='string' && /^ix-fact-\\d+$/.test(data.factId)) select(data.factId,true); });
    const click = event => { const node = event.target instanceof Element ? event.target.closest('[data-fact-id]') : null; if(!node) return; event.preventDefault(); const id=node.getAttribute('data-fact-id'); if(anchors.has(id)){select(id,false);send('sec-ixbrl:select',{factId:id});} };
    addEventListener('click',click); addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){click(event);}});
  })();`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;line-height:1.5;margin:16px;background:#fff;color:#171717;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}[data-fact-id]{cursor:pointer}[data-fact-id]:hover,[data-fact-id]:focus{outline:2px solid #3b82f6;outline-offset:2px}.viewer-selected{background:#fff3a6!important;outline:2px solid #b77900!important;outline-offset:1px}td,th{vertical-align:top}</style></head><body>${safeBody(source)}<script nonce="${nonce}">${bridge}</script></body></html>`;
}
