// Runs in the remote page only to READ visible article text. No theme injection,
// form values, cookies, storage, frames, scripts, or browser credentials are read.
const EXTRACT_PAGE = `(() => {
  const reject = 'script,style,noscript,template,input,textarea,select,button,nav,aside,menu,header,footer,figure,[contenteditable],[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="complementary"],[role="contentinfo"]';
  const visible = element => {
    if (!element || element.closest(reject) || !element.getClientRects().length) return false;
    for (let p = element; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    return true;
  };
  const statsOf = element => {
    const text = (element.innerText || '').replace(/\\s+/g, ' ').trim();
    const linkText = Array.from(element.querySelectorAll('a')).map(a => (a.innerText || '').trim()).join(' ').replace(/\\s+/g, ' ').trim();
    return { length: text.length, linkDensity: text.length ? Math.min(1, linkText.length / text.length) : 1 };
  };
  const seen = new Set();
  const picks = (sel, bonus) => Array.from(document.querySelectorAll(sel)).slice(0, 12)
    .filter(el => el && !seen.has(el) && (seen.add(el), true))
    .map(el => ({ el, bonus }));
  const semantic = [...picks('article', 1.25), ...picks('main,[role="main"]', 1.15)];
  const heuristic = picks('[class*="content" i],[id*="content" i],[class*="post-body" i],[class*="article-body" i],[class*="entry-content" i],[id*="article" i]', 1.0);
  let root = document.body;
  let best = -1;
  for (const { el, bonus } of [...semantic, ...heuristic]) {
    if (!visible(el)) continue;
    const { length, linkDensity } = statsOf(el);
    if (length < 200 || linkDensity > 0.6) continue;
    const score = length * (1 - linkDensity) * bonus;
    if (score > best) { best = score; root = el; }
  }
  if (!root || root === document.body) root = document.querySelector('article') || document.querySelector('main') || document.body;
  if (!root) return { title: document.title, text: '', selection: '' };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts = [];
  let length = 0;
  while (walker.nextNode() && length < 50000) {
    const node = walker.currentNode;
    if (!visible(node.parentElement)) continue;
    const text = node.textContent.replace(/\\s+/g, ' ').trim();
    if (text) { parts.push(text); length += text.length; }
  }
  const selection = window.getSelection();
  const selectedParts = [];
  if (selection?.rangeCount && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const selectedWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let selectedLength = 0;
    while (selectedWalker.nextNode() && selectedLength < 12000) {
      const node = selectedWalker.currentNode;
      if (!visible(node.parentElement) || !range.intersectsNode(node)) continue;
      const start = range.startContainer === node ? range.startOffset : 0;
      const end = range.endContainer === node ? range.endOffset : node.textContent.length;
      const text = node.textContent.slice(start, end).trim();
      if (text) { selectedParts.push(text); selectedLength += text.length; }
    }
  }
  const safeSelection = selectedParts.join('\\n').slice(0, 12000);
  return { title: document.title.slice(0,300), text: parts.join('\\n\\n').slice(0,50000), selection: safeSelection };
})()`;

const CAN_SUSPEND = `(() => ({
  hasFrames: document.querySelectorAll('iframe,frame').length > 0,
  media: Array.from(document.querySelectorAll('video,audio')).some(m => !m.paused),
  edited: Array.from(document.querySelectorAll('input:not([type=password]),textarea,select')).some(e => 'value' in e && e.value !== (e.defaultValue ?? '')) || !!document.querySelector('[contenteditable="true"]')
}))()`;
module.exports = { EXTRACT_PAGE, CAN_SUSPEND };
