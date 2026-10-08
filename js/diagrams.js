/* ============================================================
   TacticLab · 训练布置图引擎
   风格参考：JFA（日本足协）训练图解 / The FA practice pitch——
   黑白线稿场地 + 标志碟 + 人员点 + 球路与尺寸标注
   ============================================================ */
"use strict";

const Drill = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a = {}, p = null) => { const x = document.createElementNS(NS, n); for (const k in a) x.setAttribute(k, a[k]); if (p) p.appendChild(x); return x; };

  const C = {
    ink:"#2b2b2e", paper:"#fcfbf8",
    cone:"#e8890c", ball:"#e8890c",
    own:"#5b3df5", opp:"#8e8e93", gk:"#3c2bb3",
    run:"#8b77f2", pass:"#e8890c", dribble:"#5b3df5",
  };

  function svg() { return el("svg", { viewBox:"0 0 170 120", class:"drill-svg" }); }
  function frame(s) {
    el("rect", { x:2, y:2, width:166, height:116, rx:5, fill:C.paper }, s);
    el("rect", { x:14, y:10, width:142, height:100, rx:3, fill:"#fff", stroke:C.ink, "stroke-width":.7 }, s);
  }

  /* 元素 */
  const cone = (s,x,y) => el("path", { d:`M ${x} ${y-1.7} L ${x+1.6} ${y+1.3} L ${x-1.6} ${y+1.3} Z`, fill:C.cone, stroke:"#fff", "stroke-width":.35 }, s);
  function conesRect(s, x, y, w, h, n = 7) {
    for (let i = 0; i <= n; i++) { const t = i/n; cone(s, x+w*t, y); cone(s, x+w*t, y+h); }
    for (let i = 1; i < n; i++) { const t = i/n; cone(s, x, y+h*t); cone(s, x+w, y+h*t); }
  }
  function conesLine(s, x1, y1, x2, y2, n = 5) {
    for (let i = 0; i <= n; i++) { const t = i/n; cone(s, x1+(x2-x1)*t, y1+(y2-y1)*t); }
  }
  function player(s, x, y, num, team = "own") {
    const col = team === "opp" ? C.opp : team === "gk" ? C.gk : C.own;
    el("circle", { cx:x, cy:y, r:2.7, fill:col, stroke:"#fff", "stroke-width":.5 }, s);
    if (num != null) { const t = el("text", { x, y:y+.2, "text-anchor":"middle", "dominant-baseline":"middle", "font-size":2.8, fill:"#fff", "font-weight":700 }, s); t.textContent = String(num); }
  }
  const ball = (s,x,y) => el("circle", { cx:x, cy:y, r:1.5, fill:C.ball, stroke:"#fff", "stroke-width":.4 }, s);
  function head(s, x1, y1, x2, y2, color) {
    const ang = Math.atan2(y2-y1, x2-x1), a = .5, L = 2.6;
    const bx = x2 - Math.cos(ang)*1.2, by = y2 - Math.sin(ang)*1.2;
    el("path", { d:`M ${x2},${y2} L ${bx - Math.cos(ang-a)*L},${by - Math.sin(ang-a)*L} L ${bx - Math.cos(ang+a)*L},${by - Math.sin(ang+a)*L} Z`, fill:color }, s);
  }
  const run = (s,x1,y1,x2,y2) => { el("line",{x1,y1,x2,y2,stroke:"#fff","stroke-width":1.7,"stroke-linecap":"round"},s); el("line",{x1,y1,x2,y2,stroke:C.run,"stroke-width":.85,"stroke-dasharray":"2.6,2","stroke-linecap":"round"},s); head(s,x1,y1,x2,y2,C.run); };
  const pass = (s,x1,y1,x2,y2) => { el("line",{x1,y1,x2,y2,stroke:"#fff","stroke-width":1.9,"stroke-linecap":"round"},s); el("line",{x1,y1,x2,y2,stroke:C.pass,"stroke-width":1,"stroke-linecap":"round"},s); head(s,x1,y1,x2,y2,C.pass); };
  const drib = (s,x1,y1,x2,y2) => { el("line",{x1,y1,x2,y2,stroke:"#fff","stroke-width":2,"stroke-linecap":"round"},s); el("line",{x1,y1,x2,y2,stroke:C.dribble,"stroke-width":1.1,"stroke-linecap":"round"},s); head(s,x1,y1,x2,y2,C.dribble); };
  const arc = (s,x1,y1,x2,y2,color=C.pass) => {
    const mx=(x1+x2)/2, my=(y1+y2)/2 - Math.abs(x2-x1)*.25 - 3;
    el("path",{d:`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,fill:"none",stroke:"#fff","stroke-width":1.9},s);
    el("path",{d:`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,fill:"none",stroke:color,"stroke-width":1},s);
    head(s,mx,my,x2,y2,color);
  };
  function goalS(s, x, y, vert = true) {
    if (vert) el("line", { x1:x, y1:y-3, x2:x, y2:y+3, stroke:C.ink, "stroke-width":1.2, "stroke-linecap":"round" }, s);
    else el("line", { x1:x-3, y1:y, x2:x+3, y2:y, stroke:C.ink, "stroke-width":1.2, "stroke-linecap":"round" }, s);
  }
  function goalBig(s, x, y) {
    el("rect", { x:x-2, y:y-6, width:2, height:12, fill:"none", stroke:C.ink, "stroke-width":.9 }, s);
  }
  function label(s, x, y, text, size = 3.2, anchor = "middle", color = C.ink) {
    const t = el("text", { x, y, "text-anchor":anchor, "font-size":size, "font-weight":600, fill:color, "font-family":"inherit" }, s);
    t.textContent = text;
  }
  function dim(s, x1, y1, x2, y2, text) {
    const isH = Math.abs(y2-y1) < Math.abs(x2-x1);
    el("line", { x1, y1, x2, y2, stroke:C.ink, "stroke-width":.35 }, s);
    if (isH) { el("line",{x1,y1:y1-1.2,x2:x1,y2:y1+1.2,stroke:C.ink,"stroke-width":.35},s); el("line",{x1:x2,y1:y2-1.2,x2,y2:y2+1.2,stroke:C.ink,"stroke-width":.35},s); label(s,(x1+x2)/2,y1-1.5,text,3); }
    else { el("line",{x1:x1-1.2,y1,x2:x1+1.2,y2,stroke:C.ink,"stroke-width":.35},s); el("line",{x1:x2-1.2,y1:y2,x2:x2+1.2,y2,stroke:C.ink,"stroke-width":.35},s); label(s,x1+2,(y1+y2)/2,text,3,"start"); }
  }

  /* ---------- 模板库 ---------- */
  /* spec: "模板名|宽x高米|附加参数" */
  const T = {
    /* 抢圈 */
    rondo(s, w, h, note) {
      const x=34, y=22, W=100, H=80;
      conesRect(s, x, y, W, H, 6);
      dim(s, x, y-5, x+W, y-5, `${w}×${h}m`);
      player(s,x+16,y+8,2); player(s,x+50,y+3,4); player(s,x+84,y+8,6);
      player(s,x+16,y+H-8,8); player(s,x+50,y+H-3,10); player(s,x+84,y+H-8,5);
      player(s,x+50,y+38,"","opp"); player(s,x+50,y+55,"","opp");
      ball(s,x+50,y+8);
      pass(s,x+18,y+8,x+46,y+5);
      label(s, x+W/2, y+48, note || "外围传球 · 内围抢断", 3.4);
    },
    /* 技术格子 */
    grid(s, w, h, note) {
      const x=24, y=18, W=120, H=84;
      conesRect(s, x, y, W, H, 8);
      dim(s, x, y-5, x+W, y-5, `${w}×${h}m`);
      player(s,x+22,y+H/2,3); player(s,x+60,y+H/2-14,5); player(s,x+60,y+H/2+14,8); player(s,x+98,y+H/2,10);
      ball(s,x+22,y+H/2);
      pass(s,x+25,y+H/2,x+55,y+H/2-14); run(s,x+25,y+H/2,x+58,y+H/2+12);
      label(s, x+W/2, y+H+7, note || "传接 · 移动到新角度", 3.4);
    },
    /* 四门 1v1 */
    fourgoal(s, w, h) {
      const x=34, y=26, W=100, H=70;
      conesRect(s, x, y, W, H, 6);
      dim(s, x, y-5, x+W, y-5, `${w}×${h}m`);
      goalS(s, x+W/2, y, false); goalS(s, x+W/2, y+H, false);
      goalS(s, x, y+H/2, true); goalS(s, x+W, y+H/2, true);
      player(s,x+W/2-14,y+H/2,9); player(s,x+W/2+10,y+H/2,"","opp");
      ball(s,x+W/2-17,y+H/2);
      drib(s,x+W/2-15,y+H/2,x+W/2+2,y+H/2-8);
      label(s, x+W/2, y+H+7, "突破过人 · 通过任意小门", 3.4);
    },
    /* 撞墙三角 */
    triangle(s) {
      cone(s,60,26); cone(s,34,90); cone(s,86,90);
      dim(s, 34, 98, 86, 98, "8-10m");
      player(s,60,34,8); ball(s,60,40);
      player(s,40,80,10);
      pass(s,60,42,44,76);
      run(s,62,36,60,64);
      pass(s,42,78,58,58);
      label(s, 110, 58, "① 传给做墙人", 3.2, "start");
      label(s, 110, 66, "② 前插接回做", 3.2, "start");
    },
    /* 通道 */
    channel(s, w, h, note) {
      const x=30, y=16, W=108, H=90;
      conesLine(s, x, y, x, y+H, 6); conesLine(s, x+W, y, x+W, y+H, 6);
      dim(s, x-4, y, x-4, y+H, `${h}m`);
      goalS(s, x+W, y+H/2, true);
      player(s,x+14,y+H/2,7); player(s,x+44,y+H/2-16,9); player(s,x+44,y+H/2+16,6);
      player(s,x+70,y+H/2,"","opp");
      ball(s,x+11,y+H/2);
      drib(s,x+16,y+H/2,x+42,y+H/2);
      pass(s,x+46,y+H/2-16,x+66,y+H/2);
      label(s, x+W/2, y+H+7, note || "突破 · 配合 · 射门", 3.4);
    },
    /* 半场对抗 */
    halfssg(s, note) {
      const x=14, y=10, W=142, H=100;
      el("rect",{x,y,width:W,height:H,fill:"none",stroke:C.ink,"stroke-width":.7},s);
      el("line",{x1:x,y1:y+H/2,x2:x+W,y2:y+H/2,stroke:C.ink,"stroke-width":.5},s);
      el("circle",{cx:x+W/2,cy:y+H/2,r:10,fill:"none",stroke:C.ink,"stroke-width":.5},s);
      el("rect",{x:x+W-14,y:y+H/2-11,width:9,height:22,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      el("rect",{x:x+5,y:y+H/2-11,width:9,height:22,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      goalS(s,x+W,y+H/2,true); goalS(s,x,y+H/2,true);
      player(s,x+W/2-20,y+H/2-14,2); player(s,x+W/2-8,y+H/2+8,4); player(s,x+W/2-30,y+H/2+6,6);
      player(s,x+W/2+18,y+H/2-8,"","opp"); player(s,x+W/2+30,y+H/2+10,"","opp"); player(s,x+W/2+8,y+H/2-18,"","opp");
      player(s,x+W-8,y+H/2,1,"gk");
      ball(s,x+W/2-8,y+H/2+8);
      label(s, x+W/2, y+H+7, note || "主题条件赛", 3.4);
    },
    /* 全场对抗 */
    fullssg(s, note) {
      const x=14, y=10, W=142, H=100;
      el("rect",{x,y,width:W,height:H,fill:"none",stroke:C.ink,"stroke-width":.7},s);
      el("line",{x1:x+W/2,y1:y,x2:x+W/2,y2:y+H,stroke:C.ink,"stroke-width":.5},s);
      el("circle",{cx:x+W/2,cy:y+H/2,r:11,fill:"none",stroke:C.ink,"stroke-width":.5},s);
      el("rect",{x:x+W-13,y:y+H/2-10,width:8,height:20,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      el("rect",{x:x+5,y:y+H/2-10,width:8,height:20,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      goalS(s,x+W,y+H/2,true); goalS(s,x,y+H/2,true);
      player(s,x+20,y+24,2); player(s,x+14,y+H/2,1,"gk"); player(s,x+22,y+H-24,3);
      player(s,x+W/2-16,y+H/2-16,6); player(s,x+W/2-16,y+H/2+16,8);
      player(s,x+W-24,y+H/2,9);
      player(s,x+W-20,y+18,"","opp"); player(s,x+W-22,y+H-20,"","opp");
      ball(s,x+W/2,y+H/2);
      label(s, x+W/2, y+H+7, note || "8v8 条件赛", 3.4);
    },
    /* 绳梯敏捷 */
    ladder(s) {
      const x=26, y=22;
      for (let g=0; g<2; g++) {
        const gx = x + g*62;
        el("rect",{x:gx,y,width:34,height:76,fill:"none",stroke:C.ink,"stroke-width":.8},s);
        for (let i=1;i<6;i++) el("line",{x1:gx,y1:y+i*(76/6),x2:gx+34,y2:y+i*(76/6),stroke:C.ink,"stroke-width":.5},s);
      }
      label(s, x+17, y-4, "绳梯 A", 3.2); label(s, x+79, y-4, "绳梯 B", 3.2);
      run(s, x+17, y+86, x+17, y+8);
      run(s, x+79, y+86, x+79, y+8);
      conesLine(s, 118, y+6, 118, y+70, 5);
      player(s, 138, y+38, 7); ball(s, 138, y+30);
      drib(s, 138, y+34, 120, y+38);
      label(s, 128, 108, "碟阵运球", 3.2);
    },
    /* 射门三点循环 */
    finishing(s) {
      const x=14, y=10, W=142, H=100;
      el("rect",{x,y,width:W,height:H,fill:"none",stroke:C.ink,"stroke-width":.7},s);
      el("rect",{x:x+W-32,y:y+H/2-20,width:26,height:40,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      el("rect",{x:x+W-13,y:y+H/2-10,width:8,height:20,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      el("path",{d:`M ${x+W-32} ${y+H/2-20} Q ${x+W-45} ${y+H/2} ${x+W-32} ${y+H/2+20}`,fill:"none",stroke:C.ink,"stroke-width":.5},s);
      goalS(s,x+W,y+H/2,true);
      player(s,x+W-6,y+H/2,1,"gk");
      player(s,x+40,y+24,7); player(s,x+40,y+H/2,9); player(s,x+40,y+H-24,10);
      ball(s,x+36,y+24); ball(s,x+36,y+H/2); ball(s,x+36,y+H-24);
      pass(s,x+42,y+24,x+72,y+H/2-6); pass(s,x+42,y+H/2,x+72,y+H/2); pass(s,x+42,y+H-24,x+72,y+H/2+6);
      label(s, x+40, y-2, "三组轮换 · 每组 8 球", 3.2);
      label(s, x+76, y+H/2-14, "接回做", 3, "start");
      label(s, x+76, y+H/2+4, "一脚射门", 3, "start");
    },
    /* 边路传中 */
    winger(s) {
      const x=14, y=10, W=142, H=100;
      el("rect",{x,y,width:W,height:H,fill:"none",stroke:C.ink,"stroke-width":.7},s);
      el("line",{x1:x+60,y1:y,x2:x+60,y2:y+H,stroke:C.ink,"stroke-width":.4,"stroke-dasharray":"4,3"},s);
      el("rect",{x:x+W-32,y:y+H/2-20,width:26,height:40,fill:"none",stroke:C.ink,"stroke-width":.6},s);
      goalS(s,x+W,y+H/2,true);
      player(s,x+18,y+H-20,3); player(s,x+42,y+H-16,8);
      player(s,x+W-26,y+H/2,9); player(s,x+W-30,y+H/2-12,10);
      player(s,x+W-6,y+H/2,1,"gk");
      player(s,x+W-40,y+H/2+6,"","opp");
      ball(s,x+15,y+H-20);
      drib(s,x+20,y+H-20,x+52,y+H-24);
      arc(s, x+56, y+H-22, x+W-30, y+H/2-8);
      label(s, x+34, y+H-6, "边路通道", 3.2);
      label(s, x+W-46, y+16, "三点包抄", 3.2, "start");
    },
    /* 信号反应游戏 */
    signal(s) {
      const x=30, y=18, W=110, H=84;
      conesRect(s, x, y, W, H, 8);
      dim(s, x, y-5, x+W, y-5, "20×20m");
      const cols = [["红=斜插","#c94f46"],["黄=回撤","#c97200"],["蓝=横移","#3869c9"]];
      cols.forEach((c,i) => { el("circle",{cx:x+14+i*20,cy:y+H/2,r:2.2,fill:c[1]},s); label(s, x+14+i*20, y+H/2+6.5, c[0], 2.6); });
      player(s,x+40,y+24,4); player(s,x+78,y+34,6); player(s,x+58,y+62,8); player(s,x+92,y+66,10);
      run(s,x+40,y+24,x+56,y+38); run(s,x+92,y+66,x+74,y+52);
      label(s, x+W/2, y+H+7, "看色卡信号 → 3 秒内完成跑位", 3.3);
    },
  };

  function render(container, spec) {
    container.innerHTML = "";
    const [tpl, size, note] = String(spec).split("|");
    const fn = T[tpl] || T.grid;
    const s = svg();
    frame(s);
    let w = 20, h = 20;
    if (size && /\d+\s*[x×]\s*\d+/i.test(size)) {
      const m = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
      w = +m[1]; h = +m[2];
    }
    fn(s, w, h, note);
    container.appendChild(s);
  }

  return { render };
})();
