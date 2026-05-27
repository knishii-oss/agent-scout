import { useState, useEffect, useCallback, useRef } from "react";

const GOOGLE_CLIENT_ID = "735108660284-93sr2kah8knvj98i6p9cihl9537hb7hu.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const STORAGE_KEY = "scoutflow_v2";

const callClaude = async (system, user) => {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
};

const loadLocal = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
const saveLocal = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));

const sheetsGet = async (token, id, range) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
};
const sheetsUpdate = async (token, id, range, values) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  return r.json();
};
const sheetsAppend = async (token, id, range, values) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  return r.json();
};

const TABS = ["⚙️ 設定", "📝 メール生成", "📊 実績管理", "🔍 分析・リライト"];

export default function App() {
  const [tab, setTab] = useState(0);
  const [token, setToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [config, setConfig] = useState(() => loadLocal().config || {
    spreadsheetId: "", jobSheet: "AG案件", jobUrlCol: "E", jobPointsCol: "Q",
    jobMailCol: "D", jobStartRow: 2, resultSheet: "実績データ", jobCheckCol: "M",
    jobAgeCol: "N", jobAreaCol: "O", jobLicenseCol: "P",
    mailSheet: "スカウト_文面履歴", mailCol: "C", mailCompanyCol: "C", mailDraftIdCol: "D",
  });
  const [toast, setToast] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: async (resp) => {
          if (resp.error) { showToast("ログインに失敗しました", "error"); return; }
          setToken(resp.access_token);
          const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${resp.access_token}` } }).then(r => r.json());
          setUserInfo(ui);
          showToast(`${ui.name} でログインしました`);
        },
      });
    };
    document.head.appendChild(script);
  }, []);

  const login = () => tokenClientRef.current?.requestAccessToken();
  const logout = () => { setToken(null); setUserInfo(null); };
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const saveConfig = (cfg) => { setConfig(cfg); const local = loadLocal(); saveLocal({ ...local, config: cfg }); showToast("設定を保存しました"); };

  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoRow}>
            <div style={S.logo}>
              <div style={S.logoMark}>
                <span style={S.logoMarkText}>DA</span>
                <div style={S.logoRainbow} />
              </div>
              <div>
                <div style={S.logoText}>AgentScout</div>
                <div style={S.logoSub}>ドラピタエージェント｜スカウトメール管理</div>
              </div>
            </div>
            <div>
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
            <button key={i} style={{ ...S.navBtn, ...(tab === i ? S.navActive : {}) }} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      </nav>

      {/* BANNER */}
      {!token && tab !== 0 && (
        <div style={S.banner}>
          <span>⚠️ Googleスプレッドシートと連携するにはログインが必要です</span>
          <button style={S.btnPrimary} onClick={login}>Googleでログイン</button>
        </div>
      )}

      <main style={S.main}>
        {tab === 0 && <SettingsTab config={config} saveConfig={saveConfig} token={token} showToast={showToast} />}
        {tab === 1 && <MailGenTab config={config} token={token} showToast={showToast} />}
        {tab === 2 && <ResultsTab config={config} token={token} showToast={showToast} />}
        {tab === 3 && <AnalysisTab config={config} token={token} showToast={showToast} />}
      </main>

      {toast && <div style={{ ...S.toast, background: toast.type === "error" ? "#ef4444" : "#2A9D9E" }}>{toast.msg}</div>}
    </div>
  );
}

// ── Settings ──────────────────────────────────────
function SettingsTab({ config, saveConfig, token, showToast }) {
  const [form, setForm] = useState(config);
  const [testing, setTesting] = useState(false);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const testConnection = async () => {
    if (!token) return showToast("先にGoogleログインしてください", "error");
    if (!form.spreadsheetId) return showToast("スプレッドシートIDを入力してください", "error");
    setTesting(true);
    try {
      const r = await sheetsGet(token, form.spreadsheetId, `${form.jobSheet}!A1`);
      if (r.error) throw new Error(r.error.message);
      showToast("接続成功！スプレッドシートにアクセスできました");
    } catch (e) { showToast(`接続失敗: ${e.message}`, "error"); }
    setTesting(false);
  };

  return (
    <div style={S.tabWrap}>
      <div style={S.pageHeader}>
        <h2 style={S.h2}>スプレッドシート設定</h2>
        <p style={S.pageDesc}>GoogleスプレッドシートとAgentScoutを連携する設定です</p>
      </div>

      <div style={S.guide}>
        <div style={S.guideHeader}>
          <span style={S.guideIcon}>🚀</span>
          <h3 style={S.guideTitle}>初回セットアップ手順</h3>
        </div>
        <div style={S.steps}>
          {[
            ["Google Cloud Consoleでプロジェクト作成", "console.cloud.google.comを開き「新しいプロジェクト」を作成"],
            ["Google Sheets APIを有効化", "「APIとサービス」→「ライブラリ」→「Google Sheets API」を検索して有効化"],
            ["OAuth同意画面を設定", "「OAuth同意画面」→ 内部で作成。スコープにspreadsheetsを追加"],
            ["OAuth 2.0クライアントIDを作成", "「認証情報」→「OAuthクライアントID」→ ウェブアプリケーション → このURLを承認済みオリジンに追加"],
            ["スプレッドシートIDを入力", "スプレッドシートURLの /d/ と /edit の間の文字列"],
          ].map(([title, body], i) => (
            <div key={i} style={S.step}>
              <div style={S.stepNum}>{i + 1}</div>
              <div><div style={S.stepTitle}>{title}</div><div style={S.stepBody}>{body}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>接続設定</h3>
        <div style={S.grid2}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>スプレッドシートID <span style={S.required}>*</span></label>
            <input style={S.input} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" value={form.spreadsheetId} onChange={f("spreadsheetId")} />
            <div style={S.hint}>スプレッドシートURLの /d/ と /edit の間の文字列</div>
          </div>
          {[
            ["jobSheet", "案件シート名", "案件リスト"], ["jobStartRow", "データ開始行", "2"],
            ["jobUrlCol", "求人URL列", "B"], ["jobPointsCol", "推しポイント列", "C"],
            ["jobMailCol", "メール出力列", "D"], ["jobCheckCol", "チェックボックス列", "M"], ["jobAgeCol", "年齢列", "N"], ["jobAreaCol", "居住地列", "O"], ["jobLicenseCol", "保有免許列", "P"], ["mailSheet", "メール保存先シート名", "メール文章（空欄=案件シート）"], ["mailCol", "メール保存先列", "A"], ["resultSheet", "実績シート名", "実績データ"],
          ].map(([key, label, ph]) => (
            <div key={key}>
              <label style={S.label}>{label}</label>
              <input style={S.input} placeholder={ph} value={form[key]} onChange={f(key)} type={key === "jobStartRow" ? "number" : "text"} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button style={{ ...S.btnOutline, opacity: testing ? 0.6 : 1 }} onClick={testConnection} disabled={testing}>
            {testing ? "確認中..." : "🔗 接続テスト"}
          </button>
          <button style={S.btnPrimary} onClick={() => saveConfig(form)}>💾 設定を保存</button>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>📋 スプレッドシート構成の目安</h3>
        <table style={S.table}>
          <thead><tr>{["列", "内容", "例"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {[["A", "案件名", "株式会社〇〇 / ドライバー"], ["B", "求人原稿URL", "https://job.example.com/..."], ["C", "推しポイント", "年収480万〜、未経験OK、週休2日"], ["D", "生成メール（出力先）", "← AIが自動入力"]].map(([col, label, ex]) => (
              <tr key={col} style={S.tr}><td style={{ ...S.td, fontWeight: 700, color: "#2A9D9E" }}>{col}</td><td style={S.td}>{label}</td><td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>{ex}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Mail Gen ──────────────────────────────────────
const TONES = [
  { value: "熱量高め・情熱的", label: "🔥 熱量高め", desc: "情熱的で熱いメッセージ" },
  { value: "丁寧・フォーマル", label: "🎩 丁寧・フォーマル", desc: "礼儀正しく誠実なトーン" },
  { value: "カジュアル・親しみやすい", label: "😊 カジュアル", desc: "話しかけるような自然な文体" },
  { value: "簡潔・シンプル", label: "⚡ 簡潔・シンプル", desc: "要点を絞ったコンパクトな文章" },
];

function MailGenTab({ config, token, showToast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genAll, setGenAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState("熱量高め・情熱的");
  const [customInstruction, setCustomInstruction] = useState("");

  const colIdx = (col) => col.toUpperCase().charCodeAt(0) - 65;

  const loadFromSheets = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    if (!config.spreadsheetId) return showToast("設定タブでIDを入力してください", "error");
    setLoading(true);
    try {
      const res = await sheetsGet(token, config.spreadsheetId, `${config.jobSheet}!A${config.jobStartRow}:Z`);
      if (res.error) throw new Error(res.error.message);
      const rows = res.values || [];
      const checkIdx = colIdx(config.jobCheckCol || "M");
      const parsed = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => {
          const checked = r[checkIdx];
          return checked === true || checked === "TRUE" || checked === "true";
        })
        .map(({ r, i }) => ({
          rowNum: Number(config.jobStartRow) + i, name: r[0] || `案件 ${i + 1}`,
          company: r[colIdx(config.mailCompanyCol || "C")] || "",
          draftId: r[colIdx(config.mailDraftIdCol || "D")] || "",
          url: r[colIdx(config.jobUrlCol)] || "",
          points: r[colIdx(config.jobPointsCol)] || "",
          age: r[colIdx(config.jobAgeCol || "N")] || "",
          area: r[colIdx(config.jobAreaCol || "O")] || "",
          license: r[colIdx(config.jobLicenseCol || "P")] || "",
          mail: r[colIdx(config.jobMailCol)] || "", loading: false,
        }));
      setJobs(parsed);
      showToast(`チェック済み ${parsed.length}件の案件を読み込みました`);
    } catch (e) { showToast(`読み込み失敗: ${e.message}`, "error"); }
    setLoading(false);
  };

  const generateOne = async (idx) => {
    const job = jobs[idx];
    setJobs(j => j.map((x, i) => i === idx ? { ...x, loading: true } : x));
    try {
      let info = job.points;
      if (job.url) {
        try {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(job.url)}`);
          const j = await r.json();
          const text = j.contents?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 2000) || "";
          info = `【求人ページ】\n${text}\n\n【推しポイント・強み】\n${job.points}\n\n【対象者情報】\n年齢：${job.age || "不明"}\n居住地：${job.area || "不明"}\n保有免許：${job.license || "不明"}`;
        } catch {
          info = `【推しポイント・強み】\n${job.points}\n\n【対象者情報】\n年齢：${job.age || "不明"}\n居住地：${job.area || "不明"}\n保有免許：${job.license || "不明"}`;
        }
      }
      const mail = await callClaude(
        `あなたは運送・物流業界専門の人材紹介会社のエースコンサルタントです。求職者へのスカウトメールを以下の条件で書いてください。
- トーン：${tone}
- 含める要素：推しポイント・強みのフィーチャー、応募メリット・待遇
- 対象者の年齢・居住地・保有免許を考慮した内容にすること
- 保有免許が複数の場合はすべて活かせる点をアピールすること
- 件名を「件名：〇〇」の形式で冒頭に記載
- 本文300〜500文字
- 自然な日本語${customInstruction ? `\n- 追加指示：${customInstruction}` : ""}`,
        `以下の求人情報をもとにスカウトメールを作成してください。\n\n${info}`
      );
      setJobs(j => j.map((x, i) => i === idx ? { ...x, mail, loading: false } : x));
    } catch { showToast("生成に失敗しました", "error"); setJobs(j => j.map((x, i) => i === idx ? { ...x, loading: false } : x)); }
  };

  const generateAll = async () => {
    setGenAll(true);
    for (let i = 0; i < jobs.length; i++) { if (jobs[i].url || jobs[i].points) await generateOne(i); }
    setGenAll(false);
  };

  const saveToSheets = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    const toSave = jobs.filter(j => j.mail);
    if (!toSave.length) return showToast("保存するメールがありません", "error");
    setSaving(true);
    const targetSheet = config.mailSheet && config.mailSheet.trim() ? config.mailSheet.trim() : config.jobSheet;
    try {
      if (config.mailSheet && config.mailSheet.trim()) {
        // 別シートに保存：A列=企業名, B列=原稿ID, C列=文面 を1行ずつ追記
        const rows = toSave.map(job => [job.company || "", job.draftId || "", job.mail]);
        await sheetsAppend(token, config.spreadsheetId, `${targetSheet}!A:C`, rows);
      } else {
        for (const job of toSave) {
          await sheetsUpdate(token, config.spreadsheetId, `${config.jobSheet}!${config.jobMailCol}${job.rowNum}`, [[job.mail]]);
        }
      }
      showToast(`${toSave.length}件を「${targetSheet}」に保存しました`);
    } catch (e) { showToast(`保存失敗: ${e.message}`, "error"); }
    setSaving(false);
  };

  return (
    <div style={S.tabWrap}>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.h2}>スカウトメール一括生成</h2>
          <p style={S.pageDesc}>スプレッドシートから案件を読み込み、AIがスカウトメールを自動生成します</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...S.btnOutline, opacity: loading ? 0.6 : 1 }} onClick={loadFromSheets} disabled={loading}>{loading ? "読込中..." : "📥 スプシから読み込む"}</button>
          {jobs.length > 0 && <>
            <button style={{ ...S.btnPrimary, opacity: genAll ? 0.6 : 1 }} onClick={generateAll} disabled={genAll}>{genAll ? "生成中..." : "⚡ 全件生成"}</button>
            <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={saveToSheets} disabled={saving}>{saving ? "保存中..." : "📤 スプシに保存"}</button>
          </>}
        </div>
      </div>

      {/* ニュアンス設定 */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>🎨 メールのニュアンス設定</h3>
        <label style={S.label}>トーンを選択</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {TONES.map(t => (
            <button key={t.value} onClick={() => setTone(t.value)} style={{
              ...S.toneBtn,
              ...(tone === t.value ? S.toneBtnActive : {}),
            }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <label style={S.label}>追加指示（任意）</label>
        <textarea
          style={{ ...S.input, minHeight: 60 }}
          placeholder="例：冒頭に相手の経歴に触れる一文を入れてください　／　運送・物流業界向けの言葉を使ってください"
          value={customInstruction}
          onChange={e => setCustomInstruction(e.target.value)}
        />
        <div style={S.hint}>ここに入力した内容がすべての生成メールに反映されます</div>
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
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{job.name}</span>
                </div>
                <button style={{ ...S.btnPrimary, opacity: job.loading ? 0.6 : 1, fontSize: 13 }} onClick={() => generateOne(idx)} disabled={job.loading || genAll}>
                  {job.loading ? "生成中..." : "✨ 生成"}
                </button>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>求人URL（E列）</label><div style={S.infoBox}>{job.url || "—"}</div></div>
                <div><label style={S.label}>推しポイント・強み（Q列）</label><div style={S.infoBox}>{job.points || "—"}</div></div>
                <div><label style={S.label}>年齢（N列）</label><div style={S.infoBox}>{job.age || "—"}</div></div>
                <div><label style={S.label}>居住地（O列）</label><div style={S.infoBox}>{job.area || "—"}</div></div>
                <div style={{ gridColumn: "1/-1" }}><label style={S.label}>保有免許（P列）</label><div style={S.infoBox}>{job.license || "—"}</div></div>
              </div>
              {job.mail && <div style={{ marginTop: 12 }}>
                <label style={S.label}>生成メール（編集可）</label>
                <textarea style={{ ...S.input, minHeight: 150, fontFamily: "inherit", lineHeight: 1.7 }} value={job.mail} onChange={e => setJobs(j => j.map((x, i) => i === idx ? { ...x, mail: e.target.value } : x))} />
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Results ──────────────────────────────────────
function ResultsTab({ config, token, showToast }) {
  const [results, setResults] = useState([]);
  const [form, setForm] = useState({ jobName: "", mailVersion: "1", sentCount: "", appliedCount: "", avgAge: "", genderRatio: "", experienceYears: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const rate = (r) => r.sentCount > 0 ? Math.round(r.appliedCount / r.sentCount * 1000) / 10 : 0;

  const loadResults = async () => {
    if (!token) return showToast("Googleログインしてください", "error");
    setLoading(true);
    try {
      const res = await sheetsGet(token, config.spreadsheetId, `${config.resultSheet}!A2:J200`);
      if (res.error) throw new Error(res.error.message);
      setResults((res.values || []).map(r => ({ jobName: r[0] || "", mailVersion: r[1] || "1", sentCount: Number(r[2]) || 0, appliedCount: Number(r[3]) || 0, avgAge: r[4] || "", genderRatio: r[5] || "", experienceYears: r[6] || "", note: r[7] || "", date: r[8] || "" })));
      showToast("実績を読み込みました");
    } catch (e) { showToast(`読み込み失敗: ${e.message}`, "error"); }
    setLoading(false);
  };

  const addResult = async () => {
    if (!form.jobName || !form.sentCount) return showToast("案件名と送信数は必須です", "error");
    if (!token) return showToast("Googleログインしてください", "error");
    setSaving(true);
    const row = [form.jobName, form.mailVersion, form.sentCount, form.appliedCount, form.avgAge, form.genderRatio, form.experienceYears, form.note, new Date().toLocaleDateString("ja-JP")];
    try {
      await sheetsAppend(token, config.spreadsheetId, `${config.resultSheet}!A:I`, [row]);
      setResults(r => [...r, { ...form, sentCount: Number(form.sentCount), appliedCount: Number(form.appliedCount) || 0, date: new Date().toLocaleDateString("ja-JP") }]);
      setForm({ jobName: "", mailVersion: "1", sentCount: "", appliedCount: "", avgAge: "", genderRatio: "", experienceYears: "", note: "" });
      showToast("実績をスプレッドシートに記録しました");
    } catch (e) { showToast(`保存失敗: ${e.message}`, "error"); }
    setSaving(false);
  };

  return (
    <div style={S.tabWrap}>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.h2}>実績データ管理</h2>
          <p style={S.pageDesc}>スカウトメールの送信実績を記録・管理します</p>
        </div>
        <button style={{ ...S.btnOutline, opacity: loading ? 0.6 : 1 }} onClick={loadResults} disabled={loading}>{loading ? "読込中..." : "📥 スプシから読み込む"}</button>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>＋ 実績を記録</h3>
        <div style={S.grid2}>
          {[["jobName","案件名 *","text","株式会社〇〇 / ドライバー"],["mailVersion","バージョン","number","1"],["sentCount","送信数 *","number","100"],["appliedCount","応募数","number","12"],["avgAge","平均年齢","number","35"],["genderRatio","性別比率","text","男8:女2"],["experienceYears","平均経験年数","number","5"],["note","メモ","text","自由記述"]].map(([key,lbl,type,ph]) => (
            <div key={key}><label style={S.label}>{lbl}</label><input style={S.input} type={type} placeholder={ph} value={form[key]} onChange={f(key)} /></div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={addResult} disabled={saving}>{saving ? "保存中..." : "📤 記録してスプシに保存"}</button>
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr>{["案件名","Ver","送信","応募","応募率","平均年齢","経験","性別","日付"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{r.jobName}</td><td style={S.td}>v{r.mailVersion}</td>
                  <td style={S.td}>{r.sentCount}</td><td style={S.td}>{r.appliedCount}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: rate(r) >= 10 ? "#2A9D9E" : rate(r) >= 5 ? "#FF9800" : "#ef4444" }}>{rate(r)}%</span></td>
                  <td style={S.td}>{r.avgAge ? `${r.avgAge}歳` : "—"}</td><td style={S.td}>{r.experienceYears ? `${r.experienceYears}年` : "—"}</td>
                  <td style={S.td}>{r.genderRatio || "—"}</td><td style={S.td}>{r.date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Analysis ──────────────────────────────────────
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
        sheetsGet(token, config.spreadsheetId, `${config.jobSheet}!A${config.jobStartRow}:Z`),
      ]);
      setResults((rRes.values || []).map(r => ({ jobName: r[0], mailVersion: r[1], sentCount: Number(r[2]) || 0, appliedCount: Number(r[3]) || 0, avgAge: r[4], genderRatio: r[5], experienceYears: r[6] })));
      const uIdx = config.jobUrlCol.toUpperCase().charCodeAt(0) - 65;
      const pIdx = config.jobPointsCol.toUpperCase().charCodeAt(0) - 65;
      const mIdx = config.jobMailCol.toUpperCase().charCodeAt(0) - 65;
      setJobs((jRes.values || []).filter(r => r[0]).map((r, i) => ({ rowNum: Number(config.jobStartRow) + i, name: r[0], url: r[uIdx] || "", points: r[pIdx] || "", mail: r[mIdx] || "" })));
      showToast("データを読み込みました");
    } catch (e) { showToast(`読み込み失敗: ${e.message}`, "error"); }
  };

  const filtered = selectedJob ? results.filter(r => r.jobName === selectedJob) : results;
  const totalSent = filtered.reduce((s, r) => s + r.sentCount, 0);
  const totalApplied = filtered.reduce((s, r) => s + r.appliedCount, 0);
  const avgRate = totalSent > 0 ? Math.round(totalApplied / totalSent * 1000) / 10 : 0;
  const agesWithData = filtered.filter(r => r.avgAge);
  const avgAge = agesWithData.length > 0 ? Math.round(agesWithData.reduce((s, r) => s + Number(r.avgAge), 0) / agesWithData.length) : null;
  const jobObj = jobs.find(j => j.name === selectedJob);

  const ctx = () => `【対象案件】${selectedJob || "全案件"}\n【推しポイント】${jobObj?.points || "—"}\n【現在のメール文】${jobObj?.mail || "—"}\n【実績】送信${totalSent}件/応募${totalApplied}件/応募率${avgRate}%\n【平均年齢】${avgAge ? avgAge + "歳" : "データなし"}\n【詳細】${JSON.stringify(filtered.slice(-10))}`;

  const run = async (type) => {
    setBusy(b => ({ ...b, [type]: true }));
    const prompts = {
      analysis: ["あなたは採用マーケティングアナリストです。", `実績データを分析し傾向・課題・改善ポイントを3〜5点で箇条書きにしてください。\n\n${ctx()}`],
      rewrite: ["あなたは人材紹介のトップコンサルタントです。", `実績データを踏まえ応募率を上げるためスカウトメールをリライトしてください。件名も含めて。\n\n${ctx()}`],
      target: ["あなたは採用戦略コンサルタントです。", `応募データから次回スカウト送信に最適な求職者の属性を具体的に提案してください。\n\n${ctx()}`],
    };
    const res = await callClaude(...prompts[type]);
    if (type === "analysis") setAnalysis(res);
    if (type === "rewrite") { setRewrite(res); setNewMail(res); }
    if (type === "target") setTarget(res);
    setBusy(b => ({ ...b, [type]: false }));
  };

  const saveRewrite = async () => {
    if (!token || !jobObj || !newMail) return;
    setSaving(true);
    try {
      await sheetsUpdate(token, config.spreadsheetId, `${config.jobSheet}!${config.jobMailCol}${jobObj.rowNum}`, [[newMail]]);
      showToast("リライト版をスプレッドシートに保存しました");
    } catch (e) { showToast(`保存失敗: ${e.message}`, "error"); }
    setSaving(false);
  };

  return (
    <div style={S.tabWrap}>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.h2}>分析・リライト提案</h2>
          <p style={S.pageDesc}>実績データをもとにAIがメール改善案とターゲット提案を行います</p>
        </div>
        <button style={S.btnOutline} onClick={loadData}>📥 データ読み込み</button>
      </div>

      <div style={S.card}>
        <label style={S.label}>分析する案件（空白 = 全案件）</label>
        <select style={{ ...S.input, maxWidth: 420 }} value={selectedJob} onChange={e => { setSelectedJob(e.target.value); setAnalysis(""); setRewrite(""); setTarget(""); }}>
          <option value="">全案件まとめて分析</option>
          {jobs.map(j => <option key={j.rowNum} value={j.name}>{j.name}</option>)}
        </select>

        <div style={S.statsRow}>
          {[{ l: "送信数", v: `${totalSent}件` }, { l: "応募数", v: `${totalApplied}件` }, { l: "応募率", v: `${avgRate}%`, c: avgRate >= 10 ? "#2A9D9E" : avgRate >= 5 ? "#FF9800" : "#ef4444" }, { l: "平均年齢", v: avgAge ? `${avgAge}歳` : "—" }].map(s => (
            <div key={s.l} style={S.statBox}>
              <div style={S.statL}>{s.l}</div>
              <div style={{ ...S.statV, color: s.c || "#1e293b" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[{ key: "analysis", label: "🔍 データ分析" }, { key: "rewrite", label: "✍️ リライト提案", disabled: !selectedJob }, { key: "target", label: "🎯 ターゲット提案" }].map(btn => (
            <button key={btn.key} style={{ ...S.btnPrimary, opacity: busy[btn.key] || btn.disabled ? 0.5 : 1 }} onClick={() => run(btn.key)} disabled={busy[btn.key] || btn.disabled}>
              {busy[btn.key] ? "生成中..." : btn.label}
            </button>
          ))}
        </div>
        {!selectedJob && <div style={{ ...S.hint, marginTop: 8 }}>※ リライト提案は案件を選択してから実行してください</div>}
      </div>

      {analysis && <div style={S.card}><h3 style={S.cardTitle}>📊 分析結果</h3><pre style={S.pre}>{analysis}</pre></div>}
      {rewrite && <div style={S.card}>
        <h3 style={S.cardTitle}>✍️ リライト提案</h3>
        <pre style={S.pre}>{rewrite}</pre>
        <label style={{ ...S.label, marginTop: 12 }}>採用する文面（編集可）</label>
        <textarea style={{ ...S.input, minHeight: 160, fontFamily: "inherit", lineHeight: 1.7 }} value={newMail} onChange={e => setNewMail(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button style={{ ...S.btnSuccess, opacity: saving ? 0.6 : 1 }} onClick={saveRewrite} disabled={saving}>{saving ? "保存中..." : "📤 スプシに上書き保存"}</button>
        </div>
      </div>}
      {target && <div style={S.card}><h3 style={S.cardTitle}>🎯 次回ターゲット提案</h3><pre style={S.pre}>{target}</pre></div>}
    </div>
  );
}

// ── STYLES (White/Clean) ──────────────────────────
const S = {
  root: { minHeight: "100vh", background: "#f0f8f8", color: "#1e293b", fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" },
  header: { background: "#fff", borderBottom: "2px solid #e8f5f5", boxShadow: "0 2px 8px rgba(0,188,212,0.08)" },
  headerInner: { maxWidth: 1140, margin: "0 auto", padding: "0 24px" },
  logoRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" },
  logo: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: { width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg, #2A9D9E, #4CAF50)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", flexShrink: 0 },
  logoMarkText: { color: "#fff", fontWeight: 900, fontSize: 14, zIndex: 1, position: "relative" },
  logoRainbow: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2A9D9E, #4CAF50, #FF9800, #F44336, #E91E63)" },
  logoText: { fontSize: 20, fontWeight: 800, color: "#1a7a7b", letterSpacing: "-0.5px" },
  logoSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  userRow: { display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: "50%", border: "2px solid #e8f5f5" },
  userName: { fontSize: 13, color: "#475569" },
  btnLogin: { display: "flex", alignItems: "center", background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  btnLogout: { background: "transparent", border: "1px solid #e2e8f0", color: "#94a3b8", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  nav: { background: "#fff", borderBottom: "1px solid #e8f5f5" },
  navInner: { maxWidth: 1140, margin: "0 auto", display: "flex", padding: "0 24px" },
  navBtn: { background: "none", border: "none", color: "#64748b", padding: "13px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500, borderBottom: "3px solid transparent", transition: "all .2s", whiteSpace: "nowrap" },
  navActive: { color: "#2A9D9E", borderBottomColor: "#2A9D9E", fontWeight: 700 },
  banner: { background: "#fef9c3", borderBottom: "1px solid #fde68a", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 14, color: "#92400e" },
  main: { maxWidth: 1140, margin: "0 auto", padding: "28px 24px" },
  tabWrap: { display: "flex", flexDirection: "column", gap: 20 },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  h2: { fontSize: 22, fontWeight: 800, margin: 0, color: "#1a7a7b" },
  pageDesc: { fontSize: 13, color: "#64748b", margin: "4px 0 0" },
  card: { background: "#fff", border: "1px solid #e8f5f5", borderRadius: 14, padding: 22, boxShadow: "0 2px 8px rgba(0,188,212,0.06)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#1a7a7b" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  label: { display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 },
  required: { color: "#ef4444" },
  input: { width: "100%", background: "#f8fafc", border: "1.5px solid #e8f5f5", borderRadius: 8, padding: "9px 12px", color: "#1e293b", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", transition: "border .2s" },
  hint: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  infoBox: { background: "#f8fafc", border: "1.5px solid #e8f5f5", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#64748b", minHeight: 36 },
  rowBadge: { background: "#e8f5f5", color: "#1a7a7b", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 },
  btnPrimary: { background: "linear-gradient(135deg, #2A9D9E, #1a8a8b)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,188,212,0.25)" },
  btnSuccess: { background: "linear-gradient(135deg, #4CAF50, #388E3C)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
  btnOutline: { background: "#fff", color: "#2A9D9E", border: "1.5px solid #2A9D9E", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" },
  empty: { textAlign: "center", padding: "60px 20px", color: "#94a3b8", background: "#fff", borderRadius: 14, border: "1px dashed #e8f5f5" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8f5f5" },
  th: { background: "#f0f8f8", padding: "11px 14px", textAlign: "left", color: "#1a7a7b", fontWeight: 700, whiteSpace: "nowrap", fontSize: 12, borderBottom: "1px solid #e8f5f5" },
  td: { padding: "11px 14px", borderBottom: "1px solid #f0f8f8", color: "#334155" },
  tr: {},
  badge: { borderRadius: 20, padding: "3px 9px", color: "#fff", fontSize: 12, fontWeight: 700 },
  statsRow: { display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" },
  statBox: { background: "#f0f8f8", border: "1px solid #e8f5f5", borderRadius: 10, padding: "12px 20px", textAlign: "center", minWidth: 90 },
  statL: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  statV: { fontSize: 22, fontWeight: 800 },
  pre: { background: "#f8fafc", border: "1px solid #e8f5f5", borderRadius: 8, padding: 16, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "#334155", margin: 0 },
  guide: { background: "#fff", border: "1px solid #e8f5f5", borderRadius: 14, padding: 22, boxShadow: "0 2px 8px rgba(0,188,212,0.06)" },
  guideHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  guideIcon: { fontSize: 22 },
  guideTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: "#1a7a7b" },
  steps: { display: "flex", flexDirection: "column", gap: 14 },
  step: { display: "flex", gap: 14, alignItems: "flex-start" },
  stepNum: { width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #2A9D9E, #4CAF50)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 },
  stepTitle: { fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 3 },
  stepBody: { fontSize: 13, color: "#64748b", lineHeight: 1.6 },
  toast: { position: "fixed", bottom: 24, right: 24, color: "#fff", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: "0 8px 30px rgba(0,0,0,0.15)" },
  toneBtn: { background: "#f8fafc", border: "1.5px solid #e0f7fa", borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "left", minWidth: 140, transition: "all .15s" },
  toneBtnActive: { background: "#e8f5f5", border: "2px solid #2A9D9E", color: "#1a7a7b" },
};
