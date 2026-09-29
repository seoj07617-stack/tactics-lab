/* ============================================================
   TacticLab · 主逻辑
   ============================================================ */
"use strict";

(() => {
  /* ---------- 工具 ---------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  /* 依据短标签：让徽章有主语（如「英格兰 DNA」「FIFA 手册」） */
  const REF_SHORT = { "英格兰":"英格兰 DNA", "西班牙":"西班牙青训", "五人制":"FIFA 手册", "欧洲":"UEFA" };
  const refShort = id => REF_SHORT[refTag(id)] || refTag(id);

  /* ---------- SVG 图标库（线性风格，随 currentColor 着色） ---------- */  const ICONS = {
    home: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 8.6 9 3l6.2 5.6"/><path d="M4.5 7.6v6.6a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7.6"/></svg>',
    formations: '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="4.3" r="2" fill="currentColor"/><circle cx="4.2" cy="13.2" r="2" fill="currentColor"/><circle cx="13.8" cy="13.2" r="2" fill="currentColor"/><path d="M9 6.6 5.3 11.3M9 6.6l3.7 4.7M6.4 13.2h5.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    studio: '<svg viewBox="0 0 18 18" fill="currentColor"><path d="M9 2.2c.55 3.2 1.6 4.25 4.8 4.8-3.2.55-4.25 1.6-4.8 4.8-.55-3.2-1.6-4.25-4.8-4.8 3.2-.55 4.25-1.6 4.8-4.8Z"/><path d="M14.2 10.6c.3 1.75.9 2.35 2.6 2.65-1.7.3-2.3.9-2.6 2.65-.3-1.75-.9-2.35-2.6-2.65 1.7-.3 2.3-.9 2.6-2.65Z" opacity=".55"/></svg>',
    sessions: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="9" r="6.4"/><path d="M9 5.6V9l2.5 1.6"/></svg>',
    saved: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 2.6l2 4.1 4.5.65-3.25 3.17.77 4.48L9 12.9l-4.02 2.1.77-4.48L2.5 7.35 7 6.7 9 2.6Z"/></svg>',
    about: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="2.5" width="11" height="13" rx="2"/><path d="M6.8 2.5v13"/></svg>',
    tip: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.2a4.8 4.8 0 0 1 4.8 4.8c0 1.8-1 2.8-1.8 3.8-.5.6-.7 1.1-.7 1.8H6.7c0-.7-.2-1.2-.7-1.8-.8-1-1.8-2-1.8-3.8A4.8 4.8 0 0 1 9 2.2Z"/><path d="M7.4 15.3h3.2"/></svg>',
    print: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 6.5V3h7v3.5"/><rect x="3" y="6.5" width="12" height="6" rx="1.5"/><path d="M5.5 10.5h7V15h-7Z"/></svg>',
  };

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- 状态 ---------- */
  const S = {
    view: "home",
    gameType: "futsal",           // futsal | field8
    studio: { phase:"atk", style:"", formation:"", difficulty:0 },
    session: { theme:"", age:"foundation", duration:60 },
    savedTab: "tactic",
    detailFormation: null,
    detailPattern: null,
    detailSession: null,
  };
  const STORE_KEY = "tacticlab.saved.v1";

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }
  function storeSaved(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
    catch { toast("浏览器存储不可用，收藏未保存"); }
  }
  function addSaved(item) {
    const list = loadSaved();
    if (list.some(x => x.type === item.type && x.refId === item.refId && x.key === item.key)) {
      toast("已在收藏中"); return false;
    }
    list.unshift({ ...item, ts: Date.now() });
    storeSaved(list.slice(0, 200));
    return true;
  }
  function delSaved(type, refId, key) {
    storeSaved(loadSaved().filter(x => !(x.type===type && x.refId===refId && (x.key||"")===key)));
  }
  const isSaved = (type, refId, key="") => loadSaved().some(x => x.type===type && x.refId===refId && x.key===key);

  /* ---------- 壳与导航 ---------- */
  const TITLES = { home:"总览", formations:"阵型库", studio:"战术生成", sessions:"训练课设计", saved:"我的收藏", about:"方法与依据" };

  function go(view) {
    S.view = view;
    S.detailFormation = null; S.detailPattern = null; S.detailSession = null;
    $$(".nav-item").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
    $("#topbarTitle").textContent = TITLES[view] || view;
    $("#drawer").classList.remove("open");
    $("#drawerMask").classList.remove("show");
    $("#topbarRight").innerHTML = "";
    $("#view").scrollTop = 0;
    render();
  }

  function render() {
    const v = $("#view");
    v.classList.remove("enter");
    void v.offsetWidth;
    v.classList.add("enter");
    if (S.detailPattern)      return renderPatternDetail(v, S.detailPattern);
    if (S.detailFormation)    return renderFormationDetail(v, S.detailFormation);
    if (S.detailSession)      return renderSessionDetail(v, S.detailSession);
    ({ home:renderHome, formations:renderFormations, studio:renderStudio,
       sessions:renderSessions, saved:renderSaved, about:renderAbout })[S.view](v);
  }

  /* ---------- 首页 ---------- */
  function renderHome(v) {
    const today = new Date();
    const h = today.getHours();
    const greet = h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
    const week = ["周日","周一","周二","周三","周四","周五","周六"][today.getDay()];
    const dateStr = `${today.getMonth()+1} 月 ${today.getDate()} 日 · ${week}`;
    const tip = TIPS[(today.getFullYear()*372 + (today.getMonth()+1)*31 + today.getDate()) % TIPS.length];
    const futsalN = FUTSAL_FORMATIONS.length + FUTSAL_ATTACK.length + FUTSAL_DEFENSE.length;
    const field8N = FIELD8_FORMATIONS.length + FIELD8_ATTACK.length + FIELD8_DEFENSE.length;
    const savedList = loadSaved().slice(0, 3);
    v.innerHTML = `
      <div class="hello">
        <div class="hello-date">${dateStr}</div>
        <h1 class="hero-title">${greet}，教练。<span class="thin">今天备什么课？</span></h1>
        <p>五人制与八人制的阵型、攻防套路与训练课，全部内容标注英格兰 DNA 与西班牙青训体系依据。</p>
      </div>
      <div class="grid grid-home" style="margin-bottom:16px">
        <div class="glass card stat-card" data-goto="formations"><div class="stat-ic">${ICONS.formations}</div><div class="num">${FUTSAL_FORMATIONS.length + FIELD8_FORMATIONS.length}</div><div class="lbl">阵型库</div></div>
        <div class="glass card stat-card" data-goto="studio"><div class="stat-ic">${ICONS.studio}</div><div class="num">${PATTERNS.length}</div><div class="lbl">攻防套路</div></div>
        <div class="glass card stat-card" data-goto="sessions"><div class="stat-ic">${ICONS.sessions}</div><div class="num">${THEMES.length}</div><div class="lbl">训练主题</div></div>
        <div class="glass card stat-card" data-goto="saved"><div class="stat-ic">${ICONS.saved}</div><div class="num">${loadSaved().length}</div><div class="lbl">我的收藏</div></div>
      </div>
      <div class="grid grid-2" style="margin-bottom:18px">
        <button class="glass card quick" data-goto="studio">
          <div class="q-ic">${ICONS.studio}</div>
          <div><div class="q-t">生成战术</div><div class="q-d">按阵型·风格·难度，生成带动画的进攻/防守套路</div></div>
          <span class="q-arrow">›</span>
        </button>
        <button class="glass card quick" data-goto="sessions">
          <div class="q-ic">${ICONS.sessions}</div>
          <div><div class="q-t">设计训练课</div><div class="q-d">主题 × 年龄 × 时长，一分钟出完整教案</div></div>
          <span class="q-arrow">›</span>
        </button>
      </div>
      ${savedList.length ? `
      <div class="section-t">最近收藏</div>
      <div class="grid" style="gap:10px;margin-bottom:18px">
        ${savedList.map(x => `
          <button class="glass card quick saved-mini" data-goto="saved">
            <div class="q-ic">${x.type === "tactic" ? ICONS.studio : ICONS.sessions}</div>
            <div><div class="q-t">${esc(x.title)}</div><div class="q-d">${x.type === "tactic" ? "战术套路" : "训练教案"} · ${new Date(x.ts).toLocaleDateString("zh-CN")}</div></div>
            <span class="q-arrow">›</span>
          </button>`).join("")}
      </div>` : ""}
      <div class="glass tip-box">
        <div class="t-ic">${ICONS.tip}</div>
        <div><div class="t-t">今日执教提示</div><div class="t-c">${esc(tip)}</div></div>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--ink3)">
        五人制内容 ${futsalN} 条 · 八人制内容 ${field8N} 条 · 依据库 ${REFS.length} 项
      </div>`;
    $$("[data-goto]", v).forEach(el => el.addEventListener("click", () => go(el.dataset.goto)));
  }

  /* ---------- 阵型库 ---------- */
  function renderFormations(v) {
    const list = FORMATIONS.filter(f => f.gameType === S.gameType);
    v.innerHTML = `
      <div class="page-head">
        <h1>阵型库</h1>
        <p>每个阵型都给出角色分工、优劣势与适用场景。五人制体系依据 FIFA 教练手册，八人制对应西班牙 Fútbol 8 与英格兰青训教学结构。</p>
      </div>
      <div style="margin-bottom:16px">
        <div class="seg lg">
          <button data-gt="futsal" class="${S.gameType==="futsal"?"is-active":""}">五人制</button>
          <button data-gt="field8" class="${S.gameType==="field8"?"is-active":""}">八人制</button>
        </div>
      </div>
      <div class="grid grid-formations">
        ${list.map(f => `
          <div class="glass card lift f-card" data-fid="${f.id}">
            <div class="f-pitch" data-pitch="${f.id}"></div>
            <h3>${esc(f.name)}<span class="f-en">${esc(f.en)}</span></h3>
            <p>${esc(f.desc)}</p>
            <div class="f-tags">
              <span class="tag tag-purple">${f.players.length - 1} 外场 + GK</span>
              ${f.refs.map(r => `<span class="tag tag-gray">${esc(refShort(r))}</span>`).join("")}
            </div>
          </div>`).join("")}
      </div>`;
    list.forEach(f => Pitch.renderStatic($(`[data-pitch="${f.id}"]`, v), f.players, f.gameType));
    $$(".seg [data-gt]", v).forEach(b => b.addEventListener("click", () => { S.gameType = b.dataset.gt; renderFormations(v); }));
    $$(".f-card", v).forEach(c => c.addEventListener("click", () => { S.detailFormation = c.dataset.fid; render(); }));
  }

  function renderFormationDetail(v, fid) {
    const f = FORMATIONS.find(x => x.id === fid); if (!f) return go("formations");
    const related = PATTERNS.filter(p => p.gameType === f.gameType && (p.formation === f.id || p.formation === "any"));
    const relatedThemes = THEMES.filter(t => t.gameType === f.gameType);
    $("#topbarTitle").textContent = f.name;
    $("#topbarRight").innerHTML = `<button class="btn btn-ghost btn-sm" id="btnBack">‹ 返回</button>`;
    $("#btnBack").addEventListener("click", () => { S.detailFormation = null; render(); });
    v.innerHTML = `
      <div class="detail-wrap">
        <div>
          <div class="glass pitch-stage">
            <div id="fdPitch"></div>
          </div>
          <div class="glass card" style="margin-top:16px">
            <div class="pattern-head">
              <h2>${esc(f.name)} <span class="f-en" style="font-size:12px;color:var(--ink3)">${esc(f.en)}</span></h2>
              <div class="p-meta">${f.refs.map(r => `<span class="tag tag-gray">${esc(refShort(r))}</span>`).join("")}</div>
            </div>
            <p style="font-size:13.5px;color:var(--ink2)">${esc(f.desc)}</p>
            <div class="ref-line"><span class="tag tag-purple">适用</span><span>${esc(f.use)}</span></div>
          </div>
        </div>
        <div>
          <div class="glass card">
            <h3 style="font-size:15px;font-weight:700">角色分工</h3>
            <div class="role-list">
              ${f.roles.map(r => `<div class="role-item"><div class="r-num">${esc(r.num)}</div><div><b>${esc(r.label)}</b><span style="color:var(--ink2)"> — ${esc(r.desc)}</span></div></div>`).join("")}
            </div>
          </div>
          <div class="glass card" style="margin-top:16px">
            <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">优势与代价</h3>
            <div class="pros-cons">
              ${f.pros.map(p => `<div class="pc-row plus"><span class="pc-ic">＋</span><span>${esc(p)}</span></div>`).join("")}
              ${f.cons.map(p => `<div class="pc-row minus"><span class="pc-ic">－</span><span>${esc(p)}</span></div>`).join("")}
            </div>
          </div>
          <div class="glass card" style="margin-top:16px">
            <h3 style="font-size:15px;font-weight:700">相关套路 <span style="font-weight:400;font-size:12px;color:var(--ink3)">${related.length}</span></h3>
            <div class="role-list">
              ${related.map(p => `<button class="role-item" data-pid="${p.id}" style="background:none;border:none;font:inherit;cursor:pointer;text-align:left;width:100%"><div class="r-num">${p.phase==="atk"?"攻":"防"}</div><div><b>${esc(p.title)}</b><span style="color:var(--ink2)"> — ${esc(p.summary)}</span></div></button>`).join("") || `<span style="font-size:13px;color:var(--ink3)">暂无</span>`}
            </div>
          </div>
          <div class="glass card" style="margin-top:16px">
            <h3 style="font-size:15px;font-weight:700">配套训练主题</h3>
            <div class="role-list">
              ${relatedThemes.map(t => `<button class="role-item" data-tid="${t.id}" style="background:none;border:none;font:inherit;cursor:pointer;text-align:left;width:100%"><div class="r-num">◔</div><div><b>${esc(t.title)}</b><span style="color:var(--ink2)"> — ${esc(t.focus)}</span></div></button>`).join("")}
            </div>
          </div>
        </div>
      </div>`;
    Pitch.renderStatic($("#fdPitch"), f.players, f.gameType);
    $$("[data-pid]", v).forEach(b => b.addEventListener("click", () => { S.detailPattern = b.dataset.pid; render(); }));
    $$("[data-tid]", v).forEach(b => b.addEventListener("click", () => {
      S.session.theme = b.dataset.tid; S.gameType = f.gameType; go("sessions");
    }));
  }

  /* ---------- 战术生成 ---------- */
  let bag = [];   // 抽签袋：同条件不重复
  function poolFor(st) {
    let list = PATTERNS.filter(p => p.gameType === S.gameType && p.phase === st.phase);
    if (st.formation) {
      const m = list.filter(p => p.formation === st.formation || p.formation === "any");
      if (m.length) list = m;
    }
    if (st.style) {
      const m = list.filter(p => (p.styles||[]).includes(st.style));
      if (m.length) list = m;
    }
    if (st.difficulty) {
      const m = list.filter(p => p.difficulty <= st.difficulty);
      if (m.length) list = m;
    }
    return list;
  }
  function drawFromPool(pool) {
    const key = pool.map(p => p.id).sort().join("|");
    if (!bag.length || bag.bagKey !== key) bag = { bagKey:key, items:shuffle(pool) };
    if (!bag.items.length) bag.items = shuffle(pool);
    return bag.items.pop();
  }

  function renderStudio(v) {
    const st = S.studio;
    const styles = STYLE_LABELS[S.gameType][st.phase];
    v.innerHTML = `
      <div class="page-head">
        <h1>战术生成</h1>
        <p>选择比赛阶段与风格，生成带逐帧动画的套路演示。每个套路附指导要点与体系依据，可直接用于赛前讲解与训练演示。</p>
      </div>
      <div class="glass studio-ctrl">
        <div class="seg lg" role="tablist">
          <button data-gt="futsal" class="${S.gameType==="futsal"?"is-active":""}">五人制</button>
          <button data-gt="field8" class="${S.gameType==="field8"?"is-active":""}">八人制</button>
        </div>
        <div class="seg lg">
          <button data-ph="atk" class="${st.phase==="atk"?"is-active":""}">进攻套路</button>
          <button data-ph="def" class="${st.phase==="def"?"is-active":""}">防守套路</button>
        </div>
        <label class="fld grow"><span>风格</span>
          <select id="stStyle">
            <option value="">不限</option>
            ${Object.entries(styles).map(([k,lab]) => `<option value="${k}" ${st.style===k?"selected":""}>${esc(lab)}</option>`).join("")}
          </select>
        </label>
        <label class="fld grow"><span>阵型</span>
          <select id="stForm">
            <option value="">不限</option>
            ${FORMATIONS.filter(f=>f.gameType===S.gameType).map(f => `<option value="${f.id}" ${st.formation===f.id?"selected":""}>${esc(f.name)}</option>`).join("")}
          </select>
        </label>
        <label class="fld"><span>难度上限</span>
          <select id="stDiff">
            <option value="0" ${st.difficulty===0?"selected":""}>不限</option>
            <option value="1" ${st.difficulty===1?"selected":""}>★ 基础</option>
            <option value="2" ${st.difficulty===2?"selected":""}>★★ 进阶</option>
            <option value="3" ${st.difficulty===3?"selected":""}>★★★ 高阶</option>
          </select>
        </label>
        <button class="btn btn-primary" id="btnGen">✦ 生成套路</button>
      </div>
      <div id="stResult" style="margin-top:18px">
        <div class="glass empty"><div class="e-ic">${ICONS.studio}</div><p>选择好条件后点「生成套路」——将生成带逐帧动画的战术演示、指导要点与体系依据。</p></div>
      </div>`;

    $$(".seg [data-gt]", v).forEach(b => b.addEventListener("click", () => {
      S.gameType = b.dataset.gt; st.style=""; st.formation=""; bag=[]; renderStudio(v);
    }));
    $$("[data-ph]", v).forEach(b => b.addEventListener("click", () => {
      st.phase = b.dataset.ph; st.style=""; bag=[]; renderStudio(v);
    }));
    $("#stStyle", v).addEventListener("change", e => { st.style = e.target.value; bag=[]; });
    $("#stForm", v).addEventListener("change", e => { st.formation = e.target.value; bag=[]; });
    $("#stDiff", v).addEventListener("change", e => { st.difficulty = +e.target.value; bag=[]; });
    $("#btnGen", v).addEventListener("click", () => {
      const pool = poolFor(st);
      if (!pool.length) { toast("该条件下暂无套路，换个组合试试"); return; }
      showPattern($("#stResult", v), drawFromPool(pool), true);
      $("#stResult", v).scrollIntoView({ behavior:"smooth", block:"start" });
    });
  }

  function showPattern(container, p, withSave) {
    S.detailPattern = p.id;
    const st = S.studio;
    const styles = (p.styles||[]).map(s => (STYLE_LABELS[p.gameType]?.[p.phase]||{})[s]).filter(Boolean);
    container.innerHTML = `
      <div class="glass" style="padding:18px 20px">
        <div class="pattern-head">
          <h2>${esc(p.title)}</h2>
          <div class="p-meta">
            <span class="tag" style="background:linear-gradient(135deg,#6d4ff8,#5335ec);color:#fff;box-shadow:0 3px 10px rgba(91,61,245,.3)">${p.phase==="atk"?"进攻":"防守"}</span>
            <span class="tag tag-gray">难度&nbsp;<span style="color:var(--accent);letter-spacing:1.5px">${"★".repeat(p.difficulty)}${"☆".repeat(3-p.difficulty)}</span></span>
            ${styles.map(s => `<span class="tag tag-purple">${esc(s)}</span>`).join("")}
          </div>
        </div>
        <p style="font-size:13.5px;color:var(--ink2)">${esc(p.summary)}</p>
      </div>
      <div class="glass pitch-stage" style="margin-top:14px">
        <div id="ptStage"></div>
        <div class="stage-bar">
          <button class="btn btn-soft btn-sm" id="ptPlay">▶ 播放</button>
          <button class="btn btn-ghost btn-sm" id="ptPrev">‹ 上一步</button>
          <button class="btn btn-ghost btn-sm" id="ptNext">下一步 ›</button>
          <button class="btn btn-ghost btn-sm" id="ptReset">⟲ 初始站位</button>
          <label class="fld" style="flex-direction:row;align-items:center;gap:8px;margin-left:auto"><span style="font-size:12px">速度</span>
            <select id="ptSpeed" style="min-height:0;padding:7px 30px 7px 10px">
              <option value="0.7">慢</option><option value="1" selected>正常</option><option value="1.6">快</option>
            </select>
          </label>
        </div>
        <div class="steps-rail" id="ptSteps" style="margin-top:10px"></div>
        <div class="step-note" id="ptNote"><span style="color:var(--ink2);font-weight:400">点击「播放」或「下一步」开始演示 · 紫点己方 / 灰点对方 / 橙色为球 · 虚线跑位 实线传球</span></div>
        <div class="legend" style="margin-top:8px">
          <span><i style="background:#5b3df5"></i>己方</span>
          <span><i style="background:#8e8e93"></i>对方</span>
          <span><i style="background:#ff9500"></i>球 / 传球</span>
          <span><i style="background:#9d8cff"></i>无球跑动（虚线）</span>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:14px">
        <div class="glass card">
          <h3 style="font-size:15px;font-weight:700">指导要点 <span class="tag tag-gray" style="margin-left:4px">六大核心能力</span></h3>
          <div class="kp-list">${p.keyPoints.map(k => `<div class="kp-item">${esc(k)}</div>`).join("")}</div>
        </div>
        <div>
          <div class="glass card">
            <h3 style="font-size:15px;font-weight:700">分步讲解</h3>
            <div class="role-list">
              ${p.steps.map((s,i) => `<button class="role-item" data-step="${i}" style="background:none;border:none;font:inherit;cursor:pointer;text-align:left;width:100%"><div class="r-num">${i+1}</div><div style="color:var(--ink2)">${esc(s.note)}</div></button>`).join("")}
            </div>
          </div>
          <div class="glass card" style="margin-top:14px">
            <div class="ref-line" style="margin-top:0"><span class="tag tag-purple">依据</span><span>${p.refs.map(refName).join(" · ")}</span></div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px" class="no-print">
        ${withSave ? `<button class="btn btn-ghost btn-sm" id="ptSave">${ICONS.saved} 收藏此套路</button>` : ""}
        ${S.view === "studio" ? `<button class="btn btn-ghost btn-sm" id="ptAnother">✦ 换一个</button>` : ""}
      </div>`;

    let anim = null;
    const stepsRail = $("#ptSteps");
    function paintSteps(cur) {
      stepsRail.innerHTML = `<button class="step-chip ${cur===-1?"is-active":cur>=0?"is-done":""}" data-s="-1" title="初始站位">⌂</button>` +
        p.steps.map((_,i) => `<button class="step-chip ${i===cur?"is-active":i<cur?"is-done":""}" data-s="${i}">${i+1}</button>`).join("");
      $$("[data-s]", stepsRail).forEach(b => b.addEventListener("click", () => anim.show(+b.dataset.s)));
      const note = $("#ptNote");
      note.innerHTML = cur < 0
        ? `<span style="color:var(--ink2);font-weight:400">初始站位 · 点击「播放」开始演示</span>`
        : `<span class="sn-no">${cur+1}</span><span>${esc(p.steps[cur].note)}</span>`;
    }
    anim = Pitch.createAnim($("#ptStage"), p, { onStep: paintSteps });
    anim.show(-1);
    $("#ptPlay").addEventListener("click", () => {
      $("#ptPlay").textContent = anim.playing ? "▶ 播放" : "⏸ 暂停";
      anim.playing ? anim.pause() : anim.play();
    });
    $("#ptPrev").addEventListener("click", () => anim.prev());
    $("#ptNext").addEventListener("click", () => anim.next());
    $("#ptReset").addEventListener("click", () => anim.reset());
    $("#ptSpeed").addEventListener("change", e => anim.setSpeed(1/+e.target.value));
    $$("[data-step]", container).forEach(b => b.addEventListener("click", () => { anim.pause(); anim.show(+b.dataset.step); }));
    const another = $("#ptAnother");
    if (another) another.addEventListener("click", () => {
      const pool = poolFor(st);
      if (pool.length <= 1) { toast("该条件下只有这一个套路"); return; }
      let nextP; do { nextP = drawFromPool(pool); } while (pool.length > 1 && nextP.id === p.id);
      showPattern(container, nextP, true);
    });
    const save = $("#ptSave");
    if (save) save.addEventListener("click", () => {
      if (addSaved({ type:"tactic", refId:p.id, key:"", title:p.title,
        desc:`${p.phase==="atk"?"进攻":"防守"} · ${p.gameType==="futsal"?"五人制":"八人制"} · ${"★".repeat(p.difficulty)}` })) {
        toast("已收藏，可在「我的收藏」查看");
      }
    });
  }

  function renderPatternDetail(v, pid) {
    const p = PATTERNS.find(x => x.id === pid); if (!p) return go("studio");
    $("#topbarTitle").textContent = p.title;
    $("#topbarRight").innerHTML = `<button class="btn btn-ghost btn-sm" id="btnBack">‹ 返回</button>`;
    $("#btnBack").addEventListener("click", () => { S.detailPattern = null; render(); });
    v.innerHTML = `<div id="pdWrap"></div>`;
    showPattern($("#pdWrap", v), p, true);
  }

  /* ---------- 训练课设计 ---------- */
  const AGE_LABELS = { foundation:"U8-U10 基础阶段", youth:"U11-U12", older:"U13+" };
  function blockPlan(duration, age) {
    // 四角模型框架：热身 → 技术 → 技能 → SSG → 收束提问
    const ratios = age === "foundation" ? [.20,.25,.22,.25,.08]
                 : age === "youth"     ? [.18,.25,.27,.24,.06]
                 :                       [.15,.24,.30,.26,.05];
    const raw = ratios.map(r => Math.max(5, Math.round(duration * r / 5) * 5));
    let diff = duration - raw.reduce((a,b)=>a+b,0);
    // 把余数按顺序补到最大块
    const order = raw.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]);
    let oi = 0;
    while (diff !== 0) {
      const i = order[oi % order.length][1];
      const step = diff > 0 ? 5 : -5;
      if (raw[i] + step >= 5) { raw[i] += step; diff -= step; }
      oi++;
      if (oi > 40) break;
    }
    return raw;
  }

  function buildSession(theme, age, duration) {
    const [w,t,k,s,c] = blockPlan(duration, age);
    return { theme, age, duration, blocks:[
      { ...theme.warm,  key:"warm",  name:"① 热身激活", exName:theme.warm.name,  dur:w, bar:"#30a46c" },
      { ...theme.tech,  key:"tech",  name:"② 技术练习", exName:theme.tech.name,  dur:t, bar:"#0a84ff" },
      { ...theme.skill, key:"skill", name:"③ 技能对抗", exName:theme.skill.name, dur:k, bar:"#ff9500" },
      { ...theme.ssg,   key:"ssg",   name:"④ 主题比赛 SSG", exName:theme.ssg.name, dur:s, bar:"#5b3df5" },
      { key:"close",    name:"⑤ 收束与提问", exName:"",
        dur:c, bar:"#8e8e93",
        org:"集合拉伸，围绕今天的主题回顾。",
        questions:theme.ask,
        points:["引导回答，不直接给答案","表扬今天具体做到的行为"] },
    ]};
  }

  function renderSessions(v) {
    const ss = S.session;
    const themes = THEMES.filter(t => t.gameType === S.gameType);
    if (!themes.find(t => t.id === ss.theme)) ss.theme = "";
    v.innerHTML = `
      <div class="page-head">
        <h1>训练课设计</h1>
        <p>按英格兰四角模型（技术 / 战术 / 身体 / 心理社交）组织：热身 → 技术 → 技能对抗 → 主题比赛 → 收束提问。选择条件，一键生成完整教案。</p>
      </div>
      <div class="glass studio-ctrl">
        <div class="seg lg">
          <button data-gt="futsal" class="${S.gameType==="futsal"?"is-active":""}">五人制</button>
          <button data-gt="field8" class="${S.gameType==="field8"?"is-active":""}">八人制</button>
        </div>
        <label class="fld grow"><span>训练主题</span>
          <select id="ssTheme">
            <option value="">随机主题（教练抽签）</option>
            ${themes.map(t => `<option value="${t.id}" ${ss.theme===t.id?"selected":""}>${esc(t.title)}</option>`).join("")}
          </select>
        </label>
        <label class="fld"><span>年龄段</span>
          <select id="ssAge">${Object.entries(AGE_LABELS).map(([k,lab]) => `<option value="${k}" ${ss.age===k?"selected":""}>${esc(lab)}</option>`).join("")}</select>
        </label>
        <label class="fld"><span>时长（分钟）</span>
          <select id="ssDur">${[45,60,75,90].map(d => `<option value="${d}" ${ss.duration===d?"selected":""}>${d}</option>`).join("")}</select>
        </label>
        <button class="btn btn-primary" id="btnGenS">◔ 生成教案</button>
      </div>
      <div id="ssResult" style="margin-top:18px"></div>`;

    $$(".seg [data-gt]", v).forEach(b => b.addEventListener("click", () => {
      S.gameType = b.dataset.gt; ss.theme=""; renderSessions(v);
    }));
    $("#ssTheme", v).addEventListener("change", e => ss.theme = e.target.value);
    $("#ssAge", v).addEventListener("change", e => ss.age = e.target.value);
    $("#ssDur", v).addEventListener("change", e => ss.duration = +e.target.value);
    $("#btnGenS", v).addEventListener("click", () => {
      const theme = ss.theme ? THEMES.find(t => t.id === ss.theme) : pick(themes);
      if (!theme) { toast("该赛制暂无主题"); return; }
      const plan = buildSession(theme, ss.age, ss.duration);
      showSession($("#ssResult", v), plan);
      $("#ssResult", v).scrollIntoView({ behavior:"smooth", block:"start" });
    });
  }

  function showSession(container, plan) {
    S.detailSession = plan;
    const total = plan.blocks.reduce((a,b)=>a+b.dur,0);
    container.innerHTML = `
      <div class="glass card" style="margin-bottom:14px">
        <div class="pattern-head">
          <h2>${esc(plan.theme.title)} <span style="font-size:13px;color:var(--ink3);font-weight:500">· ${esc(AGE_LABELS[plan.age])} · ${total} 分钟</span></h2>
          <div class="p-meta">
            <span class="tag tag-purple">${plan.theme.gameType==="futsal"?"五人制":"八人制"}</span>
            ${plan.theme.refs.map(r => `<span class="tag tag-gray">${esc(refShort(r))}</span>`).join("")}
          </div>
        </div>
        <p style="font-size:13.5px;color:var(--ink2)">主题焦点：${esc(plan.theme.focus)}</p>
      </div>
      ${plan.blocks.map((b,i) => `
        <div class="glass session-block">
          <div class="sb-bar" style="background:${b.bar}"></div>
          <h3>${esc(b.name)}${b.exName ? `<span style="font-weight:500;color:var(--ink2);font-size:13.5px"> · ${esc(b.exName)}</span>` : ""} <span class="sb-dur">${b.dur} 分钟</span></h3>
          <div class="sb-org">${esc(b.org)}</div>
          ${b.questions ? `<div class="sb-sec"><div class="sec-t">主题提问</div><ul>${b.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}
          ${b.prog ? `<div class="sb-sec"><div class="sec-t">进阶（完成后加难度）</div><ul><li>${esc(b.prog)}</li></ul></div>` : ""}
          ${b.reg ? `<div class="sb-sec"><div class="sec-t">降阶（受阻时简化）</div><ul><li>${esc(b.reg)}</li></ul></div>` : ""}
          <div class="sb-sec"><div class="sec-t">指导要点</div><ul>${b.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>
        </div>`).join("")}
      <div style="display:flex;gap:10px;margin-top:4px" class="no-print">
        <button class="btn btn-primary btn-sm" id="ssSave">${ICONS.saved} 收藏此教案</button>
        <button class="btn btn-ghost btn-sm" id="ssPrint">${ICONS.print} 打印</button>
        <button class="btn btn-ghost btn-sm" id="ssAnother">换个主题</button>
      </div>`;
    $("#ssSave", container).addEventListener("click", () => {
      if (addSaved({ type:"session", refId:plan.theme.id, key:`${plan.age}-${plan.duration}`,
        title:`${plan.theme.title}（${AGE_LABELS[plan.age]}·${total}分钟）`,
        desc:`${plan.theme.gameType==="futsal"?"五人制":"八人制"} · ${esc(plan.theme.focus)}` }))
        toast("已收藏，可在「我的收藏」查看");
    });
    $("#ssPrint", container).addEventListener("click", () => window.print());
    $("#ssAnother", container).addEventListener("click", () => {
      const themes = THEMES.filter(t => t.gameType === plan.theme.gameType && t.id !== plan.theme.id);
      const theme = pick(themes);
      showSession(container, buildSession(theme, plan.age, plan.duration));
    });
  }

  function renderSessionDetail(v, plan) {
    const theme = THEMES.find(t => t.id === (plan.theme && plan.theme.id));
    $("#topbarTitle").textContent = theme ? theme.title : "训练课";
    $("#topbarRight").innerHTML = `<button class="btn btn-ghost btn-sm" id="btnBack">‹ 返回</button>`;
    $("#btnBack").addEventListener("click", () => { S.detailSession = null; render(); });
    v.innerHTML = `<div id="sdWrap"></div>`;
    showSession($("#sdWrap", v), plan);
  }

  /* ---------- 收藏 ---------- */
  function renderSaved(v) {
    const list = loadSaved();
    const tabs = [ ["tactic","战术套路"],["session","训练教案"] ];
    const shown = list.filter(x => x.type === S.savedTab);
    v.innerHTML = `
      <div class="page-head"><h1>我的收藏</h1><p>收藏保存在本机浏览器中。战术套路可一键重放动画，教案可一键重新生成打印。</p></div>
      <div class="seg saved-tabs">${tabs.map(([k,lab]) => `<button data-tab="${k}" class="${S.savedTab===k?"is-active":""}">${lab} ${list.filter(x=>x.type===k).length}</button>`).join("")}</div>
      <div class="grid" style="gap:10px">
        ${shown.length ? shown.map(x => `
          <div class="glass saved-item">
            <div>
              <div class="s-t">${esc(x.title)}</div>
              <div class="s-d">${esc(x.desc || "")} · ${new Date(x.ts).toLocaleDateString("zh-CN")}</div>
            </div>
            <div class="s-act">
              <button class="btn btn-soft btn-sm" data-open="${x.refId}" data-skey="${esc(x.key||"")}">打开</button>
              <button class="btn btn-ghost btn-sm" data-del data-type="${x.type}" data-rid="${x.refId}" data-k="${esc(x.key||"")}">删除</button>
            </div>
          </div>`).join("")
        : `<div class="glass empty"><div class="e-ic">${ICONS.saved}</div><p>还没有收藏。在战术生成或训练课里点「收藏」即可保存到这里。</p></div>`}
      </div>`;
    $$(".seg [data-tab]", v).forEach(b => b.addEventListener("click", () => { S.savedTab = b.dataset.tab; renderSaved(v); }));
    $$("[data-open]", v).forEach(b => b.addEventListener("click", () => {
      if (b.dataset.open.startsWith("t-")) {
        const [age, dur] = (b.dataset.skey || "").split("-");
        const theme = THEMES.find(t => t.id === b.dataset.open);
        if (!theme) { toast("内容已更新，请重新生成"); delSaved("session", b.dataset.open, b.dataset.skey || ""); renderSaved(v); return; }
        const plan = buildSession(theme, age || "foundation", +dur || 60);
        S.detailSession = plan; render();
      } else {
        const p = PATTERNS.find(x => x.id === b.dataset.open);
        if (!p) { toast("内容已更新，请重新生成"); delSaved("tactic", b.dataset.open, ""); renderSaved(v); return; }
        S.detailPattern = p.id; render();
      }
    }));
    $$("[data-del]", v).forEach(b => b.addEventListener("click", () => {
      delSaved(b.dataset.type, b.dataset.rid, b.dataset.k || "");
      renderSaved(v); toast("已删除");
    }));
  }

  /* ---------- 方法与依据 ---------- */
  function renderAbout(v) {
    v.innerHTML = `
      <div class="page-head">
        <h1>方法与依据</h1>
        <p>本应用的所有战术与训练内容都不是拍脑袋写的：每个套路、每节课都挂在这几个权威体系上。教练可以按图索骥，去原始出处深挖。</p>
      </div>
      <div class="grid grid-2">
        ${REFS.map(r => `
          <div class="glass card ref-card lift">
            <h3><span class="tag tag-purple">${esc(r.tag)}</span>${esc(r.name)}</h3>
            <div class="r-org">${esc(r.org)}</div>
            <p>${esc(r.note)}</p>
            <a href="${r.url}" target="_blank" rel="noopener">访问出处 ↗</a>
          </div>`).join("")}
      </div>
      <div class="glass card" style="margin-top:16px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:8px">内容对照表：体系 → 本应用的位置</h3>
        <div class="map-row"><div class="m-src">英格兰 DNA · 怎么踢</div><div class="m-use">进攻套路的「指导要点」均落在控球、创造、勇敢三条原则上</div></div>
        <div class="map-row"><div class="m-src">六大核心能力</div><div class="m-use">每个战术步骤的要点都标注到 Scanning / Timing / Movement / Positioning / Deception / Techniques</div></div>
        <div class="map-row"><div class="m-src">四角模型</div><div class="m-use">训练课的五段结构（热身→技术→技能→SSG→提问）保证每项练习至少覆盖两角</div></div>
        <div class="map-row"><div class="m-src">FIFA 五人制手册</div><div class="m-use">五人制全部阵型（4-0/3-1/2-2/1-2-1）与轮转、支点、压迫体系</div></div>
        <div class="map-row"><div class="m-src">西班牙 Fútbol 8</div><div class="m-use">八人制阵型与「构建-渗透-终结」教学顺序</div></div>
        <div class="map-row"><div class="m-src">LaLiga 位置足球</div><div class="m-use">Rondo 抢圈、第三人跑动、穿线传球等技术练习模块</div></div>
        <div class="map-row"><div class="m-src">FIFA 五人制规则</div><div class="m-use">4 秒、门将再触球限制、累积犯规等规则要点已核对进套路讲解</div></div>
      </div>`;
  }

  /* ---------- 启动 ---------- */
  function init() {
    $$(".nav-item").forEach(b => {
      const ic = b.querySelector(".nav-ic");
      if (ic && ICONS[b.dataset.view]) ic.innerHTML = ICONS[b.dataset.view];
    });
    $$(".nav-item").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
    $("#menuBtn").addEventListener("click", () => {
      $("#drawer").classList.toggle("open");
      $("#drawerMask").classList.toggle("show");
    });
    $("#drawerMask").addEventListener("click", () => {
      $("#drawer").classList.remove("open");
      $("#drawerMask").classList.remove("show");
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        $("#drawer").classList.remove("open"); $("#drawerMask").classList.remove("show");
        const mw = $("#modalWrap"); if (!mw.hidden) { mw.hidden = true; mw.classList.remove("show"); }
      }
    });
    render();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
