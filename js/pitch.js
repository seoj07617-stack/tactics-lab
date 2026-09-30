/* ============================================================
   TacticLab · SVG 球场渲染 + 战术演示引擎
   坐标系：x 0-100（左→右 = 己方进攻方向），y 0-100（上→下）
   两种呈现：
   · 演示：球员平滑跑位，本步参与者高亮、无关者压暗，单步箭头
   · 图示：教科书式全图，所有步骤编号 ①②③ 一次画全
   ============================================================ */
"use strict";

const Pitch = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, parent = null) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  const C = {
    own:"#5b3df5", gk:"#3c2bb3", ball:"#e8890c",
    opp:"#8e8e93", oppgk:"#6e6e73",
    lineF8:"rgba(58,125,86,.36)", lineFutsal:"rgba(84,64,214,.30)",
    bgF8:"rgba(58,125,86,.07)", bgFutsal:"rgba(84,64,214,.04)",
    run:"#8b77f2", pass:"#5b3df5", halo:"#5b3df5",
  };

  function createSvg() {
    return el("svg", { viewBox:"0 0 120 90", class:"pitch-svg", "aria-label":"战术图" });
  }

  function drawField(svg, gameType) {
    const line = gameType === "futsal" ? C.lineFutsal : C.lineF8;
    const bg   = gameType === "futsal" ? C.bgFutsal : C.bgF8;
    el("rect", { x:0, y:0, width:120, height:90, rx:10, fill:bg, stroke:"none" }, svg);
    el("rect", { x:4, y:4, width:112, height:82, rx:6, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    el("line", { x1:60, y1:4, x2:60, y2:86, stroke:line, "stroke-width":.5 }, svg);
    el("circle", { cx:60, cy:45, r:12.2, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    el("circle", { cx:60, cy:45, r:1.1, fill:line }, svg);
    const boxW = gameType === "futsal" ? 13 : 15;
    const boxH = gameType === "futsal" ? 34 : 38;
    el("rect", { x:4, y:45-boxH/2, width:boxW, height:boxH, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    el("rect", { x:116-boxW, y:45-boxH/2, width:boxW, height:boxH, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    const pen = gameType === "futsal" ? 10 : 11;
    el("circle", { cx:4+pen, cy:45, r:.8, fill:line }, svg);
    el("circle", { cx:116-pen, cy:45, r:.8, fill:line }, svg);
    const gzW = gameType === "futsal" ? 5.5 : 6.5;
    const gzH = gameType === "futsal" ? 18 : 20;
    el("rect", { x:4, y:45-gzH/2, width:gzW, height:gzH, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    el("rect", { x:116-gzW, y:45-gzH/2, width:gzW, height:gzH, fill:"none", stroke:line, "stroke-width":.5 }, svg);
    [[4,4,1],[116,4,0],[4,86,0],[116,86,1]].forEach(([x,y,s]) => {
      el("path", { d:`M ${x} ${y<45?y+2.4:y-2.4} A 2.4 2.4 0 0 ${s} ${x<60?x+2.4:x-2.4} ${y}`,
        fill:"none", stroke:line, "stroke-width":.5 }, svg);
    });
  }

  function teamFill(p) {
    return p.team === "gk" ? C.gk : p.team === "opp" ? C.opp : p.team === "oppgk" ? C.oppgk : C.own;
  }

  /* 球员点（style.transform 定位以支持 CSS 过渡） */
  function playerDot(svg, p) {
    const g = el("g", { class:"pl", "data-pid":String(p.id) }, svg);
    g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (p.team === "ball") {
      el("circle", { r:1.8, fill:C.ball, stroke:"#fff", "stroke-width":.55 }, g);
      return g;
    }
    const fill = teamFill(p);
    const r = (p.team === "gk" || p.team === "oppgk") ? 2.9 : 2.7;
    el("circle", { class:"halo", r:r+1.15, fill:"none", stroke:C.halo, "stroke-width":.55, opacity:0 }, g);
    el("circle", { class:"body", r, fill, stroke:"#fff", "stroke-width":.6 }, g);
    const label = p.label || (p.num != null ? String(p.num) : "");
    if (label) {
      const t = el("text", { y:1.05, "text-anchor":"middle", "dominant-baseline":"middle",
        "font-size":3.1, fill:"#fff", "font-weight":700,
        stroke:"rgba(0,0,0,.28)", "stroke-width":.7, "paint-order":"stroke" }, g);
      t.textContent = label;
    }
    return g;
  }

  const nodeOf = (svg, id) => {
    const v = String(id).replace(/["\\]/g, "\\$&");
    return svg.querySelector(`[data-pid="${v}"]`);
  };
  const setPos = (node, x, y, instant) => {
    if (!node) return;
    if (instant) { node.classList.add("no-anim"); node.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(() => node.classList.remove("no-anim")); return; }
    node.style.transform = `translate(${x}px, ${y}px)`;
  };

  /* 箭头样式：球=橙粗 · 传球=紫实 · 跑位=浅紫虚（弱化），全部带白描边与落点环 */
  function arrowStyle(id, type) {
    const isBall = String(id) === "b";
    if (type === "shot") return { color:"#e8890c", w:1.5, dash:"none", ring:false };
    if (type === "run")  return { color:"#b7aaf6", w:.8,  dash:"2.6,2.2", ring:true };
    if (isBall)          return { color:"#e8890c", w:1.15, dash:"none", ring:true };
    if (type === "carry")return { color:"#5b3df5", w:1.2, dash:"none", ring:true };
    return { color:"#5b3df5", w:1.05, dash:"none", ring:true };
  }

  function arrow(g, x1, y1, x2, y2, id, type) {
    const st = arrowStyle(id, type);
    el("line", { x1, y1, x2, y2, stroke:"#fff", "stroke-width":st.w+1.1, "stroke-linecap":"round", opacity:.9 }, g);
    el("line", { x1, y1, x2, y2, stroke:st.color, "stroke-width":st.w, "stroke-dasharray":st.dash, "stroke-linecap":"round" }, g);
    const ang = Math.atan2(y2-y1, x2-x1), a = .5, L = 2.3;
    const bx = x2 - Math.cos(ang)*1.4, by = y2 - Math.sin(ang)*1.4;
    const p1 = `${x2},${y2}`;
    const p2 = `${bx - Math.cos(ang-a)*L},${by - Math.sin(ang-a)*L}`;
    const p3 = `${bx - Math.cos(ang+a)*L},${by - Math.sin(ang+a)*L}`;
    el("path", { d:`M ${p1} L ${p2} L ${p3} Z`, fill:"#fff", opacity:.9, transform:`translate(${Math.cos(ang)*.6} ${Math.sin(ang)*.6})` }, g);
    el("path", { d:`M ${p1} L ${p2} L ${p3} Z`, fill:st.color }, g);
    if (st.ring) el("circle", { cx:x2, cy:y2, r:1.15, fill:"#fff", stroke:st.color, "stroke-width":.5, opacity:.95 }, g);
    if (type === "shot") {
      /* 射门终点画 ×（教科书射门标记） */
      const s = 1.3;
      el("path", { d:`M ${x2-s} ${y2-s} L ${x2+s} ${y2+s} M ${x2-s} ${y2+s} L ${x2+s} ${y2-s}`,
        stroke:"#e8890c", "stroke-width":.8, "stroke-linecap":"round", fill:"none" }, g);
    }
  }

  const mid = (a, b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });
  /* 编号徽章：沿箭头法线上侧偏移，避免压住球员与线条 */
  function stepBadge(g, from, to, n) {
    const md = mid(from, to);
    let dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    let off = { x:-dy*2.6, y:dx*2.6 };
    if (md.y + off.y < 6 || md.y + off.y > 84) off = { x:dy*2.6, y:-dx*2.6 };
    const grp = el("g", { class:"diagram-no", transform:`translate(${md.x+off.x} ${md.y+off.y})` }, g);
    el("circle", { r:2.5, fill:"#fff", stroke:C.pass, "stroke-width":.55 }, grp);
    const t = el("text", { y:.35, "text-anchor":"middle", "dominant-baseline":"middle",
      "font-size":2.9, "font-weight":800, fill:C.pass }, grp);
    t.textContent = String(n);
  }

  /* 静态阵型图（阵型页/缩略图） */
  function renderStatic(container, players, gameType = "field8") {
    container.innerHTML = "";
    const svg = createSvg();
    drawField(svg, gameType);
    (players || []).forEach(p => playerDot(svg, p));
    container.appendChild(svg);
    return svg;
  }

  /* 图示模式：全步骤编号总览图 */
  function renderDiagram(container, pattern) {
    container.innerHTML = "";
    const svg = createSvg();
    drawField(svg, pattern.gameType);
    const pos = new Map(pattern.setup.map(p => [String(p.id), { x:p.x, y:p.y }]));
    pattern.setup.forEach(p => playerDot(svg, p));
    const layer = el("g", { class:"arrows" }, svg);
    pattern.steps.forEach((step, si) => {
      (step.moves || []).forEach((m, mi) => {
        const from = pos.get(String(m.id));
        if (!from) return;
        arrow(layer, from.x, from.y, m.x, m.y, m.id, m.type);
        if (mi === 0) stepBadge(layer, from, m, si+1);
        const q = pos.get(String(m.id));
        if (q) { q.x = m.x; q.y = m.y; }
      });
    });
    container.appendChild(svg);
  }

  /* 演示模式引擎 */
  function createAnim(container, pattern, opts = {}) {
    container.innerHTML = "";
    const svg = createSvg();
    drawField(svg, pattern.gameType);
    const setup0 = JSON.parse(JSON.stringify(pattern.setup));
    setup0.forEach(p => playerDot(svg, p));
    container.appendChild(svg);

    const last = pattern.steps.length - 1;
    let cur = -1, timer = null, playing = false, speed = 1;

    function resetPositions() {
      setup0.forEach(p => setPos(nodeOf(svg, p.id), p.x, p.y, true));
    }
    function clearMarks() {
      svg.querySelectorAll("g.pl").forEach(g => g.classList.remove("glow", "dim"));
    }
    function applyMoves(moves) {
      (moves || []).forEach(m => setPos(nodeOf(svg, m.id), m.x, m.y, false));
    }
    function markStep(moves) {
      clearMarks();
      const ids = new Set((moves||[]).map(m => String(m.id)));
      svg.querySelectorAll("g.pl").forEach(g => {
        if (ids.has(g.getAttribute("data-pid"))) g.classList.add("glow");
        else if (g.getAttribute("data-pid") !== "b") g.classList.add("dim");
      });
    }
    function drawArrows(arrows) {
      const old = svg.querySelector("g.arrows");
      if (old) old.remove();
      const g = el("g", { class:"arrows" }, svg);
      (arrows || []).forEach(m => {
        arrow(g, m.x1, m.y1, m.x2, m.y2, m.id, m.type);
      });
    }

    function show(n) {
      cur = Math.max(-1, Math.min(last, n));
      svg.querySelectorAll("g.arrows").forEach(x => x.remove());
      resetPositions();
      const pos = new Map(setup0.map(p => [String(p.id), { x:p.x, y:p.y }]));
      let stepArrows = null;
      for (let i = 0; i <= cur; i++) {
        const moves = pattern.steps[i].moves || [];
        stepArrows = moves.map(m => {
          const f = pos.get(String(m.id));
          return f ? { id:m.id, type:m.type, x1:f.x, y1:f.y, x2:m.x, y2:m.y } : null;
        }).filter(Boolean);
        applyMoves(moves);
        moves.forEach(m => { const q = pos.get(String(m.id)); if (q) { q.x = m.x; q.y = m.y; } });
      }
      if (cur >= 0) { drawArrows(stepArrows); markStep(pattern.steps[cur].moves); }
      else clearMarks();
      if (opts.onStep) opts.onStep(cur);
    }

    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null; }
      playing = false;
      if (opts.onPlayState) opts.onPlayState(false);
    }
    function play() {
      if (playing) return;
      if (cur >= last) show(-1);
      playing = true;
      if (opts.onPlayState) opts.onPlayState(true);
      const tick = () => { if (cur >= last) { stopTimer(); return; } show(cur + 1); };
      tick();
      timer = setInterval(tick, Math.max(750, 1650 / speed));
    }

    return {
      show, play,
      pause: stopTimer,
      next: () => { stopTimer(); show(cur + 1); },
      prev: () => { stopTimer(); show(cur - 1); },
      reset: () => { stopTimer(); show(-1); },
      setSpeed: s => { speed = s || 1; },
      get cur() { return cur; },
      get playing() { return playing; },
      get last() { return last; },
    };
  }

  return { renderStatic, renderDiagram, createAnim };
})();
