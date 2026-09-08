(() => {
  // Cover the entire sidebar header, including its outer padding. Root-level
  // rectangles keep native drag areas independent of the sidebar's clipping.
  // Windows still owns moving, snapping and double-clicking.
  const sidebar = document.querySelector('.sidebar');
  const navigation = document.querySelector('.navigation');
  const toggle = document.querySelector('#compact-toggle');
  const title = document.querySelector('.titlebar-drag');
  const regions = Array.from({length:5}, () => {
    const region = document.createElement('div');
    region.className = 'native-window-drag-region';
    region.setAttribute('aria-hidden', 'true');
    region.hidden = true;
    document.body.append(region);
    return region;
  });
  const lastStyles = [];
  let queued = false;
  function update() {
    queued = false;
    const s = sidebar.getBoundingClientRect(), n = navigation.getBoundingClientRect();
    const b = {left:0,top:0,right:Math.ceil(s.right),bottom:Math.floor(n.top),width:Math.ceil(s.right)};
    const c = toggle.getBoundingClientRect(), t = title.getBoundingClientRect();
    // The button is the only hole in the full sidebar header drag area.
    // Round shared edges once to avoid hairline gaps at fractional DPI scales.
    const left = Math.max(b.left, Math.floor(c.left)), right = Math.min(b.right, Math.ceil(c.right));
    const top = Math.max(b.top, Math.floor(c.top)), bottom = Math.min(b.bottom, Math.ceil(c.bottom));
    const rectangles = [
      {x:b.left,y:b.top,width:b.width,height:top-b.top},
      {x:b.left,y:top,width:left-b.left,height:bottom-top},
      {x:right,y:top,width:b.right-right,height:bottom-top},
      {x:b.left,y:bottom,width:b.width,height:b.bottom-bottom},
      {x:t.left,y:t.top,width:t.width,height:t.height},
    ];
    const modal = !!document.querySelector('dialog[open]');
    rectangles.forEach((r, index) => {
      // Round inward so fractional DPI coordinates never encroach on controls.
      const x = Math.max(0,Math.ceil(r.x)), y = Math.max(0,Math.ceil(r.y));
      const width = Math.min(innerWidth,Math.floor(r.x+r.width))-x;
      const height = Math.min(innerHeight,Math.floor(r.y+r.height))-y;
      const region = regions[index];
      region.hidden = modal || width < 1 || height < 1;
      const css = `left:${x}px;top:${y}px;width:${Math.max(0,width)}px;height:${Math.max(0,height)}px;`;
      if (lastStyles[index] !== css) { region.style.cssText = css; lastStyles[index] = css; }
    });
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  const sizeObserver = new ResizeObserver(schedule);
  [sidebar,navigation,toggle,title,document.documentElement].forEach(element => sizeObserver.observe(element));
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-sidebar']});
  const dialogObserver = new MutationObserver(schedule);
  document.querySelectorAll('dialog').forEach(dialog => dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  window.addEventListener('resize',schedule);
  schedule();
})();
