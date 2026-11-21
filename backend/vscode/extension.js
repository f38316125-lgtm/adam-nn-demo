const vscode = require("vscode");
const crypto = require("crypto");
const { SYSTEM, TOOLS } = require("./tools");
const X = require("./executor");

let ext, view, out, busy = false, stopFlag = false, serverSession = null, localHistory = null;
const pendingAsk = new Map();

const cfg = () => vscode.workspace.getConfiguration("adam");
const post = (msg) => view && view.webview.postMessage(msg);

function ask(text, okLabel, detail) {
  return new Promise((resolve) => {
    const id = crypto.randomBytes(4).toString("hex");
    let done = false;
    const finish = (v) => { if (done) return; done = true; pendingAsk.delete(id); post({ type: "askDone", id, ok: v }); resolve(v); };
    pendingAsk.set(id, finish);
    post({ type: "ask", id, text, detail, okLabel });
    vscode.window.showInformationMessage(text, okLabel, "Negar").then((c) => c && finish(c === okLabel));
  });
}

async function gatherContext(full) {
  const lines = [];
  if (X.root()) {
    if (full) lines.push(await X.projectMap());
    else lines.push(`Projeto: ${vscode.workspace.name}`);
  } else lines.push("Nenhuma pasta aberta no VS Code.");
  const ed = vscode.window.activeTextEditor;
  if (ed && ed.document.uri.scheme === "file") {
    lines.push(`Arquivo aberto: ${X.rel(ed.document.uri)} (cursor na linha ${ed.selection.active.line + 1})`);
    if (!ed.selection.isEmpty) lines.push("Seleção:\n```\n" + ed.document.getText(ed.selection).slice(0, 8000) + "\n```");
  }
  lines.push(`Modo de aprovação: ${cfg().get("autonomia")}`);
  return lines.join("\n\n").slice(0, 55000);
}

async function serverCall(route, body) {
  const key = await ext.secrets.get("adam.apiKey");
  const server = (cfg().get("server") || "").replace(/\/$/, "");
  if (!key || !server) throw new Error("Chave de API do Adam não configurada");
  const r = await fetch(`${server}/api/v1/code${route}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Servidor respondeu ${r.status}`);
  return data;
}

async function runServer(task) {
  let res = await serverCall("/start", { task, context: await gatherContext(!serverSession), session_id: serverSession, system: SYSTEM, tools: TOOLS });
  serverSession = res.session_id;
  while (true) {
    if (res.message) post({ type: "assistant", text: res.message, engine: "Adam Pro" });
    if (res.done || !res.action) return;
    if (stopFlag) { await serverCall(`/${res.session_id}/stop`, {}).catch(() => {}); serverSession = null; return; }
    const result = await X.execTool(res.action.name, res.action.args);
    res = await serverCall(`/${res.session_id}/step`, { tool_call_id: res.action.id, result });
  }
}

async function ollama(messages) {
  const url = (cfg().get("ollamaUrl") || "http://localhost:11434").replace(/\/$/, "");
  let r;
  try {
    r = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: cfg().get("ollamaModel") || "qwen2.5", messages, tools: TOOLS, stream: false }) });
  } catch { throw new Error(`Não consegui falar com o Ollama em ${url}. Ele está rodando (ollama serve)?`); }
  if (!r.ok) throw new Error(`Ollama respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).message || {};
}

async function runLocal(task) {
  if (!localHistory) localHistory = [{ role: "system", content: SYSTEM }];
  localHistory.push({ role: "user", content: `${task}\n\n[Contexto do VS Code]\n${await gatherContext(localHistory.length === 1)}` });
  const label = `Ollama · ${cfg().get("ollamaModel")}`;
  for (let i = 0; i < 120 && !stopFlag; i++) {
    const msg = await ollama(localHistory);
    localHistory.push(msg);
    if (msg.content) post({ type: "assistant", text: msg.content, engine: label });
    if (!msg.tool_calls?.length) return;
    for (const tc of msg.tool_calls) {
      let args = tc.function?.arguments || {};
      if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
      const res = await X.execTool(tc.function?.name, args);
      const content = res.denied ? "O usuário NEGOU esta ação. Não repita." : res.error ? `Erro: ${res.error}` : String(res.output).slice(0, 30000);
      localHistory.push({ role: "tool", content, tool_name: tc.function?.name });
    }
  }
}

async function handleTask(task) {
  if (busy || !task.trim()) return;
  busy = true; stopFlag = false;
  X.beginTask();
  post({ type: "user", text: task });
  post({ type: "busy", value: true });
  const engine = cfg().get("engine");
  try {
    if (engine === "local") await runLocal(task);
    else {
      try { await runServer(task); }
      catch (e) {
        if (engine === "pro" || stopFlag) throw e;
        serverSession = null;
        post({ type: "notice", text: `Adam Pro indisponível (${e.message}). Usando o Ollama local…` });
        await runLocal(task);
      }
    }
    if (stopFlag) post({ type: "notice", text: "Tarefa interrompida." });
  } catch (e) { post({ type: "error", text: e.message }); }
  busy = false;
  post({ type: "busy", value: false });
}

function stopAll() {
  stopFlag = true;
  for (const finish of [...pendingAsk.values()]) finish(false);
}

async function undoLast() {
  if (busy) return vscode.window.showWarningMessage("Aguarde o Adam terminar ou clique em Parar.");
  const r = await X.undo({ escopo: "ultima_tarefa", _direct: true });
  post({ type: "notice", text: r.output || r.error || "Cancelado." });
}

async function setApiKey() {
  const v = await vscode.window.showInputBox({ prompt: "Cole sua chave de API do Adam (Adam → API & Chaves)", password: true, ignoreFocusOut: true, placeHolder: "adam_live_..." });
  if (v === undefined) return;
  await ext.secrets.store("adam.apiKey", v.trim());
  sendState();
  vscode.window.showInformationMessage("Chave do Adam salva.");
}

async function sendState() {
  post({ type: "state", hasKey: !!(await ext.secrets.get("adam.apiKey")), engine: cfg().get("engine"), autonomia: cfg().get("autonomia"), model: cfg().get("ollamaModel") });
}

function newChat() { stopAll(); serverSession = null; localHistory = null; post({ type: "clear" }); }

class ChatView {
  resolveWebviewView(v) {
    view = v;
    const media = vscode.Uri.joinPath(ext.extensionUri, "media");
    v.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = crypto.randomBytes(12).toString("hex");
    v.webview.html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${v.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${v.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.css"))}"></head>
<body><div id="app"></div><script nonce="${nonce}" src="${v.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.js"))}"></script></body></html>`;
    v.webview.onDidReceiveMessage((m) => {
      if (m.type === "task") handleTask(m.text);
      else if (m.type === "stop") stopAll();
      else if (m.type === "answer") pendingAsk.get(m.id)?.(m.ok);
      else if (m.type === "new") newChat();
      else if (m.type === "undo") undoLast();
      else if (m.type === "setKey") setApiKey();
      else if (m.type === "settings") vscode.commands.executeCommand("workbench.action.openSettings", "adam.");
      else if (m.type === "engine") cfg().update("engine", m.value, vscode.ConfigurationTarget.Global).then(sendState);
      else if (m.type === "autonomia") cfg().update("autonomia", m.value, vscode.ConfigurationTarget.Global).then(sendState);
      else if (m.type === "ready") sendState();
    });
  }
}

async function focusAndRun(task) {
  await vscode.commands.executeCommand("workbench.view.extension.adam");
  setTimeout(() => handleTask(task), view ? 0 : 800);
}

function activate(context) {
  ext = context;
  out = vscode.window.createOutputChannel("Adam");
  X.init({ post, ask, out, ext, cfg });
  context.subscriptions.push(
    out,
    vscode.window.registerWebviewViewProvider("adam.chat", new ChatView(), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.workspace.registerTextDocumentContentProvider("adam-proposed", X.proposedProvider),
    vscode.commands.registerCommand("adam.setApiKey", setApiKey),
    vscode.commands.registerCommand("adam.newChat", newChat),
    vscode.commands.registerCommand("adam.undo", undoLast),
    vscode.commands.registerCommand("adam.askSelection", () => focusAndRun("Explique o código selecionado e aponte bugs ou melhorias.")),
    vscode.commands.registerCommand("adam.fixProblems", () => focusAndRun("Use ler_diagnosticos no arquivo aberto e corrija os erros encontrados.")),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration("adam") && sendState()),
  );
}

function deactivate() { X.killAll(); }

module.exports = { activate, deactivate };
