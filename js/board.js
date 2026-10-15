/* ============================================================
   TacticLab · 自由战术板
   借鉴开源战术板共性设计：拖拽摆位（球员/球/碟/背心/圈）、
   四类箭头+连线+区域+文字标注、撤销重做、命名保存工作簿、
   PNG 导出、阵型快填、触摸支持、自动保存
   ============================================================ */
"use strict";

const Board = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a = {}, p = null) => { const x = document.createElementNS(NS, n); for (const k in a) x.setAttribute(k, a[k]); if (p) p.appendChild(x); return x; };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const C = { A:"#5b3df5", B:"#8e8e93", Agk:"#3c2bb3", ball:"#e8890c", cone:"#e8890c", vest:"#c97200", ring:"#3869c9", ink:"#2b2b2e" };
  const TOOLS = [
    ["select","选择/拖动","✥"],
    ["pa","己方球员",""],
    ["pb","对方球员",""],
    ["ball","球",""],
    ["cone","标志碟",""],
    ["vest","对抗背心",""],
    ["ring","标志圈",""],
    ["run","跑动线（虚线）",""],
    ["pass","传球线",""],
    ["drib","运球线",""],
    ["shot","射门线",""],
    ["link","连线网",""],
    ["zone","区域框",""],
    ["text","文字","T"],
    ["erase","擦除","✕"],
  ];

  let host = null, svg = null, gMarks = null, gPieces = null, gTemp = null;
  let S = { pitch:"full", pieces:[], marks:[], seq:1 };
  let tool = "select", selected = null, pending = null, dragging = null;
  let undoStack = [], redoStack = [];
  const VB = () => S.pitch === "full" ? { w:120, h:90 } : { w:120, h:52 };

  const snap = () => { undoStack.push(JSON.stringify(S)); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; };
  const doUndo = () => { if (!undoStack.length) return; redoStack.push(JSON.stringify(S)); S = JSON.parse(undoStack.pop()); render(); };
  const doRedo = () => { if (!redoStack.length) return; undoStack.push(JSON.stringify(S)); S = JSON.parse(redoStack.pop()); render(); };

  /* ---------- 场地 ---------- */
  function drawPitch(s) {
    const full = S.pitch === "full";
    const W = 120, H = full ? 90 : 52;
    el("rect", { x:0, y:0, width:W, height:H, rx:6, fill:"#f2f7f3" }, s);
    el("rect", { x:4, y:4, width:W-8, height:H-8, rx:4, fill:"none", stroke:"rgba(58,125,86,.4)", "stroke-width":.6 }, s);
    if (full) {
      el("line", { x1:60, y1:4, x2:60, y2:H-4, stroke:"rgba(58,125,86,.4)", "stroke-width":.6 }, s);
      el("circle", { cx:60, cy:H/2, r:11, fill:"none", stroke:"rgba(58,125,86,.4)", "stroke-width":.6 }, s);
      el("circle", { cx:60, cy:H/2, r:.9, fill:"rgba(58,125,86,.4)" }, s);
    }
    const boxW = 14, boxH = full ? 30 : 22, gzW = 6, gzH = full ? 14 : 10;
    [true, false].forEach(left => {
      const gx = left ? 4 : W-4;
      el("rect", { x:left?4:W-4-boxW, y:H/2-boxH/2, width:boxW, height:boxH, fill:"none", stroke:"rgba(58,125,86,.4)", "stroke-width":.6 }, s);
      el("rect", { x:left?4:W-4-gzW, y:H/2-gzH/2, width:gzW, height:gzH, fill:"none", stroke:"rgba(58,125,86,.4)", "stroke-width":.6 }, s);
      el("rect", { x:left?2.2:W-3.2, y:H/2-4, width:1, height:8, fill:C.ink }, s);
    });
  }

  /* ---------- 元素绘制 ---------- */
  function drawPiece(s, p) {
    const g = el("g", { class:"bp", "data-id":p.id }, s);
    g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (p.kind === "player") {
      const col = p.team === "A" ? C.A : p.team === "B" ? C.B : C.Agk;
      if (p === selected) el("circle", { r:4.4, fill:"none", stroke:col, "stroke-width":.6, opacity:.85 }, g);
      el("circle", { r:2.8, fill:col, stroke:"#fff", "stroke-width":.55 }, g);
      if (p.num != null) {
        const t = el("text", { y:1, "text-anchor":"middle", "dominant-baseline":"middle", "font-size":2.9, "font-weight":700, fill:"#fff", stroke:"rgba(0,0,0,.25)", "stroke-width":.6, "paint-order":"stroke" }, g);
        t.textContent = String(p.num);
      } else if (p.team === "B") {
        el("path", { d:`M -1 -1 L 1 1 M -1 1 L 1 -1`, stroke:"#fff", "stroke-width":.6, "stroke-linecap":"round" }, g);
      }
      if (p.name && p.name !== String(p.num ?? "")) { const n = el("text", { y:-4.2, "text-anchor":"middle", "font-size":2.6, "font-weight":600, fill:C.ink, stroke:"#fff", "stroke-width":.6, "paint-order":"stroke" }, g); n.textContent = p.name; }
    } else if (p.kind === "ball") {
      el("circle", { r:1.7, fill:C.ball, stroke:"#fff", "stroke-width":.45 }, g);
    } else if (p.kind === "cone") {
      el("path", { d:`M 0 -1.7 L 1.6 1.3 L -1.6 1.3 Z`, fill:C.cone, stroke:"#fff", "stroke-width":.35 }, g);
    } else if (p.kind === "vest") {
      el("rect", { x:-2, y:-2, width:4, height:4, rx:1, fill:C.vest, stroke:"#fff", "stroke-width":.45 }, g);
    } else if (p.kind === "ring") {
      el("circle", { r:2.6, fill:"none", stroke:C.ring, "stroke-width":.7 }, g);
    }
    return g;
  }

  function markPath(m) {
    if (m.kind === "zone") return null;
    if (m.kind === "text") return null;
    return m.pts.map(pt => pt.x + "," + pt.y).join(" ");
  }
  function drawMark(s, m) {
    const g = el("g", { class:"bm", "data-id":m.id }, s);
    const col = m.color || (m.kind === "run" ? "#8b77f2" : m.kind === "shot" ? "#e8890c" : m.kind === "drib" ? "#5b3df5" : m.kind === "link" ? "rgba(91,61,245,.45)" : "#e8890c");
    const w = m.kind === "shot" ? 1.2 : m.kind === "drib" ? 1.05 : m.kind === "link" ? .9 : .95;
    if (m.kind === "zone") {
      el("rect", { x:Math.min(m.x1,m.x2), y:Math.min(m.y1,m.y2), width:Math.abs(m.x2-m.x1), height:Math.abs(m.y2-m.y1),
        fill:"rgba(91,61,245,.10)", stroke:col, "stroke-width":.6, "stroke-dasharray":"2,1.6" }, g);
    } else if (m.kind === "text") {
      const t = el("text", { x:m.x, y:m.y, "font-size":3.4, "font-weight":700, fill:C.ink, stroke:"#fff", "stroke-width":.7, "paint-order":"stroke" }, g);
      t.textContent = m.text || "文字";
    } else {
      const pts = markPath(m);
      const dash = m.kind === "run" ? "2.4,2" : "none";
      el("polyline", { points:pts, fill:"none", stroke:"#fff", "stroke-width":w+1, "stroke-linecap":"round", "stroke-linejoin":"round", opacity:.9 }, g);
      el("polyline", { points:pts, fill:"none", stroke:col, "stroke-width":w, "stroke-dasharray":dash, "stroke-linecap":"round", "stroke-linejoin":"round" }, g);
      if (m.kind !== "link") {
        const a = m.pts, p1 = a[a.length-2], p2 = a[a.length-1];
        if (p1 && p2) {
          const ang = Math.atan2(p2.y-p1.y, p2.x-p1.x), s2 = .5, L = 2.6;
          const bx = p2.x - Math.cos(ang)*1.2, by = p2.y - Math.sin(ang)*1.2;
          el("path", { d:`M ${p2.x},${p2.y} L ${bx - Math.cos(ang-s2)*L},${by - Math.sin(ang-s2)*L} L ${bx - Math.cos(ang+s2)*L},${by - Math.sin(ang+s2)*L} Z`, fill:col }, g);
        }
      }
    }
    return g;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    svg.innerHTML = "";
    drawPitch(svg);
    gMarks = el("g", {}, svg);
    gPieces = el("g", {}, svg);
    gTemp = el("g", {}, svg);
    S.marks.forEach(m => drawMark(gMarks, m));
    S.pieces.forEach(p => drawPiece(gPieces, p));
    autosave();
  }

  function fullRender() {
    render();
    renderList();
  }

  /* ---------- 坐标 ---------- */
  function toPitch(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const vb = VB();
    return { x:Math.max(2, Math.min(vb.w-2, p.x)), y:Math.max(2, Math.min(vb.h-2, p.y)) };
  }
  function hitPiece(pt) {
    for (let i = S.pieces.length-1; i >= 0; i--) {
      const p = S.pieces[i];
      const r = p.kind === "player" ? 3.4 : p.kind === "ball" ? 2.6 : 2.6;
      if (Math.hypot(p.x-pt.x, p.y-pt.y) <= r) return p;
    }
    return null;
  }

  /* ---------- 工具交互 ---------- */
  function onDown(evt) {
    evt.preventDefault();
    try { svg.setPointerCapture(evt.pointerId); } catch {}
    const pt = toPitch(evt);
    if (tool === "select") {
      const p = hitPiece(pt);
      if (p) { snap(); dragging = { piece:p, dx:p.x-pt.x, dy:p.y-pt.y }; selected = p; }
      else { selected = null; }
      render(); return;
    }
    if (tool === "erase") {
      const p = hitPiece(pt);
      if (p) { snap(); S.pieces = S.pieces.filter(x => x !== p); render(); return; }
      const m = hitMark(pt);
      if (m) { snap(); S.marks = S.marks.filter(x => x !== m); render(); }
      return;
    }
    if (["pa","pb","ball","cone","vest","ring"].includes(tool)) {
      snap();
      const kinds = { pa:"player", pb:"player", ball:"ball", cone:"cone", vest:"vest", ring:"ring" };
      const spot = findFreeSpot(pt);
      const p = { id:"p" + (S.seq++), kind:kinds[tool], team: tool==="pa" ? "A" : tool==="pb" ? "B" : "", x:spot.x, y:spot.y };
      if (p.kind === "player") p.num = nextNum(p.team);
      S.pieces.push(p);
      selected = p; render(); return;
    }
    if (["run","pass","drib","shot","link"].includes(tool)) {
      const p = hitPiece(pt);
      pending = { kind:tool, pts:[pt], startPiece: p ? p.id : null, temp:true };
      return;
    }
    if (tool === "zone") { pending = { kind:"zone", x1:pt.x, y1:pt.y, x2:pt.x, y2:pt.y, temp:true }; return; }
    if (tool === "text") {
      const txt = prompt("标注文字：");
      if (txt && txt.trim()) { snap(); S.marks.push({ id:"m" + (S.seq++), kind:"text", x:pt.x, y:pt.y, text:txt.trim() }); render(); }
      return;
    }
  }
  function hitMark(pt) {
    for (let i = S.marks.length-1; i >= 0; i--) {
      const m = S.marks[i];
      if (m.kind === "text") { if (Math.hypot(m.x-pt.x, m.y-pt.y) < 6) return m; continue; }
      if (m.kind === "zone") { if (pt.x>Math.min(m.x1,m.x2)-1 && pt.x<Math.max(m.x1,m.x2)+1 && pt.y>Math.min(m.y1,m.y2)-1 && pt.y<Math.max(m.y1,m.y2)+1) return m; continue; }
      for (const q of m.pts) if (Math.hypot(q.x-pt.x, q.y-pt.y) < 2.6) return m;
    }
    return null;
  }

  function onMove(evt) {
    if (dragging) {
      const pt = toPitch(evt);
      dragging.piece.x = Math.max(2, Math.min(VB().w-2, pt.x + dragging.dx));
      dragging.piece.y = Math.max(2, Math.min(VB().h-2, pt.y + dragging.dy));
      const g = gPieces.querySelector(`[data-id="${dragging.piece.id}"]`);
      if (g) g.style.transform = `translate(${dragging.piece.x}px, ${dragging.piece.y}px)`;
      autosaveQuiet();
      return;
    }
    if (!pending) return;
    const pt = toPitch(evt);
    if (pending.kind === "zone") { pending.x2 = pt.x; pending.y2 = pt.y; }
    else if (pending.kind === "link") {
      const p = hitPiece(pt);
      pending.pts = [pending.pts[0], p ? { x:p.x, y:p.y } : pt]; pending.endPiece = p ? p.id : null;
    }
    else pending.pts[1] = pt;
    gTemp.innerHTML = "";
    const tmp = pending.kind === "zone"
      ? { id:"t", kind:"zone", x1:pending.x1, y1:pending.y1, x2:pending.x2, y2:pending.y2 }
      : { id:"t", kind:pending.kind, pts:pending.pts };
    drawMark(gTemp, tmp);
  }

  function onUp() {
    if (dragging) { dragging = null; return; }
    if (!pending) return;
    const p = pending;
    let ok = false;
    if (p.kind === "zone") ok = Math.abs(p.x2-p.x1) > 3 && Math.abs(p.y2-p.y1) > 3;
    else if (p.kind === "link") ok = !!(p.startPiece && p.endPiece && p.startPiece !== p.endPiece);
    else ok = p.pts.length > 1 && Math.hypot(p.pts[1].x-p.pts[0].x, p.pts[1].y-p.pts[0].y) > 2;
    if (ok) {
      snap();
      const mark = p.kind === "zone"
        ? { id:"m" + (S.seq++), kind:"zone", x1:p.x1, y1:p.y1, x2:p.x2, y2:p.y2 }
        : { id:"m" + (S.seq++), kind:p.kind, pts:p.pts.map(q => ({...q})), startPiece:p.startPiece||null, endPiece:p.endPiece||null };
      S.marks.push(mark);
    }
    pending = null;
    gTemp.innerHTML = "";
    render();
  }

  function nextNum(team) {
    /* 对方球员默认不带数字（灰色 × 标识），需要时用「名」按钮自定义 */
    if (team === "B") return null;
    const used = S.pieces.filter(p => p.team === team).map(p => p.num);
    for (let i = 1; i <= 99; i++) if (!used.includes(i)) return i;
    return null;
  }
  /* 新元素落位避让：位置被占时向右下找最近空位，避免叠堆 */
  function findFreeSpot(pt) {
    const occupied = S.pieces.map(p => ({ x:p.x, y:p.y }));
    let { x, y } = pt;
    const vb = VB();
    for (let tryn = 0; tryn < 60; tryn++) {
      if (!occupied.some(o => Math.hypot(o.x-x, o.y-y) < 4)) return { x, y };
      x += 3.2;
      if (x > vb.w - 4) { x = 4; y += 4; }
      if (y > vb.h - 4) { y = 4; }
    }
    return { x:pt.x, y:pt.y };
  }

  /* ---------- 编辑面板动作 ---------- */
  function editSelected() {
    if (!selected || selected.kind !== "player") { toastMsg("先选择一名球员（选择工具点击）"); return; }
    const name = prompt("球员名字标签（显示在球员上方，如「队长」；与号码相同则不显示；留空清除）：", selected.name || "");
    if (name === null) return;
    let num = prompt("号码（对方球员留空则显示 ×）：", selected.num ?? "");
    if (num !== null && num !== "" && !isNaN(+num)) {
      const clash = S.pieces.find(p => p !== selected && p.team === selected.team && p.num === +num);
      if (clash) { if (!confirm(`本队已有 ${num} 号，仍要使用吗？`)) num = null; }
    }
    snap();
    selected.name = name.trim() || "";
    selected.num = (num !== null && num !== "" && !isNaN(+num)) ? +num : null;
    render();
  }

  function fillFormation(gt) {
    const f = FORMATIONS.find(x => x.id === gt);
    if (!f) return;
    snap();
    S.pieces = S.pieces.filter(p => p.kind !== "player" || p.team !== "A");
    const half = S.pitch === "half";
    f.players.forEach(pl => {
      /* 纯数字的位置标签（6/8/10…）与号码重复，不入名字；GK 等文字标签保留 */
      const cleanLabel = (pl.label && !/^\d+$/.test(pl.label)) ? pl.label : "";
      S.pieces.push({ id:"p" + (S.seq++), kind:"player", team:"A",
        x: half ? 62 + pl.x*0.46 : pl.x, y: half ? 4 + pl.y*0.49 : pl.y,
        num: pl.num, name: cleanLabel });
    });
    render(); toastMsg("已填入 " + f.name + "（己方）");
  }

  /* ---------- 存储 ---------- */
  const LIST_KEY = "tacticlab.boards";
  const AUTO_KEY = "tacticlab.board.current";
  const boards = () => { try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch { return []; } };
  const saveBoards = l => { try { localStorage.setItem(LIST_KEY, JSON.stringify(l)); } catch {} };
  let autoTimer = null;
  function autosaveQuiet() { clearTimeout(autoTimer); autoTimer = setTimeout(autosave, 800); }
  function autosave() { try { localStorage.setItem(AUTO_KEY, JSON.stringify(S)); } catch {} }

  function saveNamed() {
    const name = prompt("保存战术板，名称：", "");
    if (!name || !name.trim()) return;
    const list = boards().filter(b => b.name !== name.trim());
    list.unshift({ name:name.trim(), ts:Date.now(), data:JSON.parse(JSON.stringify(S)) });
    saveBoards(list.slice(0, 40));
    renderList(); toastMsg("已保存「" + name.trim() + "」");
  }
  function loadNamed(name) {
    const b = boards().find(x => x.name === name);
    if (!b) return;
    snap(); S = JSON.parse(JSON.stringify(b.data)); render(); renderList();
  }
  function deleteNamed(name) {
    saveBoards(boards().filter(b => b.name !== name)); renderList();
  }

  function exportPNG() {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", NS);
    const vb = VB();
    clone.setAttribute("width", vb.w * 10); clone.setAttribute("height", vb.h * 10);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = vb.w * 10; cv.height = vb.h * 10;
      cv.getContext("2d").drawImage(img, 0, 0);
      cv.toBlob(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tacticlab-board.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, "image/png");
    };
    img.onerror = () => alertMsg("导出失败，请重试");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }
  function alertMsg(m) { const t = document.querySelector("#toast"); if (t) { t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); } }

  /* ---------- UI ---------- */
  function renderList() {
    const box = document.querySelector("#boardList");
    if (!box) return;
    const list = boards();
    box.innerHTML = list.length
      ? list.map(b => `<div class="bd-row"><span class="bd-n">${esc(b.name)}</span><span class="bd-d">${new Date(b.ts).toLocaleDateString("zh-CN")}</span><button class="btn btn-quiet btn-sm" data-load="${esc(b.name)}">打开</button><button class="btn btn-quiet btn-sm" data-del="${esc(b.name)}">删</button></div>`).join("")
      : `<div class="bd-empty">还没有保存的战术板</div>`;
    box.querySelectorAll("[data-load]").forEach(b => b.addEventListener("click", () => loadNamed(b.dataset.load)));
    box.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => deleteNamed(b.dataset.del)));
  }

  function init(container, panel) {
    host = container;
    container.innerHTML = `
      <div class="board-wrap">
        <div class="board-tools" id="bTools"></div>
        <div class="board-canvas"><svg id="bSvg" viewBox="0 0 120 90"></svg></div>
        <div class="board-bar">
          <div class="seg seg-sm" id="bPitch"><button data-p="full" class="is-active">全场</button><button data-p="half">半场</button></div>
          <select class="inp inp-mini" id="bForm">
            <option value="">阵型快填…</option>
            ${FORMATIONS.map(f => `<option value="${f.id}">${f.gameType==="futsal"?"五人制 · ":"八人制 · "}${esc(f.name)}</option>`).join("")}
          </select>
          <button class="pbtn" id="bName" title="编辑选中球员名字/号码">名</button>
          <button class="pbtn" id="bUndo" title="撤销">↶</button>
          <button class="pbtn" id="bRedo" title="重做">↷</button>
          <span class="flex1"></span>
          <button class="btn btn-quiet btn-sm" id="bClear">清空</button>
          <button class="btn btn-primary btn-sm" id="bSave">保存</button>
          <button class="btn btn-quiet btn-sm" id="bExport">${'↓'} PNG</button>
        </div>
      </div>`;
    panel.innerHTML = `
      <h2>战术板<span class="en">FREE BOARD</span></h2>
      <p class="lede">拖拽摆人、画线路、标区域——训练场边的白板。自动保存在本机，可命名保存多块、导出 PNG 发到群里。</p>
      <div class="p-sec"><div class="p-sec-t">用法</div>
        <div class="kp-row"><span>选工具 → 在板上点/拖。球员可拖动，双击不了就用「名」按钮改名。</span></div>
        <div class="kp-row"><span>Ctrl+Z 撤销 / Ctrl+Y 重做；「名」按钮编辑选中球员的名字与号码。</span></div>
        <div class="kp-row"><span>阵型快填：一键摆出库内阵型，再自由调整。</span></div>
      </div>
      <div class="p-sec"><div class="p-sec-t">我的战术板</div><div id="boardList"></div></div>`;

    svg = document.querySelector("#bSvg");
    // 恢复自动保存
    try {
      const auto = localStorage.getItem(AUTO_KEY);
      if (auto) { const d = JSON.parse(auto); if (d && d.pieces) S = d; }
    } catch {}
    render();

    const tools = document.querySelector("#bTools");
    TOOLS.forEach(([k, label, glyph]) => {
      const b = document.createElement("button");
      b.className = "btool" + (k === tool ? " is-on" : "");
      b.title = label;
      const ic = { pa:icPlayer(C.A), pb:icPlayer(C.B), ball:icBall(), cone:icCone(), vest:icVest(), ring:icRing(), run:icArrow("#8b77f2", true), pass:icArrow("#e8890c", false), drib:icArrow("#5b3df5", false), shot:icArrow("#e8890c", false), link:icLink(), zone:icZone(), select:"✥", text:"T", erase:"✕" }[k];
      b.innerHTML = ic || glyph;
      b.addEventListener("click", () => { tool = k; tools.querySelectorAll(".btool").forEach(x => x.classList.remove("is-on")); b.classList.add("is-on"); });
      tools.appendChild(b);
    });

    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("dblclick", () => editSelected());

    document.querySelector("#bPitch").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      S.pitch = b.dataset.p; snap();
      document.querySelector("#bSvg").setAttribute("viewBox", `0 0 ${VB().w} ${VB().h}`);
      document.querySelector("#bPitch").querySelectorAll("button").forEach(x => x.classList.toggle("is-active", x === b));
      render();
    }));
    document.querySelector("#bForm").addEventListener("change", e => { if (e.target.value) fillFormation(e.target.value); e.target.value = ""; });
    document.querySelector("#bName").addEventListener("click", editSelected);
    document.querySelector("#bUndo").addEventListener("click", doUndo);
    document.querySelector("#bRedo").addEventListener("click", doRedo);
    document.querySelector("#bClear").addEventListener("click", () => { if (confirm("清空整块战术板？")) { snap(); S.pieces = []; S.marks = []; render(); } });
    document.querySelector("#bSave").addEventListener("click", saveNamed);
    document.querySelector("#bExport").addEventListener("click", exportPNG);
    renderList();
  }

  function icPlayer(col) { return `<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.2"/><text x="9" y="10" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff">1</text></svg>`; }
  function icBall() { return `<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="4.5" fill="#e8890c" stroke="#fff" stroke-width="1"/></svg>`; }
  function icCone() { return `<svg viewBox="0 0 18 18"><path d="M9 4 L12.5 14 L5.5 14 Z" fill="#e8890c"/></svg>`; }
  function icVest() { return `<svg viewBox="0 0 18 18"><rect x="4" y="4" width="10" height="10" rx="2.5" fill="#c97200"/></svg>`; }
  function icRing() { return `<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="5.5" fill="none" stroke="#3869c9" stroke-width="1.6"/></svg>`; }
  function icArrow(col, dash) { return `<svg viewBox="0 0 18 18"><path d="M3 14 L14 5" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" ${dash ? 'stroke-dasharray="3,2.4"' : ""}/><path d="M14 5 L9.6 5.6 L13 9.4 Z" fill="${col}"/></svg>`; }
  function icLink() { return `<svg viewBox="0 0 18 18"><circle cx="4" cy="13" r="2.6" fill="#5b3df5"/><circle cx="14" cy="5" r="2.6" fill="#5b3df5"/><path d="M6 11 L12 7" stroke="rgba(91,61,245,.5)" stroke-width="1.6"/></svg>`; }
  function icZone() { return `<svg viewBox="0 0 18 18"><rect x="3.5" y="4.5" width="11" height="9" rx="1.5" fill="rgba(91,61,245,.12)" stroke="#5b3df5" stroke-width="1.4" stroke-dasharray="3,2"/></svg>`; }

  /* 全局快捷键（战术板视图时） */
  document.addEventListener("keydown", e => {
    const active = document.body.dataset.view === "board";
    if (!active) return;
    if (/select|input|textarea/i.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); doRedo(); }
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (selected) { e.preventDefault(); snap(); S.pieces = S.pieces.filter(x => x !== selected); selected = null; render(); }
    }
  });

  return { init, setViewFlag(v) { document.body.dataset.view = v; }, gameType(gt) { S.gameTypeF = gt; } };
})();