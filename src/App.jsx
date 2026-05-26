import { useState, useEffect, useCallback, useRef } from "react";

// ── Google OAuth & Sheets 設定 ──────────────────────────────
// ★ここにGoogle Cloud ConsoleのOAuth 2.0クライアントIDを貼り付けてください
const GOOGLE_CLIENT_ID = "735108660284-93sr2kah8knvj98i6p9cihl9537hb7hu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const STORAGE_KEY = "scoutflow_v2";

// ── Claude API ────────────────────────────────────────────────
const callClaude = async (system, user) => {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
};

// ── Local Storage ─────────────────────────────────────────────
const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
};
const saveLocal = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));

// ── Google Sheets helpers ─────────────────────────────────────
const sheetsGet = async (token, spreadsheetId, range) => {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.json();
};
const sheetsUpdate = async (token, spreadsheetId, range, values) => {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    }
  );
  return r.json();
};
const sheetsAppend = async (token, spreadsheetId, range, values) => {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    }
  );
  return r.json();
};

const TABS = ["⚙️ 設定", "📝 メール生成", "📊 実績管理", "🔍 分析・リライト"];

export default function App() {
  const [tab, setTab] = useState(0);
  const [token, setToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [config, setConfig] = useState(() => loadLocal().config || {
    spreadsheetId: "",
    jobSheet: "案件リスト",
    jobUrlCol: "B",
    jobPointsCol: "C",
    jobMailCol: "D",
    jobStartRow: 2,
    resultSheet: "実績データ",
  });
  const [toast, setToast] = useState(null);
  const tokenClientRef = useRef(null);

  // Google Identity Services
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
          if (resp.error) { showToast("ログインに失敗しました", "error"); return; }
          setToken(resp.access_token);
          // ユーザー情報取得
          const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          }).then((r) => r.json());
          setUserInfo(ui);
          showToast(`${ui.name} でログインしました`);
        },
      });
    };
    document.head.appendChild(script);
  }, []);

  const login = () => tokenClientRef.current?.requestAccessToken();
  const logout = () => { setToken(null); setUserInfo(null); };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveConfig = (cfg) => {
    setConfig(cfg);
    const local = loadLocal();
    saveLocal({ ...local, config: cfg });
    showToast("設定を保存しました");
  };

  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoRow}>
            <div style={S.logo}>
              <span style={S.logoMark}>SF</span>
              <div>
                <div style={S.logoText}>ScoutFlow</div>
                <div style={S.logoSub}>人材紹介 スカウトメール管理</div>
              </div>
            </div>
            <div style={S.authArea}>
              {token ? (
                <div style={S.userRow}>
                  {userInfo?.picture && <img src={userInfo.picture} style={S.avatar} alt="" />}
                  <span style={S.userName}>{userInfo?.name}</span>
                  <button style={S.btnLogout} onClick={logout}>ログアウト</button>
                </div>
              ) : (
                <button style={S.btnLogin} onClick={login}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Googleでログイン
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          {TABS.map((t, i) => (
            <button key={i} style={{ ...S.navBtn, ...(tab === i ? S.navActive : {}) }} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN */}
      <main style={S.main}>
        {!token && tab !== 0 && (
          <div style={S.loginBanner}>
            <span>⚠️ Google スプレッドシートと連携するには</span>
            <button style={S.btnLogin} onClick={login}>Googleでログイン</button>
          </div>
        )}
        {tab === 0 && <SettingsTab config={config} saveConfig={saveConfig} token={token} showToast={showToast} />}
        {tab === 1 && <MailGenTab config={config} token={token} showToast={showToast} />}
        {tab === 2 && <ResultsTab config={config} token={token} showToast={showToast} />}
        {tab === 3 && <AnalysisTab config={config} token={token} showToast={showToast} />}
      </main>

      {toast && (
        <div style={{ ...S.toast, background: toast.type === "error" ? "#dc2626" : "#059669" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// TAB 0: 設定
// ════════════════════════════════════════════════
function SettingsTab({ config, saveConfig, token, showToast }) {
  const [form, setForm] = useState(config);
  const [testing, setTesting] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const testConnection = async () => {
    if (!token) return showToast("先にGoogleログインしてください", "error");
    if (!form.spreadsheetId) return showToast("スプレッドシートIDを入力してください", "error");
    setTesting(true);
    try {
      const r = await sheetsGet(token, form.spreadsheetId, `${form.jobSheet}!A1`);
      if (r.error) throw new Error(r.error.message);
      showToast("接続成功！スプレッドシートにアクセスできました");
    } catch (e) {
      showToast(`接続失敗: ${e.message}`, "error");
    }
    setTesting(false);
  };

  return (
    <div style={S.tabWrap}>
      <h2 style={S.h2}>スプレッドシート設定</h2>

      {/* セットアップガイド */}
      <div style={S.guide}>
        <h3 style={S.guideTitle}>🚀 初回セットアップ手順</h3>
        <div style={S.steps}>
          {[
            { n: "1", title: "Google Cloud Console でプロジェクト作成", body: "console.cloud.google.com を開き「新しいプロジェクト」を作成" },
            { n: "2", title: "Google Sheets API を有効化", body: "「APIとサービス」→「ライブラリ」→「Google Sheets API」を検索して有効化" },
            { n: "3", title: "OAuth 同意画面を設定", body: "「APIとサービス」→「OAuth同意画面」→ 外部・テスト用で作成。スコープに spreadsheets を追加" },
            { n: "4", title: "OAuth 2.0 クライアントIDを作成", body: "「認証情報」→「認証情報を作成」→「OAuthクライアントID」→ アプリケーションの種類:「ウェブアプリケーション」→ 承認済みJavaScriptオリジンにこのページのURLを追加" },
            { n: "5", title: "クライアントIDをアプリに設定", body: "コード冒頭の GOOGLE_CLIENT_ID = \"YOUR_CLIENT_ID_HERE...\" の部分を取得したIDに書き換えて保存" },
            { n: "6", title: "スプレッドシートIDを入力", body: "スプレッドシートのURL: docs.google.com/spreadsheets/d/【ここがID】/edit" },
          ].map((s) => (
            <div key={s.n} style={S.step}>
              <div style={S.stepNum}>{s.n}</div>
              <div>
                <div style={S.stepTitle}>{s.title}</div>
                <div style={S.stepBody}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>スプレッドシート設定</h3>
        <div style={S.grid2}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>スプレッドシートID *</label>
            <input style={S.input} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" value={form.spreadsheetId} onChange={f("spreadsheetId")} />
            <div style={S.hint}>スプレッドシートURL の /d/ と /edit の間の文字列</div>
          </div>
          <div>
            <label style={S.label}>案件シート名</label>
            <input style={S.input} placeholder="案件リスト" value={form.jobSheet} onChange={f("jobSheet")} />
          </div>
          <div>
            <label style={S.label}>データ開始行</label>
            <input style={S.input} type="number" min="1" value={form.jobStartRow} onChange={f("jobStartRow")} />
            <div style={S.hint}>1行目がヘッダーなら「2」</div>
          </div>
          <div>
            <label style={S.label}>求人URL の列</label>
            <input style={S.input} placeholder="B" value={form.jobUrlCol} onChange={f("jobUrlCol")} />
          </div>
          <div>
            <label style={S.label}>推しポイント の列</label>
            <input style={S.input} placeholder="C" value={form.jobPointsCol} onChange={f("jobPointsCol")} />
          </div>
          <div>
            <label style={S.label}>メール出力先の列</label>
            <input style={S.input} placeholder="D" value={form.jobMailCol} onChange={f("jobMailCol")} />
          </div>
          <div>
            <label style={S.label}>実績シート名</label>
            <input style={S.input} placeholder="実績データ" value={form.resultSheet} onChange={f("resultSheet")} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={{ ...S.btnGhost, opacity: testing ? 0.6 : 1 }} onClick={testConnection} disabled={testing}>
            {testing ? "確認中..." : "🔗 接続テスト"}
          </button>
          <button style={S.btnPrimary} onClick={() => saveConfig(form)}>💾 設定を保存</button>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>📋 スプレッドシートのテンプレート構成</h3>
        <p style={S.hint}>以下の構成でスプレッドシートを作成してください。</p>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>列</th><th style={S.th}>内容</th><th style={S.th}>例</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["A", "案件名", "株式会社〇〇 / バックエンドエンジニア"],
                ["B", "求人原稿URL", "https://job.example.com/12345"],
                ["C", "推しポイント", "年収800万〜、フルリモート、急成長SaaS"],
                ["D", "生成メール（出力先）", "← AIが自動入力"],
              ].map(([col, label, ex]) => (
                <tr key={col} style={S.tr}>
                  <td style={{ ...S.td, fontWeight: 700, color: "#38bdf8" }}>{col}</td>
                  <td style={S.td}>{label}</td>
                  <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// TAB 1: メール生成
// ════════════════════════════════════════════════
function MailGenTab({ config, token, showToast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genIdx, setGenIdx] = useState(null);
  const [genAll, setGenAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const colIdx = (col) => col.toUpperCase().charCodeAt(0) - 65; // A→0, B→1...

  const loadFromSheets = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    if (!config.spreadsheetId) return showToast("設定タブでスプレッドシートIDを入力してください", "error");
    setLoading(true);
    try {
      const range = `${config.jobSheet}!A${config.jobStartRow}:Z200`;
      const res = await sheetsGet(token, config.spreadsheetId, range);
      if (res.error) throw new Error(res.error.message);
      const rows = res.values || [];
      const urlIdx = colIdx(config.jobUrlCol);
      const ptsIdx = colIdx(config.jobPointsCol);
      const mailIdx = colIdx(config.jobMailCol);
      const nameIdx = 0;
      const parsed = rows
        .filter((r) => r[urlIdx] || r[ptsIdx])
        .map((r, i) => ({
          rowNum: Number(config.jobStartRow) + i,
          name: r[nameIdx] || `案件 ${i + 1}`,
          url: r[urlIdx] || "",
          points: r[ptsIdx] || "",
          mail: r[mailIdx] || "",
          loading: false,
        }));
      setJobs(parsed);
      showToast(`${parsed.length}件の案件を読み込みました`);
    } catch (e) {
      showToast(`読み込み失敗: ${e.message}`, "error");
    }
    setLoading(false);
  };

  const generateOne = async (idx) => {
    const job = jobs[idx];
    setGenIdx(idx);
    setJobs((j) => j.map((x, i) => i === idx ? { ...x, loading: true } : x));
    try {
      let info = job.points;
      if (job.url) {
        try {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(job.url)}`);
          const j = await r.json();
          const text = j.contents?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 2000) || "";
          info = `【求人ページ】\n${text}\n\n【推しポイント】\n${job.points}`;
        } catch { info = `【推しポイント】\n${job.points}`; }
      }
      const mail = await callClaude(
        `あなたは人材紹介会社のエースコンサルタントです。
求職者へのスカウトメールを以下の条件で書いてください。
- トーン：熱量高め・情熱的
- 含める要素：推しポイントの強調、応募メリット・待遇
- 件名を「件名：〇〇」の形式で冒頭に記載
- 本文300〜500文字
- 自然な日本語`,
        `以下の求人情報をもとにスカウトメールを作成してください。\n\n${info}`
      );
      setJobs((j) => j.map((x, i) => i === idx ? { ...x, mail, loading: false } : x));
    } catch {
      showToast("生成に失敗しました", "error");
      setJobs((j) => j.map((x, i) => i === idx ? { ...x, loading: false } : x));
    }
    setGenIdx(null);
  };

  const generateAll = async () => {
    setGenAll(true);
    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].url || jobs[i].points) await generateOne(i);
    }
    setGenAll(false);
  };

  const saveToSheets = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    const toSave = jobs.filter((j) => j.mail);
    if (!toSave.length) return showToast("保存するメールがありません", "error");
    setSaving(true);
    try {
      for (const job of toSave) {
        const cellRange = `${config.jobSheet}!${config.jobMailCol}${job.rowNum}`;
        await sheetsUpdate(token, config.spreadsheetId, cellRange, [[job.mail]]);
      }
      showToast(`${toSave.length}件をスプレッドシートに保存しました`);
    } catch (e) {
      showToast(`保存失敗: ${e.message}`, "error");
    }
    setSaving(false);
  };

  const updateMail = (idx, val) =>
    setJobs((j) => j.map((x, i) => i === idx ? { ...x, mail: val } : x));

  return (
    <div style={S.tabWrap}>
      <div style={S.sectionHead}>
        <h2 style={S.h2}>スカウトメール一括生成</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...S.btnGhost, opacity: loading ? 0.6 : 1 }} onClick={loadFromSheets} disabled={loading}>
            {loading ? "読込中..." : "📥 スプシから読み込む"}
          </button>
          {jobs.length > 0 && (
            <>
              <button style={{ ...S.btnPrimary, opacity: genAll ? 0.6 : 1 }} onClick={generateAll} disabled={genAll}>
                {genAll ? "生成中..." : "⚡ 全件生成"}
              </button>
              <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={saveToSheets} disabled={saving}>
                {saving ? "保存中..." : "📤 スプシに保存"}
              </button>
            </>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>📋</div>
          <div style={S.emptyText}>「スプシから読み込む」を押して案件を取得してください</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {jobs.map((job, idx) => (
            <div key={idx} style={S.card}>
              <div style={S.cardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={S.rowBadge}>行{job.rowNum}</span>
                  <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{job.name}</span>
                </div>
                <button
                  style={{ ...S.btnPrimary, opacity: job.loading ? 0.6 : 1, fontSize: 13 }}
                  onClick={() => generateOne(idx)}
                  disabled={job.loading || genAll}
                >
                  {job.loading ? "生成中..." : "✨ 生成"}
                </button>
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>求人URL</label>
                  <div style={S.infoBox}>{job.url || "—"}</div>
                </div>
                <div>
                  <label style={S.label}>推しポイント</label>
                  <div style={S.infoBox}>{job.points || "—"}</div>
                </div>
              </div>
              {job.mail && (
                <div style={{ marginTop: 12 }}>
                  <label style={S.label}>生成メール（編集可）</label>
                  <textarea
                    style={{ ...S.input, minHeight: 150, fontFamily: "inherit", lineHeight: 1.7 }}
                    value={job.mail}
                    onChange={(e) => updateMail(idx, e.target.value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// TAB 2: 実績管理
// ════════════════════════════════════════════════
function ResultsTab({ config, token, showToast }) {
  const [results, setResults] = useState([]);
  const [form, setForm] = useState({
    jobName: "", mailVersion: "1", sentCount: "", appliedCount: "",
    avgAge: "", genderRatio: "", experienceYears: "", note: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const loadResults = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    setLoading(true);
    try {
      const res = await sheetsGet(token, config.spreadsheetId, `${config.resultSheet}!A2:J200`);
      if (res.error) throw new Error(res.error.message);
      const rows = (res.values || []).map((r) => ({
        jobName: r[0] || "", mailVersion: r[1] || "1",
        sentCount: Number(r[2]) || 0, appliedCount: Number(r[3]) || 0,
        avgAge: r[4] || "", genderRatio: r[5] || "",
        experienceYears: r[6] || "", note: r[7] || "",
        date: r[8] || "",
      }));
      setResults(rows);
      showToast(`${rows.length}件の実績を読み込みました`);
    } catch (e) {
      showToast(`読み込み失敗: ${e.message}`, "error");
    }
    setLoading(false);
  };

  const addResult = async () => {
    if (!form.jobName || !form.sentCount) return showToast("案件名と送信数は必須です", "error");
    if (!token) return showToast("Googleログインしてください", "error");
    setSaving(true);
    const row = [
      form.jobName, form.mailVersion, form.sentCount, form.appliedCount,
      form.avgAge, form.genderRatio, form.experienceYears, form.note,
      new Date().toLocaleDateString("ja-JP"),
    ];
    try {
      await sheetsAppend(token, config.spreadsheetId, `${config.resultSheet}!A:I`, [row]);
      setResults((r) => [...r, {
        ...form,
        sentCount: Number(form.sentCount),
        appliedCount: Number(form.appliedCount) || 0,
        date: new Date().toLocaleDateString("ja-JP"),
      }]);
      setForm({ jobName: "", mailVersion: "1", sentCount: "", appliedCount: "", avgAge: "", genderRatio: "", experienceYears: "", note: "" });
      showToast("実績をスプレッドシートに記録しました");
    } catch (e) {
      showToast(`保存失敗: ${e.message}`, "error");
    }
    setSaving(false);
  };

  const rate = (r) => r.sentCount > 0 ? Math.round(r.appliedCount / r.sentCount * 1000) / 10 : 0;

  return (
    <div style={S.tabWrap}>
      <div style={S.sectionHead}>
        <h2 style={S.h2}>実績データ管理</h2>
        <button style={{ ...S.btnGhost, opacity: loading ? 0.6 : 1 }} onClick={loadResults} disabled={loading}>
          {loading ? "読込中..." : "📥 スプシから読み込む"}
        </button>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>＋ 実績を記録</h3>
        <div style={S.grid2}>
          {[
            ["jobName", "案件名 *", "text", "株式会社〇〇 / エンジニア"],
            ["mailVersion", "メールバージョン", "number", "1"],
            ["sentCount", "送信数 *", "number", "100"],
            ["appliedCount", "応募数", "number", "12"],
            ["avgAge", "応募者平均年齢", "number", "32"],
            ["genderRatio", "性別比率", "text", "男7:女3"],
            ["experienceYears", "平均経験年数", "number", "5"],
            ["note", "メモ", "text", "自由記述"],
          ].map(([key, lbl, type, ph]) => (
            <div key={key}>
              <label style={S.label}>{lbl}</label>
              <input style={S.input} type={type} placeholder={ph} value={form[key]} onChange={f(key)} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={addResult} disabled={saving}>
            {saving ? "保存中..." : "📤 記録してスプシに保存"}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["案件名", "Ver", "送信", "応募", "応募率", "平均年齢", "経験", "性別", "日付"].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{r.jobName}</td>
                  <td style={S.td}>v{r.mailVersion}</td>
                  <td style={S.td}>{r.sentCount}</td>
                  <td style={S.td}>{r.appliedCount}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: rate(r) >= 10 ? "#059669" : rate(r) >= 5 ? "#d97706" : "#dc2626" }}>
                      {rate(r)}%
                    </span>
                  </td>
                  <td style={S.td}>{r.avgAge ? `${r.avgAge}歳` : "—"}</td>
                  <td style={S.td}>{r.experienceYears ? `${r.experienceYears}年` : "—"}</td>
                  <td style={S.td}>{r.genderRatio || "—"}</td>
                  <td style={S.td}>{r.date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// TAB 3: 分析・リライト
// ════════════════════════════════════════════════
function AnalysisTab({ config, token, showToast }) {
  const [results, setResults] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [target, setTarget] = useState("");
  const [newMail, setNewMail] = useState("");
  const [busy, setBusy] = useState({ analysis: false, rewrite: false, target: false });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    try {
      const [rRes, jRes] = await Promise.all([
        sheetsGet(token, config.spreadsheetId, `${config.resultSheet}!A2:J200`),
        sheetsGet(token, config.spreadsheetId, `${config.jobSheet}!A${config.jobStartRow}:Z200`),
      ]);
      const rows = (rRes.values || []).map((r) => ({
        jobName: r[0], mailVersion: r[1], sentCount: Number(r[2]) || 0,
        appliedCount: Number(r[3]) || 0, avgAge: r[4], genderRatio: r[5],
        experienceYears: r[6], note: r[7],
      }));
      setResults(rows);
      const urlIdx = config.jobUrlCol.toUpperCase().charCodeAt(0) - 65;
      const ptsIdx = config.jobPointsCol.toUpperCase().charCodeAt(0) - 65;
      const mailIdx = config.jobMailCol.toUpperCase().charCodeAt(0) - 65;
      const jRows = (jRes.values || []).filter((r) => r[0]).map((r, i) => ({
        rowNum: Number(config.jobStartRow) + i,
        name: r[0], url: r[urlIdx] || "", points: r[ptsIdx] || "", mail: r[mailIdx] || "",
      }));
      setJobs(jRows);
      showToast("データを読み込みました");
    } catch (e) {
      showToast(`読み込み失敗: ${e.message}`, "error");
    }
  };

  const filtered = selectedJob ? results.filter((r) => r.jobName === selectedJob) : results;
  const totalSent = filtered.reduce((s, r) => s + r.sentCount, 0);
  const totalApplied = filtered.reduce((s, r) => s + r.appliedCount, 0);
  const avgRate = totalSent > 0 ? Math.round(totalApplied / totalSent * 1000) / 10 : 0;
  const agesWithData = filtered.filter((r) => r.avgAge);
  const avgAge = agesWithData.length > 0
    ? Math.round(agesWithData.reduce((s, r) => s + Number(r.avgAge), 0) / agesWithData.length)
    : null;
  const jobObj = jobs.find((j) => j.name === selectedJob);

  const ctx = () => `
【対象案件】${selectedJob || "全案件"}
【案件の推しポイント】${jobObj?.points || "—"}
【現在のメール文】${jobObj?.mail || "—"}
【実績サマリ】送信${totalSent}件 / 応募${totalApplied}件 / 応募率${avgRate}%
【平均年齢】${avgAge ? avgAge + "歳" : "データなし"}
【詳細実績】${JSON.stringify(filtered.slice(-10))}
`;

  const run = async (type) => {
    setBusy((b) => ({ ...b, [type]: true }));
    const prompts = {
      analysis: ["あなたは採用マーケティングアナリストです。", `実績データを分析し、傾向・課題・改善ポイントを3〜5点で箇条書きにしてください。\n\n${ctx()}`],
      rewrite: ["あなたは人材紹介のトップコンサルタントです。", `実績データを踏まえ、応募率を上げるためスカウトメールをリライトしてください。件名も含めて。\n\n${ctx()}`],
      target: ["あなたは採用戦略コンサルタントです。", `応募データから次回スカウト送信に最適な求職者の属性（年齢・経験・職種・性別等）を具体的に提案してください。\n\n${ctx()}`],
    };
    const res = await callClaude(...prompts[type]);
    if (type === "analysis") setAnalysis(res);
    if (type === "rewrite") { setRewrite(res); setNewMail(res); }
    if (type === "target") setTarget(res);
    setBusy((b) => ({ ...b, [type]: false }));
  };

  const saveRewrite = async () => {
    if (!token || !jobObj || !newMail) return;
    setSaving(true);
    try {
      const cellRange = `${config.jobSheet}!${config.jobMailCol}${jobObj.rowNum}`;
      await sheetsUpdate(token, config.spreadsheetId, cellRange, [[newMail]]);
      showToast("リライト版をスプレッドシートに保存しました");
    } catch (e) {
      showToast(`保存失敗: ${e.message}`, "error");
    }
    setSaving(false);
  };

  return (
    <div style={S.tabWrap}>
      <div style={S.sectionHead}>
        <h2 style={S.h2}>分析・リライト提案</h2>
        <button style={S.btnGhost} onClick={loadData}>📥 データ読み込み</button>
      </div>

      <div style={S.card}>
        <label style={S.label}>分析する案件（空白 = 全案件）</label>
        <select style={{ ...S.input, maxWidth: 420 }} value={selectedJob} onChange={(e) => { setSelectedJob(e.target.value); setAnalysis(""); setRewrite(""); setTarget(""); }}>
          <option value="">全案件まとめて分析</option>
          {jobs.map((j) => <option key={j.rowNum} value={j.name}>{j.name}</option>)}
        </select>

        <div style={S.statsRow}>
          {[
            { l: "送信数", v: `${totalSent}件` },
            { l: "応募数", v: `${totalApplied}件` },
            { l: "応募率", v: `${avgRate}%`, c: avgRate >= 10 ? "#10b981" : avgRate >= 5 ? "#f59e0b" : "#ef4444" },
            { l: "平均年齢", v: avgAge ? `${avgAge}歳` : "—" },
          ].map((s) => (
            <div key={s.l} style={S.statBox}>
              <div style={S.statL}>{s.l}</div>
              <div style={{ ...S.statV, color: s.c || "#f1f5f9" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[
            { key: "analysis", label: "🔍 データ分析" },
            { key: "rewrite", label: "✍️ リライト提案", disabled: !selectedJob },
            { key: "target", label: "🎯 ターゲット提案" },
          ].map((btn) => (
            <button
              key={btn.key}
              style={{ ...S.btnPrimary, opacity: busy[btn.key] || btn.disabled ? 0.5 : 1 }}
              onClick={() => run(btn.key)}
              disabled={busy[btn.key] || btn.disabled}
            >
              {busy[btn.key] ? "生成中..." : btn.label}
            </button>
          ))}
        </div>
        {!selectedJob && <div style={{ ...S.hint, marginTop: 8 }}>※ リライト提案は案件を選択してから実行してください</div>}
      </div>

      {analysis && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>📊 分析結果</h3>
          <pre style={S.pre}>{analysis}</pre>
        </div>
      )}

      {rewrite && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>✍️ リライト提案</h3>
          <pre style={S.pre}>{rewrite}</pre>
          <label style={{ ...S.label, marginTop: 12 }}>採用する文面（編集可）</label>
          <textarea style={{ ...S.input, minHeight: 160, fontFamily: "inherit", lineHeight: 1.7 }} value={newMail} onChange={(e) => setNewMail(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={saveRewrite} disabled={saving}>
              {saving ? "保存中..." : "📤 スプシに上書き保存"}
            </button>
          </div>
        </div>
      )}

      {target && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>🎯 次回ターゲット提案</h3>
          <pre style={S.pre}>{target}</pre>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════
const S = {
  root: { minHeight: "100vh", background: "#080f1a", color: "#e2e8f0", fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" },
  header: { background: "#0d1b2e", borderBottom: "1px solid #1e3a5f", padding: "0 24px" },
  headerInner: { maxWidth: 1140, margin: "0 auto" },
  logoRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" },
  logo: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: { width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#fff", letterSpacing: 1, flexShrink: 0 },
  logoText: { fontSize: 20, fontWeight: 800, color: "#f0f9ff", letterSpacing: "-0.5px" },
  logoSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  authArea: {},
  userRow: { display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: "50%", border: "2px solid #1e3a5f" },
  userName: { fontSize: 13, color: "#94a3b8" },
  btnLogin: { display: "flex", alignItems: "center", background: "#fff", color: "#374151", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  btnLogout: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  nav: { background: "#0d1b2e", borderBottom: "1px solid #1e3a5f" },
  navInner: { maxWidth: 1140, margin: "0 auto", display: "flex", padding: "0 24px" },
  navBtn: { background: "none", border: "none", color: "#64748b", padding: "13px 18px", cursor: "pointer", fontSize: 13, fontWeight: 500, borderBottom: "2px solid transparent", transition: "all .2s", whiteSpace: "nowrap" },
  navActive: { color: "#38bdf8", borderBottomColor: "#38bdf8" },
  main: { maxWidth: 1140, margin: "0 auto", padding: "28px 24px" },
  loginBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1c1505", border: "1px solid #92400e", borderRadius: 10, padding: "12px 18px", marginBottom: 20, color: "#fbbf24", fontSize: 14, gap: 12 },
  tabWrap: { display: "flex", flexDirection: "column", gap: 18 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
  h2: { fontSize: 20, fontWeight: 800, margin: 0, color: "#f0f9ff" },
  card: { background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#e2e8f0" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600, letterSpacing: "0.03em" },
  input: { width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical" },
  hint: { fontSize: 11, color: "#475569", marginTop: 4 },
  infoBox: { background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#94a3b8", minHeight: 36 },
  rowBadge: { background: "#1e3a5f", color: "#38bdf8", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 },
  btnPrimary: { background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
  btnSuccess: { background: "linear-gradient(135deg, #059669, #0d9488)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
  btnGhost: { background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" },
  empty: { textAlign: "center", padding: "60px 20px", color: "#475569" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#0d1b2e", borderRadius: 10, overflow: "hidden" },
  th: { background: "#060e1a", padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, whiteSpace: "nowrap", fontSize: 12 },
  td: { padding: "10px 14px", borderBottom: "1px solid #1e3a5f", color: "#cbd5e1" },
  tr: {},
  badge: { borderRadius: 20, padding: "2px 8px", color: "#fff", fontSize: 12, fontWeight: 700 },
  statsRow: { display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" },
  statBox: { background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 20px", textAlign: "center", minWidth: 90 },
  statL: { fontSize: 11, color: "#475569", marginBottom: 4 },
  statV: { fontSize: 22, fontWeight: 800 },
  pre: { background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "#cbd5e1", margin: 0 },
  guide: { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20 },
  guideTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#38bdf8" },
  steps: { display: "flex", flexDirection: "column", gap: 14 },
  step: { display: "flex", gap: 14, alignItems: "flex-start" },
  stepNum: { width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 },
  stepTitle: { fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 3 },
  stepBody: { fontSize: 13, color: "#64748b", lineHeight: 1.6 },
  toast: { position: "fixed", bottom: 24, right: 24, color: "#fff", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" },
};
