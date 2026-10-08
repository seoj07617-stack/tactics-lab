/* ============================================================
   TacticLab v2 · 教练工作台
   左导航 · 中央画布 · 右侧信息面板；浏览全部原地完成
   ============================================================ */
"use strict";

(() => {
  /* ---------- 工具 ---------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const REF_SHORT = { "英格兰":"英格兰 DNA", "西班牙":"西班牙青训", "五人制":"FIFA 手册", "欧洲":"UEFA" };
  const refShort = id => {
    const r = REFS.find(x => x.id === id);
    return r ? (REF_SHORT[r.tag] || r.tag) : id;
  };
  const refNames = ids => ids.map(id => (REFS.find(r => r.id === id) || {}).name || id).join(" · ");

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- 图标 ---------- */
  const ICONS = {
    formations: '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="4.3" r="2" fill="currentColor"/><circle cx="4.2" cy="13.2" r="2" fill="currentColor"/><circle cx="13.8" cy="13.2" r="2" fill="currentColor"/><path d="M9 6.6 5.3 11.3M9 6.6l3.7 4.7M6.4 13.2h5.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    studio: '<svg viewBox="0 0 18 18" fill="currentColor"><path d="M9 2.2c.55 3.2 1.6 4.25 4.8 4.8-3.2.55-4.25 1.6-4.8 4.8-.55-3.2-1.6-4.25-4.8-4.8 3.2-.55 4.25-1.6 4.8-4.8Z"/><path d="M14.2 10.6c.3 1.75.9 2.35 2.6 2.65-1.7.3-2.3.9-2.6 2.65-.3-1.75-.9-2.35-2.6-2.65 1.7-.3 2.3-.9 2.6-2.65Z" opacity=".55"/></svg>',
    sessions: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="9" r="6.4"/><path d="M9 5.6V9l2.5 1.6"/></svg>',
    saved: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 2.6l2 4.1 4.5.65-3.25 3.17.77 4.48L9 12.9l-4.02 2.1.77-4.48L2.5 7.35 7 6.7 9 2.6Z"/></svg>',
    about: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="2.5" width="11" height="13" rx="2"/><path d="M6.8 2.5v13"/></svg>',
    print: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 6.5V3h7v3.5"/><rect x="3" y="6.5" width="12" height="6" rx="1.5"/><path d="M5.5 10.5h7V15h-7Z"/></svg>',
  };
  const ic = k => ICONS[k] || "";

  /* ---------- 状态 ---------- */
  const S = {
    view: "tactics",
    gameType: "futsal",
    formationId: null,               // 当前阵型（按赛制记忆）
    patternId: null,                 // 当前加载的套路
    pendingPattern: null,            // 从别处点进来的套路
    filters: { phase:"atk", style:"", formation:"", difficulty:0 },
    session: { theme:"", age:"foundation", duration:60 },
    lastPlan: null,
  };
  const formById = id => FORMATIONS.find(f => f.id === id);
  const formationsOf = gt => FORMATIONS.filter(f => f.gameType === gt);
  const currentFormation = () => formById(S.formationId) || formationsOf(S.gameType)[0];

  /* ---------- 收藏 ---------- */
  const STORE_KEY = "tacticlab.saved.v1";
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } };
  const storeSaved = l => { try { localStorage.setItem(STORE_KEY, JSON.stringify(l)); } catch { toast("浏览器存储不可用"); } };
  function addSaved(item) {
    const list = loadSaved();
    if (list.some(x => x.type === item.type && x.refId === item.refId && x.key === item.key)) { toast("已在收藏中"); return false; }
    list.unshift({ ...item, ts: Date.now() });
    storeSaved(list.slice(0, 200));
    return true;
  }
  const delSaved = (type, refId, key) => storeSaved(loadSaved().filter(x => !(x.type===type && x.refId===refId && (x.key||"")===key)));

  /* ---------- 抽签袋 ---------- */
  let bag = [];
  function poolFor(st) {
    let list = PATTERNS.filter(p => p.gameType === S.gameType && p.phase === st.phase);
    if (st.formation) { const m = list.filter(p => p.formation === st.formation || p.formation === "any"); if (m.length) list = m; }
    if (st.style)     { const m = list.filter(p => (p.styles||[]).includes(st.style)); if (m.length) list = m; }
    if (st.difficulty){ const m = list.filter(p => p.difficulty <= st.difficulty); if (m.length) list = m; }
    return list;
  }
  function drawFromPool(pool) {
    const key = pool.map(p => p.id).sort().join("|");
    if (!bag.items || bag.bagKey !== key) bag = { bagKey:key, items:shuffle(pool) };
    if (!bag.items.length) bag.items = shuffle(pool);
    return bag.items.pop();
  }

  /* ---------- 路由与渲染 ---------- */
  const VIEW_TITLES = { tactics:"战术", formations:"阵型", sessions:"训练课", saved:"收藏", about:"依据" };

  function go(view) { S.view = view; render(); }

  function render() {
    $$(".rail-item, .tab-item").forEach(b => b.classList.toggle("is-active", b.dataset.view === S.view));
    const gtVisible = S.view === "formations" || S.view === "tactics" || S.view === "sessions";
    $("#gtSeg").classList.toggle("hidden", !gtVisible);
    $$("#gtSeg button").forEach(b => b.classList.toggle("is-active", b.dataset.gt === S.gameType));
    $("#savedCount").textContent = loadSaved().length;

    const c = $("#canvas"), p = $("#panel");
    const wide = S.view === "saved" || S.view === "about";
    $("#workspace").dataset.panel = wide ? "off" : "on";
    c.classList.remove("fade-in"); void c.offsetWidth; c.classList.add("fade-in");
    c.scrollTop = 0; p.scrollTop = 0;

    if (S.view === "tactics")    return renderTactics(c, p);
    if (S.view === "formations") return renderFormations(c, p);
    if (S.view === "sessions")   return renderSessions(c, p);
    if (S.view === "saved")      return renderSaved(c);
    if (S.view === "about")      return renderAbout(c);
  }

  /* ---------- 战术工作台 ---------- */
  let anim = null;

  function renderTactics(c, p) {
    const st = S.filters;
    const styles = STYLE_LABELS[S.gameType][st.phase];
    c.innerHTML = `
      <div class="controls">
        <div class="seg seg-sm" id="phSeg">
          <button data-ph="atk" class="${st.phase==="atk"?"is-active":""}">进攻</button>
          <button data-ph="def" class="${st.phase==="def"?"is-active":""}">防守</button>
        </div>
        <select class="inp" id="fStyle">
          <option value="">全部风格</option>
          ${Object.entries(styles).map(([k,lab]) => `<option value="${k}" ${st.style===k?"selected":""}>${esc(lab)}</option>`).join("")}
        </select>
        <select class="inp" id="fForm">
          <option value="">全部阵型</option>
          ${formationsOf(S.gameType).map(f => `<option value="${f.id}" ${st.formation===f.id?"selected":""}>${esc(f.name)}</option>`).join("")}
        </select>
        <select class="inp" id="fDiff">
          <option value="0">任意难度</option>
          ${[1,2,3].map(d => `<option value="${d}" ${st.difficulty===d?"selected":""}>${"★".repeat(d)}</option>`).join("")}
        </select>
        <span class="flex1"></span>
        <div class="seg seg-sm" id="modeSeg">
          <button data-mode="diagram" class="${mode==="diagram"?"is-active":""}">图示</button>
          <button data-mode="anim" class="${mode==="anim"?"is-active":""}">演示</button>
        </div>
        <button class="btn btn-quiet" id="btnReset">重置</button>
      </div>
      <div class="surface">
        <div id="pitchBox"></div>
        <div class="player-bar hidden" id="playerBar">
          <button class="pbtn" id="pbReset" title="初始站位">⌂</button>
          <button class="pbtn" id="pbPrev" title="上一步">‹</button>
          <button class="pbtn pbtn-main" id="pbPlay" title="播放/暂停">▶</button>
          <button class="pbtn" id="pbNext" title="下一步">›</button>
          <div class="scrub" id="scrub"></div>
          <select class="inp inp-mini" id="pbSpeed" title="速度">
            <option value="0.7">0.7×</option>
            <option value="1" selected>1×</option>
            <option value="1.6">1.6×</option>
          </select>
        </div>
        <div class="stepnote" id="stepNote"></div>
        <div class="legendbar">
          <span><i style="background:#5b3df5"></i>己方</span>
          <span><i style="background:#8e8e93"></i>对方</span>
          <span><i style="background:#e8890c"></i>球的路线</span>
          <span><i style="background:#b7aaf6"></i>无球跑动（虚线）</span>
          <span><i style="background:#fff;border:1px solid #b7aaf6;width:8px;height:8px"></i>落点 / ○</span>
          <span><i style="background:transparent;position:relative"><u style="position:absolute;left:1px;top:3px;width:7px;height:1.5px;background:#e8890c;transform:rotate(45deg)"></u><u style="position:absolute;left:1px;top:3px;width:7px;height:1.5px;background:#e8890c;transform:rotate(-45deg)"></u></i>射门</span>
        </div>
      </div>`;

    $("#phSeg").querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => { st.phase = b.dataset.ph; st.style = ""; bag = {}; renderTactics(c, p); }));
    $("#fStyle").addEventListener("change", e => { st.style = e.target.value; bag = {}; loadNext(true); });
    $("#fForm").addEventListener("change", e => { st.formation = e.target.value; bag = {}; loadNext(true); });
    $("#fDiff").addEventListener("change", e => { st.difficulty = +e.target.value; bag = {}; loadNext(true); });
    $("#btnReset").addEventListener("click", () => { S.filters = { phase:"atk", style:"", formation:"", difficulty:0 }; bag = {}; renderTactics(c, p); });
    $$("#modeSeg button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("#pbReset").addEventListener("click", () => { if (mode === "diagram") setMode("anim"); else anim && anim.reset(); });
    $("#pbPrev").addEventListener("click", () => ensureAnim() && anim.prev());
    $("#pbNext").addEventListener("click", () => ensureAnim() && anim.next());
    $("#pbPlay").addEventListener("click", () => { if (ensureAnim()) anim.playing ? anim.pause() : anim.play(); });
    $("#pbSpeed").addEventListener("change", e => anim && anim.setSpeed(1 / +e.target.value));

    // 载入套路：外部指定 > 抽签
    if (S.pendingPattern) {
      const pat = PATTERNS.find(x => x.id === S.pendingPattern);
      S.pendingPattern = null;
      if (pat) { mountPattern(pat); return; }
    }
    if (S.patternId) {
      const cur = PATTERNS.find(x => x.id === S.patternId);
      if (cur && cur.gameType === S.gameType) { mountPattern(cur, true); return; }
    }
    loadNext(false);
  }

  let curPat = null;
  let mode = "diagram";   // diagram 图示全图 | anim 逐帧演示

  function setMode(m) {
    mode = m;
    $$("#modeSeg button").forEach(b => b.classList.toggle("is-active", b.dataset.mode === m));
    applyMode();
  }
  /* 从图示切到演示（惰性挂动画） */
  function ensureAnim() {
    if (mode !== "anim") setMode("anim");
    return anim;
  }
  function applyMode() {
    if (!curPat) return;
    if (mode === "diagram") {
      if (anim) { anim.pause(); anim = null; }
      Pitch.renderDiagram($("#pitchBox"), curPat);
      $("#playerBar").classList.add("hidden");
      $("#stepNote").innerHTML = `<span style="color:var(--ink3);font-weight:400">全图 · 橙线是球的路线，按 ①②③ 顺序读 · 点「演示」看逐帧跑位</span>`;
      $$(".step-link").forEach(b => b.classList.remove("is-on"));
    } else {
      anim = Pitch.createAnim($("#pitchBox"), curPat, {
        onStep: i => syncStep(curPat, i),
        onPlayState: playing => { const b = $("#pbPlay"); if (b) b.textContent = playing ? "⏸" : "▶"; },
      });
      const N = curPat.steps.length;
      $("#scrub").innerHTML = Array.from({length:N}, (_,i) =>
        `<button class="scrub-cell" data-s="${i}" title="第 ${i+1} 步"></button>`).join("");
      $$("#scrub .scrub-cell").forEach(b => b.addEventListener("click", () => { anim.pause(); anim.show(+b.dataset.s); }));
      $("#playerBar").classList.remove("hidden");
      anim.show(-1);
    }
  }

  function loadNext(announce) {
    const pool = poolFor(S.filters);
    if (!pool.length) {
      $("#pitchBox").innerHTML = "";
      $("#stepNote").innerHTML = `<span style="color:var(--ink3);font-weight:400">该条件下暂无套路，换个组合试试</span>`;
      $("#panel").innerHTML = "";
      return;
    }
    const pat = drawFromPool(pool);
    if (announce && S.patternId && pat.id !== S.patternId) toast("已切换：" + pat.title);
    mountPattern(pat, true);
  }

  function mountPattern(pat, keepMode) {
    curPat = pat;
    S.patternId = pat.id;
    if (!keepMode) mode = "diagram";
    applyMode();
    renderPatternPanel(pat);
  }

  function syncStep(pat, i) {
    $$("#scrub .scrub-cell").forEach(cell => {
      const s = +cell.dataset.s;
      cell.classList.toggle("is-done", i >= 0 && s < i);
      cell.classList.toggle("is-on", s === i);
    });
    const note = $("#stepNote");
    if (!note) return;
    note.innerHTML = i < 0
      ? `<span style="color:var(--ink3);font-weight:400">初始站位 · 空格播放，←→ 逐步</span>`
      : `<span class="no">${i+1}</span><span>${esc(pat.steps[i].note)}</span>`;
    $$(".step-link").forEach(b => b.classList.toggle("is-on", +b.dataset.step === i));
  }

  function renderPatternPanel(pat) {
    $("#panel").innerHTML = `
      <div class="ptabs">
        <button class="ptab is-on" data-t="cat">套路目录</button>
        <button class="ptab" data-t="detail">本套路详解</button>
      </div>
      <div id="ptabCat"></div>
      <div id="ptabDetail" class="hidden"></div>`;
    renderCatalog($("#ptabCat"), pat);
    renderDetail($("#ptabDetail"), pat);
    $$(".ptab").forEach(b => b.addEventListener("click", () => {
      $$(".ptab").forEach(x => x.classList.toggle("is-on", x === b));
      $("#ptabCat").classList.toggle("hidden", b.dataset.t !== "cat");
      $("#ptabDetail").classList.toggle("hidden", b.dataset.t !== "detail");
    }));
  }

  /* 目录：进攻 / 防守两大组，组内按风格分类 */
  function renderCatalog(host, pat) {
    const phases = [ { key:"atk", label:"进攻套路" }, { key:"def", label:"防守套路" } ];
    host.innerHTML = phases.map(ph => {
      const open = S.filters.phase === ph.key;
      const list = PATTERNS.filter(x => x.gameType === S.gameType && x.phase === ph.key);
      const styleKeys = Object.keys(STYLE_LABELS[S.gameType][ph.key]);
      /* 每个套路只归入主风格（第一个标签），保证不重不漏、计数一致 */
      const groups = styleKeys.map(k => ({
        label: STYLE_LABELS[S.gameType][ph.key][k],
        items: list.filter(x => (x.styles||[])[0] === k),
      })).filter(g => g.items.length);
      return `
        <div class="cat-group ${open ? "is-open" : ""}">
          <button class="cat-head" data-ph="${ph.key}">
            <span>${ph.label}</span><span class="cnt">${list.length}</span><span class="chev">${open ? "▾" : "▸"}</span>
          </button>
          ${open ? groups.map(g => `
            <div class="cat-sec">${esc(g.label)}</div>
            ${g.items.map(x => `
              <button class="cat-row ${x.id === pat.id ? "is-on" : ""}" data-pid="${x.id}">
                <span class="nm">${esc(x.title)}</span>
                <span class="diff">${"★".repeat(x.difficulty)}</span>
              </button>`).join("")}`).join("")
          : ""}
        </div>`;
    }).join("");
    $$(".cat-head", host).forEach(b => b.addEventListener("click", () => {
      if (S.filters.phase !== b.dataset.ph) {
        S.filters.phase = b.dataset.ph;
        S.filters.style = ""; bag = {};
        syncPhase();
        loadNext(false);
        renderPatternPanel(curPat);
      }
    }));
    $$(".cat-row", host).forEach(b => b.addEventListener("click", () => {
      const target = PATTERNS.find(x => x.id === b.dataset.pid);
      if (!target) return;
      if (target.phase !== S.filters.phase) { S.filters.phase = target.phase; syncPhase(); }
      mountPattern(target, false);
    }));
  }
  /* 目录组与画布阶段 seg 的状态同步 */
  function syncPhase() {
    $$("#phSeg button").forEach(b => b.classList.toggle("is-active", b.dataset.ph === S.filters.phase));
  }

  function renderDetail(host, pat) {
    const styles = (pat.styles||[]).map(s => (STYLE_LABELS[pat.gameType]?.[pat.phase]||{})[s]).filter(Boolean);
    host.innerHTML = `
      <h2>${esc(pat.title)}<span class="en">${pat.phase==="atk"?"ATTACK":"DEFENCE"} · ${"★".repeat(pat.difficulty)}</span></h2>
      <p class="lede">${esc(pat.summary)}</p>
      ${styles.length ? `<div class="p-sec"><div class="p-sec-t">风格</div>${styles.map(s=>`<span class="cap-line">${esc(s)}</span>`).join(" ")}</div>` : ""}
      <div class="p-sec">
        <div class="p-sec-t">指导要点</div>
        ${pat.keyPoints.map((k,i) => `<div class="kp-row"><span class="no">${i+1}</span><span>${esc(k)}</span></div>`).join("")}
      </div>
      <div class="p-sec">
        <div class="p-sec-t">分步讲解（点击看该步）</div>
        ${pat.steps.map((s,i) => `<button class="step-link" data-step="${i}"><span class="no">${i+1}</span><span>${esc(s.note)}</span></button>`).join("")}
      </div>
      <div class="p-actions">
        <button class="btn btn-quiet" id="pnSave">${ic("saved")} 收藏</button>
        <button class="btn btn-quiet" id="pnNext">换一个</button>
      </div>
      <div class="footnote"><b>依据</b>　${esc(refNames(pat.refs))}</div>`;
    $$(".step-link", host).forEach(b => b.addEventListener("click", () => {
      setMode("anim");
      anim.show(+b.dataset.step);
      $("#canvas").scrollTo({ top:0, behavior:"smooth" });
    }));
    $("#pnSave", host).addEventListener("click", () => {
      if (addSaved({ type:"tactic", refId:pat.id, key:"", title:pat.title,
        desc:`${pat.phase==="atk"?"进攻":"防守"} · ${pat.gameType==="futsal"?"五人制":"八人制"} · ${"★".repeat(pat.difficulty)}` }))
        toast("已收藏");
    });
    $("#pnNext", host).addEventListener("click", () => loadNext(true));
  }

  /* ---------- 阵型库 ---------- */
  function renderFormations(c, p) {
    const f = currentFormation();
    S.formationId = f.id;
    c.innerHTML = `
      <div class="surface"><div id="pitchBox"></div></div>
      <div class="filmstrip" id="strip"></div>`;
    Pitch.renderStatic($("#pitchBox"), f.players, f.gameType);
    const strip = $("#strip");
    formationsOf(S.gameType).forEach(x => {
      const t = document.createElement("button");
      t.className = "thumb" + (x.id === f.id ? " is-on" : "");
      t.innerHTML = `<div class="thumb-pitch"></div><div class="thumb-cap">${esc(x.name)}</div>`;
      t.addEventListener("click", () => { S.formationId = x.id; renderFormations(c, p); });
      strip.appendChild(t);
      Pitch.renderStatic(t.querySelector(".thumb-pitch"), x.players, x.gameType);
    });
    renderFormationPanel(f, p);
  }

  function renderFormationPanel(f, p) {
    const related = PATTERNS.filter(x => x.gameType === f.gameType && (x.formation === f.id || x.formation === "any"));
    p.innerHTML = `
      <h2>${esc(f.name)}<span class="en">${esc(f.en)}</span></h2>
      <p class="lede">${esc(f.desc)}</p>
      <div class="p-sec">
        <div class="p-sec-t">角色分工</div>
        ${f.roles.map(r => `<div class="role-row"><span class="no">${esc(r.num)}</span><div><b>${esc(r.label)}</b><span>　${esc(r.desc)}</span></div></div>`).join("")}
      </div>
      <div class="p-sec">
        <div class="p-sec-t">优势</div>
        ${f.pros.map(x => `<div class="pc-row plus"><i>＋</i><span>${esc(x)}</span></div>`).join("")}
        <div class="p-sec-t" style="margin-top:14px">代价</div>
        ${f.cons.map(x => `<div class="pc-row minus"><i>－</i><span>${esc(x)}</span></div>`).join("")}
      </div>
      <div class="p-sec">
        <div class="p-sec-t">适用场景</div>
        <div class="kp-row"><span>${esc(f.use)}</span></div>
      </div>
      <div class="p-sec">
        <div class="p-sec-t">相关套路</div>
        ${related.map(x => `<button class="xrow" data-pid="${x.id}"><span class="no">${x.phase==="atk"?"攻":"防"}</span><span><span class="x-t">${esc(x.title)}</span><span class="x-d">${esc(x.summary)}</span></span></button>`).join("") || `<div class="kp-row"><span>暂无</span></div>`}
      </div>
      <div class="footnote"><b>依据</b>　${esc(refNames(f.refs))}</div>`;
    $$(".xrow", p).forEach(b => b.addEventListener("click", () => {
      S.pendingPattern = b.dataset.pid; go("tactics");
    }));
  }

  /* ---------- 训练课 ---------- */
  const AGE_LABELS = { foundation:"U8-U10", youth:"U11-U12", older:"U13+" };
  function blockPlan(duration, age) {
    const ratios = age === "foundation" ? [.20,.25,.22,.25,.08]
                 : age === "youth"     ? [.18,.25,.27,.24,.06]
                 :                       [.15,.24,.30,.26,.05];
    const raw = ratios.map(r => Math.max(5, Math.round(duration * r / 5) * 5));
    let diff = duration - raw.reduce((a,b)=>a+b,0);
    const order = raw.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]);
    let oi = 0;
    while (diff !== 0) {
      const i = order[oi % order.length][1];
      const step = diff > 0 ? 5 : -5;
      if (raw[i] + step >= 5) { raw[i] += step; diff -= step; }
      oi++; if (oi > 40) break;
    }
    return raw;
  }
  function buildSession(theme, age, duration) {
    const [w,t,k,s,c] = blockPlan(duration, age);
    return { theme, age, duration, blocks:[
      { ...theme.warm,  key:"warm",  name:"热身激活",  exName:theme.warm.name,  dur:w, color:"rgba(84,64,214,1)" },
      { ...theme.tech,  key:"tech",  name:"技术练习",  exName:theme.tech.name,  dur:t, color:"rgba(84,64,214,.72)" },
      { ...theme.skill, key:"skill", name:"技能对抗",  exName:theme.skill.name, dur:k, color:"rgba(84,64,214,.5)" },
      { ...theme.ssg,   key:"ssg",   name:"主题比赛",  exName:theme.ssg.name,   dur:s, color:"rgba(84,64,214,.32)" },
      { key:"close", name:"收束与提问", exName:"", dur:c, color:"rgba(84,64,214,.18)",
        org:"集合拉伸，围绕今天的主题回顾。",
        questions:theme.ask,
        points:["引导回答，不直接给答案","表扬今天具体做到的行为"] },
    ]};
  }

  function renderSessions(c, p) {
    const ss = S.session;
    const themes = THEMES.filter(t => t.gameType === S.gameType);
    if (!themes.find(t => t.id === ss.theme)) ss.theme = "";
    /* 主题按分类分组展示 */
    const CAT_ORDER = ["进攻","配合","跑动","对抗","防守","转换","身体"];
    const groups = CAT_ORDER.map(cat => ({ cat, items: themes.filter(t => (t.cat||"其他") === cat) })).filter(g => g.items.length);
    const leftover = themes.filter(t => !CAT_ORDER.includes(t.cat||""));
    if (leftover.length) groups.push({ cat:"其他", items:leftover });
    c.innerHTML = `
      <div class="controls">
        <select class="inp" id="ssTheme">
          <option value="">随机主题</option>
          ${groups.map(g => `<optgroup label="${esc(g.cat)} · ${g.items.length} 个主题">${g.items.map(t => `<option value="${t.id}" ${ss.theme===t.id?"selected":""}>${esc(t.title)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <select class="inp" id="ssAge">${Object.entries(AGE_LABELS).map(([k,lab]) => `<option value="${k}" ${ss.age===k?"selected":""}>${lab}</option>`).join("")}</select>
        <select class="inp" id="ssDur">${[45,60,75,90].map(d => `<option value="${d}" ${ss.duration===d?"selected":""}>${d} 分钟</option>`).join("")}</select>
        <button class="btn btn-primary" id="btnGenS">生成教案</button>
      </div>
      <div id="docHost"><div class="doc-empty">选择主题、年龄段和时长，点「生成教案」——五段结构的完整教案会显示在这里，可打印带走。</div></div>
      <div class="tipfoot"><b>今日提示</b>　${esc(TIPS[(Date.now()/86400000|0) % TIPS.length])}</div>`;
    $("#ssTheme").addEventListener("change", e => ss.theme = e.target.value);
    $("#ssAge").addEventListener("change", e => ss.age = e.target.value);
    $("#ssDur").addEventListener("change", e => ss.duration = +e.target.value);
    $("#btnGenS").addEventListener("click", () => {
      const theme = ss.theme ? themes.find(t => t.id === ss.theme) : pick(themes);
      if (!theme) { toast("该赛制暂无主题"); return; }
      mountSession(buildSession(theme, ss.age, ss.duration));
    });
    if (S.lastPlan && S.lastPlan.theme.gameType === S.gameType) mountSession(S.lastPlan);
    else p.innerHTML = `<h2>训练课</h2><p class="lede">按英格兰四角模型组织：热身 → 技术 → 技能对抗 → 主题比赛 → 收束提问。选择条件生成后，这里会显示课程结构与快捷操作。</p>`;
  }

  /* 从组织文字中提取人数形式（如 4v4） */
  const ORG_RE = /(\d+v\d+|\d+\s*人一组|两人一组|每人一球|三人三角)/;
  function mountSession(plan) {
    S.lastPlan = plan;
    const total = plan.blocks.reduce((a,b)=>a+b.dur,0);
    const INTENSITY = { "热身激活":"中", "技术练习":"低-中", "技能对抗":"高", "主题比赛":"高", "收束与提问":"低" };
    const EQUIP = "标志碟 20+ · 足球（每人 1 颗 + 备用）· 标志服两色 · 小球门 2-4 · 大球门 2 · 绳梯/标志圈（身体主题）";
    const host = $("#docHost");
    host.innerHTML = `
      <div class="doc">
        <div class="doc-head">
          <h2>${esc(plan.theme.title)}</h2>
          <div class="meta">${plan.theme.gameType==="futsal"?"五人制":"八人制"} · ${AGE_LABELS[plan.age]} · 共 ${total} 分钟 · 强度：技术低-中 / 对抗高</div>
          <div class="focus">主题焦点：${esc(plan.theme.focus)}</div>
        </div>

        <table class="ov-table">
          <thead><tr><th>环节</th><th class="w-t">时间</th><th>内容</th><th>组织形式</th><th class="w-i">强度</th></tr></thead>
          <tbody>
            ${plan.blocks.map((b,i) => `
              <tr>
                <td>${"①②③④⑤"[i]} ${esc(b.name)}</td>
                <td class="w-t">${b.dur}′</td>
                <td>${esc(b.exName || b.org.split("。")[0].slice(0,18))}</td>
                <td>${esc((b.org.match(ORG_RE) || ["按主题组织"])[0])}</td>
                <td class="w-i">${INTENSITY[b.name]||"—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>

        ${plan.blocks.map((b,i) => {
          const meta = DRILL_META[`${plan.theme.id}.${b.key}`] || null;
          return `
          <div class="blk" id="blk-${i}">
            <div class="blk-time">
              <div class="t">${b.dur}<span class="u"> min</span></div>
              <span class="bar" style="background:${b.color};width:${Math.max(10, Math.round(b.dur/total*64))}px"></span>
              <span class="tag-i">${INTENSITY[b.name]||""}</span>
            </div>
            <div class="blk-body">
              <div class="blk-title"><span class="idx">${"①②③④⑤"[i]}</span>${esc(b.name)}${b.exName ? `<span style="font-weight:500;color:var(--ink3);font-size:13px">　${esc(b.exName)}</span>` : ""}</div>
              <div class="blk-grid">
                <div class="drill-box" data-dg="${meta ? esc(meta.dg) : ""}"></div>
                <div class="blk-right">
                  <div class="blk-org">${esc(b.org || "")}</div>
                  ${meta ? `
                  <div class="blk-sec"><div class="t">成功标准（当场检验）</div>
                    <ul class="std-list">${meta.std.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
                  <div class="blk-sec"><div class="t">常见错误 → 纠正</div>
                    <ul class="err-list">${meta.err.map(([e,fix])=>`<li><b>${esc(e)}</b><span> → ${esc(fix)}</span></li>`).join("")}</ul></div>` : ""}
                </div>
              </div>
              ${b.questions ? `<div class="blk-sec"><div class="t">主题提问</div><ul>${b.questions.map(q=>`<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}
              ${b.prog ? `<div class="blk-sec"><div class="t">进阶</div><ul><li>${esc(b.prog)}</li></ul></div>` : ""}
              ${b.reg ? `<div class="blk-sec"><div class="t">降阶</div><ul><li>${esc(b.reg)}</li></ul></div>` : ""}
              ${b.points ? `<div class="blk-sec"><div class="t">指导要点</div><ul>${b.points.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
            </div>
          </div>`;
        }).join("")}

        <table class="ov-table" style="margin-top:22px">
          <thead><tr><th>器材清单</th><th>场地建议</th><th>人员配置</th></tr></thead>
          <tbody><tr>
            <td>${esc(EQUIP)}</td>
            <td>${plan.theme.gameType==="futsal"?"室内/硬地半场（40×20m 或等比缩放）":"八人制半场（55×40m，可按人数缩放）"}</td>
            <td>${AGE_LABELS[plan.age]} · 按主题 8-16 人均可组织，含门将位置轮换</td>
          </tr></tbody>
        </table>
        <div class="tipfoot"><b>依据</b>　${esc(refNames(plan.theme.refs))}　·　教案图解格式参考 JFA / The FA practice pitch 结构</div>
      </div>`;

    // 渲染布置图
    $$(".drill-box", host).forEach(box => { if (box.dataset.dg) Drill.render(box, box.dataset.dg); });

    $("#panel").innerHTML = `
      <h2>课程结构<span class="en">${AGE_LABELS[plan.age]} · ${total} MIN</span></h2>
      <div class="p-sec">
        ${plan.blocks.map((b,i) => `<button class="ol-row" data-blk="${i}"><span class="bar" style="background:${b.color}"></span><span class="nm">${esc(b.name)}</span><span class="du">${b.dur}′</span></button>`).join("")}
      </div>
      <div class="p-actions">
        <button class="btn btn-primary" id="ssSave">${ic("saved")} 收藏教案</button>
        <button class="btn btn-quiet" id="ssPrint">${ic("print")} 打印</button>
      </div>
      <div class="footnote"><b>提示</b>　打印即得一份带布置图与要求表的纸质教案，右栏不参与打印。</div>`;
    $$(".ol-row").forEach(b => b.addEventListener("click", () =>
      $("#canvas").querySelector(`#blk-${b.dataset.blk}`)?.scrollIntoView({ behavior:"smooth", block:"start" })));
    $("#ssSave").addEventListener("click", () => {
      if (addSaved({ type:"session", refId:plan.theme.id, key:`${plan.age}-${plan.duration}`,
        title:`${plan.theme.title}`, desc:`${plan.theme.gameType==="futsal"?"五人制":"八人制"} · ${AGE_LABELS[plan.age]} · ${total} 分钟` }))
        toast("已收藏");
    });
    $("#ssPrint").addEventListener("click", () => window.print());
  }

  /* ---------- 收藏 ---------- */
  function renderSaved(c) {
    const list = loadSaved();
    c.innerHTML = `<div class="list">
      <div class="list-head">我的收藏</div>
      <div class="list-sub">保存在本机浏览器 · ${list.length} 项</div>
      ${list.length ? list.map(x => `
        <div class="row">
          <div class="r-main">
            <div class="r-t">${esc(x.title)}</div>
            <div class="r-d">${esc(x.desc || "")} · ${new Date(x.ts).toLocaleDateString("zh-CN")}</div>
          </div>
          <div class="r-act">
            <button class="btn btn-quiet" data-open="${x.refId}" data-skey="${esc(x.key||"")}" data-type="${x.type}">打开</button>
            <button class="btn btn-quiet" data-del data-type="${x.type}" data-rid="${x.refId}" data-k="${esc(x.key||"")}">删除</button>
          </div>
        </div>`).join("")
      : `<div class="empty-line">还没有收藏——在战术或训练课页点「收藏」，就会出现在这里。</div>`}
    </div>`;
    $$("[data-open]", c).forEach(b => b.addEventListener("click", () => {
      if (b.dataset.type === "session") {
        const [age, dur] = (b.dataset.skey || "").split("-");
        const theme = THEMES.find(t => t.id === b.dataset.open);
        if (!theme) { toast("内容已更新，请重新生成"); delSaved("session", b.dataset.open, b.dataset.skey || ""); renderSaved(c); return; }
        S.gameType = theme.gameType;
        S.lastPlan = buildSession(theme, age || "foundation", +dur || 60);
        go("sessions");
      } else {
        const pat = PATTERNS.find(x => x.id === b.dataset.open);
        if (!pat) { toast("内容已更新"); delSaved("tactic", b.dataset.open, ""); renderSaved(c); return; }
        S.gameType = pat.gameType;
        S.pendingPattern = pat.id;
        go("tactics");
      }
    }));
    $$("[data-del]", c).forEach(b => b.addEventListener("click", () => {
      delSaved(b.dataset.type, b.dataset.rid, b.dataset.k || "");
      renderSaved(c); toast("已删除");
    }));
  }

  /* ---------- 依据 ---------- */
  function renderAbout(c) {
    c.innerHTML = `<div class="prose">
      <h2>方法与依据</h2>
      <p class="lede">这里的每个阵型、套路和训练课都不是拍脑袋写的：内容挂在这几个权威体系上，教练可以按图索骥去原始出处深挖。</p>
      ${REFS.map(r => `
        <div class="ref-row">
          <div class="r-n"><span class="cap-line">${esc(r.tag)}</span>${esc(r.name)}</div>
          <div class="r-o">${esc(r.org)}</div>
          <div class="r-note">${esc(r.note)}</div>
          <a href="${r.url}" target="_blank" rel="noopener">访问出处 ↗</a>
        </div>`).join("")}
      <div class="ref-row">
        <div class="r-n">内容对照</div>
        <div class="r-note" style="margin-top:10px">
          英格兰 DNA「怎么踢」→ 各套路的指导要点均落在控球、创造、勇敢三条原则；<br>
          六大核心能力 → 每个战术步骤的要点落到 Scanning / Timing / Movement / Positioning / Deception / Techniques；<br>
          四角模型 → 训练课五段结构（热身 → 技术 → 技能 → 主题比赛 → 提问）保证每项练习至少覆盖两角；<br>
          FIFA 五人制手册 → 全部五人制阵型与轮转、支点、压迫体系；<br>
          西班牙 Fútbol 8 → 八人制阵型与「构建 - 渗透 - 终结」教学顺序；<br>
          FIFA 五人制规则 → 4 秒、门将再触球限制等要点已核对进套路讲解。
        </div>
      </div>
    </div>`;
  }

  /* ---------- 启动 ---------- */
  function init() {
    // 图标注入
    $$("[data-ic]").forEach(el => { el.innerHTML = ic(el.dataset.ic); });
    // 记住上次赛制
    try {
      const gt = localStorage.getItem("tacticlab.gt");
      if (gt === "futsal" || gt === "field8") S.gameType = gt;
    } catch {}
    $$("#gtSeg button").forEach(b => b.addEventListener("click", () => {
      if (S.gameType === b.dataset.gt) return;
      S.gameType = b.dataset.gt;
      S.formationId = null; S.patternId = null; S.lastPlan = null;
      bag = {};
      try { localStorage.setItem("tacticlab.gt", S.gameType); } catch {}
      render();
    }));
    $$(".rail-item, .tab-item").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
    $("#savedBtn").addEventListener("click", () => go("saved"));
    document.addEventListener("keydown", e => {
      if (S.view !== "tactics" || !anim) return;
      if (/select|input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") { anim.next(); }
      else if (e.key === "ArrowLeft") { anim.prev(); }
      else if (e.key === " ") { e.preventDefault(); anim.playing ? anim.pause() : anim.play(); }
    });
    render();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
