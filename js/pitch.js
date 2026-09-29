/* ============================================================
   TacticLab · SVG 球场渲染 + 步骤动画引擎
   坐标系：x 0-100（左→右 = 己方进攻方向），y 0-100（上→下）
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
    own:"#5b3df5", gk:"#3c2bb3", ball:"#ff9500",
    opp:"#8e8e93", oppgk:"#6e6e73",
    lineF8:"rgba(58,125,86,.34)", lineFutsal:"rgba(91,61,245,.32)",
    bgF8:"rgba(58,125,86,.08)", bgFutsal:"rgba(91,61,245,.05)",
  };

  function createSvg() {
    return el("svg", { viewBox:"0 0 120 90", class:"pitch-svg", "aria-label":"战术图" });
  }

  /* 草地球场线（进攻方向向右） */
  function drawField(svg, gameType) {
    const line = gameType === "futsal" ? C.lineFutsal : C.lineF8;
    const bg   = gameType === "futsal" ? C.bgFutsal : C.bgF8;
    el("rect", { x:0, y:0, width:120, height:90, rx:10, fill:bg, stroke:"none" }, svg);
    el("rect", { x:4, y:4, width:112, height:82, rx:6, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    el("line", { x1:60, y1:4, x2:60, y2:86, stroke:line, "stroke-width":.45 }, svg);
    el("circle", { cx:60, cy:45, r:12.2, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    el("circle", { cx:60, cy:45, r:1.1, fill:line }, svg);
    const boxW = gameType === "futsal" ? 13 : 15;
    const boxH = gameType === "futsal" ? 34 : 38;
    el("rect", { x:4, y:45-boxH/2, width:boxW, height:boxH, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    el("rect", { x:116-boxW, y:45-boxH/2, width:boxW, height:boxH, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    const pen = gameType === "futsal" ? 10 : 11;
    el("circle", { cx:4+pen, cy:45, r:.8, fill:line }, svg);
    el("circle", { cx:116-pen, cy:45, r:.8, fill:line }, svg);
    const gzW = gameType === "futsal" ? 5.5 : 6.5;
    const gzH = gameType === "futsal" ? 18 : 20;
    el("rect", { x:4, y:45-gzH/2, width:gzW, height:gzH, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    el("rect", { x:116-gzW, y:45-gzH/2, width:gzW, height:gzH, fill:"none", stroke:line, "stroke-width":.45 }, svg);
    [[4,4,1],[116,4,0],[4,86,0],[116,86,1]].forEach(([x,y,s]) => {
      el("path", { d:`M ${x} ${y<45?y+2.4:y-2.4} A 2.4 2.4 0 0 ${s} ${x<60?x+2.4:x-2.4} ${y}`,
        fill:"none", stroke:line, "stroke-width":.45 }, svg);
    });
  }

  /* 球员点 */
  function playerDot(svg, p) {
    const g = el("g", { class:"pl", "data-pid":String(p.id), transform:`translate(${p.x} ${p.y})` }, svg);
    if (p.team === "ball") {
      el("circle", { r:1.7, fill:C.ball, stroke:"#fff", "stroke-width":.5 }, g);
      return g;
    }
    const fill = p.team === "gk" ? C.gk : p.team === "opp" ? C.opp : p.team === "oppgk" ? C.oppgk : C.own;
    const r = (p.team === "gk" || p.team === "oppgk") ? 2.8 : 2.6;
    el("circle", { r, fill, stroke:"#fff", "stroke-width":.55 }, g);
    const label = p.label || (p.num != null ? String(p.num) : "");
    if (label) {
      const t = el("text", { y:1.05, "text-anchor":"middle", "dominant-baseline":"middle",
        "font-size":3.1, fill:"#fff", "font-weight":700, "font-family":"inherit" }, g);
      t.textContent = label;
    }
    return g;
  }

  /* 静态阵型图 */
  function renderStatic(container, players, gameType = "field8") {
    container.innerHTML = "";
    const svg = createSvg();
    drawField(svg, gameType);
    (players || []).forEach(p => playerDot(svg, p));
    container.appendChild(svg);
    return svg;
  }

  /* ---------- 动画引擎 ---------- */
  function createAnim(container, pattern, opts = {}) {
    container.innerHTML = "";
    const svg = createSvg();
    drawField(svg, pattern.gameType);
    JSON.parse(JSON.stringify(pattern.setup)).forEach(p => playerDot(svg, p));
    container.appendChild(svg);

    const setup0 = JSON.parse(JSON.stringify(pattern.setup));
    const last = pattern.steps.length - 1;
    let cur = -1;          // -1 = 初始站位
    let timer = null, playing = false, speed = 1;

    function resetPositions() {
      setup0.forEach(p => {
        const node = svg.querySelector(`[data-pid="${cssId(p.id)}"]`);
        if (!node) return;
        node.setAttribute("transform", `translate(${p.x} ${p.y})`);
      });
    }
    const cssId = v => (window.CSS && CSS.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&"));

    function applyMoves(moves) {
      (moves || []).forEach(m => {
        const node = svg.querySelector(`[data-pid="${cssId(m.id)}"]`);
        if (!node) return;
        node.setAttribute("transform", `translate(${m.x} ${m.y})`);
      });
    }

    function arrowhead(g, x1, y1, x2, y2, color, w) {
      const ang = Math.atan2(y2-y1, x2-x1);
      const bx = x2 - Math.cos(ang)*2.0, by = y2 - Math.sin(ang)*2.0;
      const a = 0.5;
      el("path", { d:`M ${x2} ${y2} L ${bx - Math.cos(ang-a)*1.5} ${by - Math.sin(ang-a)*1.5} L ${bx - Math.cos(ang+a)*1.5} ${by - Math.sin(ang+a)*1.5} Z`,
        fill:color, opacity:.9 }, g);
    }

    function drawArrows(arrows) {
      const old = svg.querySelector("g.arrows");
      if (old) old.remove();
      const g = el("g", { class:"arrows" }, svg);
      (arrows || []).forEach(m => {
        const isBall = String(m.id) === "b";
        const color = isBall ? C.ball : (m.type === "run" ? "#9d8cff" : "#5b3df5");
        const t = m.type || "run";
        const w = t === "shot" ? 1.35 : t === "carry" ? 1.05 : .85;
        const dash = t === "run" ? "2.2,2" : "none";
        el("line", { x1:m.x1, y1:m.y1, x2:m.x2, y2:m.y2,
          stroke:color, "stroke-width":w, "stroke-dasharray":dash, "stroke-linecap":"round", opacity:.85 }, g);
        arrowhead(g, m.x1, m.y1, m.x2, m.y2, color, w);
      });
    }

    /* 显示到第 n 步（0..last），累积应用所有动作。
       箭头起点必须是“该步开始前”的位置，而非初始站位。 */
    function show(n) {
      cur = Math.max(-1, Math.min(last, n));
      svg.querySelectorAll("g.arrows").forEach(g => g.remove());
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
      if (cur >= 0) drawArrows(stepArrows);
      if (opts && opts.onStep) opts.onStep(cur);
    }

    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null; }
      playing = false;
      if (opts && opts.onPlayState) opts.onPlayState(false);
    }

    function play() {
      if (playing) return;
      if (cur >= last) show(-1);
      playing = true;
      if (opts && opts.onPlayState) opts.onPlayState(true);
      const tick = () => {
        if (cur >= last) { stopTimer(); return; }
        show(cur + 1);
      };
      tick();
      timer = setInterval(tick, Math.max(700, 1600 / speed));
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

  return { renderStatic, createAnim };
})();
