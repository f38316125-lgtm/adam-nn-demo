const vscode = require("vscode");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");

const SKIP = "**/{node_modules,.git,dist,build,.next,out,venv,.venv,env,__pycache__,coverage,.cache,.turbo,.parcel-cache,target,vendor}/**";
const KEY_FILE = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Pipfile|Cargo\.toml|go\.mod|composer\.json|Gemfile|docker-compose\.ya?ml|Dockerfile|tsconfig\.json|vite\.config\.\w+|next\.config\.\w+|tailwind\.config\.\w+|craco\.config\.\w+|angular\.json|manage\.py|prisma\/schema\.prisma)$/;
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/;
const MAX_CHECKPOINTS = 400;

const proposed = new Map();
const procs = new Map();
let H, taskId = "t0", checkpoints = [];

function init(host) {
  H = host;
  checkpoints = H.ext.workspaceState.get("adam.checkpoints", []);
}
const beginTask = () => { taskId = crypto.randomBytes(4).toString("hex"); };
const autonomy = () => H.cfg().get("autonomia") || "perguntar";
const needsAsk = (kind) => autonomy() === "perguntar" || (autonomy() === "edicoes" && kind !== "edit");
const root = () => vscode.workspace.workspaceFolders?.[0]?.uri;
const rel = (uri) => vscode.workspace.asRelativePath(uri, false);
const clip = (s, n) => (s.length > n ? s.slice(0, n) + `\n…(${s.length - n} caracteres omitidos)` : s);

function resolvePath(p) {
  const r = root();
  if (!r) throw new Error("Abra uma pasta de projeto no VS Code.");
  const abs = path.resolve(r.fsPath, p || ".");
  if (abs !== r.fsPath && !abs.startsWith(r.fsPath + path.sep)) throw new Error("Caminho fora do projeto.");
  return vscode.Uri.file(abs);
}

async function readText(uri) {
  const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (open) return open.getText();
  try { return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"); } catch { return null; }
}

async function mustRead(p) {
  const uri = resolvePath(p);
  const t = await readText(uri);
  if (t === null) throw new Error(`Arquivo não encontrado: ${p}`);
  return { uri, text: t };
}

const sh = (cmd) => { try { return cp.execSync(cmd, { cwd: root().fsPath, timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };

// ---------- leitura ----------
async function allFiles(limit = 5000) {
  return (await vscode.workspace.findFiles("**/*", SKIP, limit)).map(rel).sort();
}

async function projectMap() {
  const files = await allFiles();
  const byDir = {};
  for (const f of files) (byDir[path.posix.dirname(f)] ||= []).push(path.posix.basename(f));
  const tree = Object.keys(byDir).sort().map((d) => {
    const n = byDir[d];
    return `${d === "." ? "./" : d + "/"}  ${n.slice(0, 50).join("  ")}${n.length > 50 ? `  …(+${n.length - 50})` : ""}`;
  }).join("\n");
  const parts = [`Projeto: ${vscode.workspace.name} — ${files.length} arquivos${files.length >= 5000 ? "+" : ""}`, `Árvore:\n${clip(tree, 22000)}`];
  for (const f of files.filter((x) => KEY_FILE.test(x) && x.split("/").length <= 4).slice(0, 14)) {
    parts.push(`--- ${f} ---\n${clip((await readText(resolvePath(f))) || "", 3500)}`);
  }
  const readme = files.find((f) => /^readme\.md$/i.test(f));
  if (readme) parts.push(`--- ${readme} (início) ---\n${((await readText(resolvePath(readme))) || "").split("\n").slice(0, 50).join("\n")}`);
  const envs = files.filter((f) => ENV_FILE.test(f));
  for (const f of envs) {
    const keys = ((await readText(resolvePath(f))) || "").split("\n").map((l) => l.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=/)?.[1]).filter(Boolean);
    parts.push(`${f}: variáveis ${keys.join(", ") || "(vazio)"} (use ler_env para ver valores)`);
  }
  const git = sh("git status --short --branch");
  if (git) parts.push(`git status:\n${clip(git, 3000)}\nÚltimos commits:\n${sh("git log --oneline -8")}`);
  return clip(parts.join("\n\n"), 45000);
}

async function listFiles(a) {
  const pattern = a.pasta ? new vscode.RelativePattern(resolvePath(a.pasta), "**/*") : "**/*";
  const uris = await vscode.workspace.findFiles(pattern, SKIP, 1500);
  return uris.map(rel).sort().join("\n") || "(vazio)";
}

async function readFile(a, max = 60000) {
  const { uri, text } = await mustRead(a.caminho);
  const lines = text.split("\n");
  const s = Math.max(1, a.linha_inicio || 1), e = Math.min(lines.length, a.linha_fim || lines.length);
  return `${rel(uri)} (${lines.length} linhas)\n` + clip(lines.slice(s - 1, e).map((l, i) => `${s + i}| ${l}`).join("\n"), max);
}

async function readFiles(a) {
  const out = [];
  for (const c of (a.caminhos || []).slice(0, 20)) {
    try { out.push(await readFile({ caminho: c }, 25000)); } catch (e) { out.push(`${c}: ${e.message}`); }
  }
  return out.join("\n\n") || "Nenhum caminho informado.";
}

async function searchText(a) {
  let rx;
  try { rx = new RegExp(a.padrao, "i"); } catch { rx = new RegExp(a.padrao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
  const hits = [];
  for (const u of await vscode.workspace.findFiles(a.glob || "**/*", SKIP, 5000)) {
    if (hits.length >= 200) break;
    let b;
    try { b = await vscode.workspace.fs.readFile(u); } catch { continue; }
    if (b.length > 1e6 || b.includes(0)) continue;
    Buffer.from(b).toString("utf8").split("\n").forEach((l, i) => {
      if (hits.length < 200 && rx.test(l)) hits.push(`${rel(u)}:${i + 1}: ${l.trim().slice(0, 220)}`);
    });
  }
  return hits.join("\n") || "Nenhum resultado.";
}

function diagnostics(a) {
  const sev = ["Erro", "Aviso"], res = [];
  for (const [uri, ds] of vscode.languages.getDiagnostics()) {
    if (a.caminho && rel(uri) !== a.caminho) continue;
    for (const d of ds) if (d.severity <= 1) res.push(`${rel(uri)}:${d.range.start.line + 1}: [${sev[d.severity]}] ${d.message}`);
  }
  return res.slice(0, 250).join("\n") || "Nenhum erro ou aviso.";
}

async function envFiles(only) {
  const files = only ? [only] : (await allFiles()).filter((f) => ENV_FILE.test(f));
  const res = [];
  for (const f of files) { const t = await readText(resolvePath(f)); if (t !== null) res.push([f, t]); }
  return res;
}

async function envVars() {
  const vars = {};
  for (const [, t] of await envFiles()) {
    for (const l of t.split("\n")) {
      const m = l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in vars)) vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return vars;
}

async function readEnv(a) {
  if (needsAsk("sensitive") && !(await H.ask("O Adam quer ler os arquivos .env (credenciais) do projeto.", "Permitir"))) return { denied: true };
  const files = await envFiles(a.caminho);
  return { output: files.map(([f, t]) => `--- ${f} ---\n${t}`).join("\n\n") || "Nenhum arquivo .env encontrado." };
}

// ---------- alterações ----------
function applyEdits(text, edits, caminho) {
  let out = text;
  edits.forEach((e, i) => {
    const n = e.procurar ? out.split(e.procurar).length - 1 : 0;
    if (n === 0) throw new Error(`${caminho}, edição ${i + 1}: trecho não encontrado. Releia o arquivo e copie o trecho exato.`);
    if (n > 1) throw new Error(`${caminho}, edição ${i + 1}: o trecho aparece ${n} vezes. Inclua mais contexto.`);
    out = out.replace(e.procurar, () => e.substituir ?? "");
  });
  return out;
}

async function buildOps(items) {
  const ops = [], virt = new Map();
  const read = async (uri) => (virt.has(uri.fsPath) ? virt.get(uri.fsPath) : readText(uri));
  const push = (...list) => list.forEach((op) => { virt.set(op.uri.fsPath, op.after); ops.push(op); });
  for (const it of items) {
    const uri = resolvePath(it.caminho);
    const before = await read(uri);
    let after = before;
    if (it.excluir) {
      if (before === null) throw new Error(`${it.caminho}: arquivo não existe.`);
      push({ uri, before, after: null });
      continue;
    }
    if (typeof it.conteudo === "string") after = it.conteudo;
    if (it.edicoes?.length) {
      if (after === null) throw new Error(`${it.caminho}: arquivo não existe para editar.`);
      after = applyEdits(after, it.edicoes, it.caminho);
    }
    if (it.novo_caminho) {
      if (before === null) throw new Error(`${it.caminho}: arquivo não existe para renomear.`);
      const dest = resolvePath(it.novo_caminho);
      push({ uri, before, after: null }, { uri: dest, before: await read(dest), after });
      continue;
    }
    if (after === null) throw new Error(`${it.caminho}: informe conteudo, edicoes, excluir ou novo_caminho.`);
    if (after !== before) push({ uri, before, after });
  }
  return ops;
}

function lineStats(op) {
  const a = op.before === null ? [] : op.before.split("\n"), b = op.after === null ? [] : op.after.split("\n");
  if (op.after === null) return `excluir ${rel(op.uri)}`;
  if (op.before === null) return `criar ${rel(op.uri)} (+${b.length})`;
  const setA = new Set(a), setB = new Set(b);
  return `alterar ${rel(op.uri)} (+${b.filter((l) => !setA.has(l)).length} −${a.filter((l) => !setB.has(l)).length})`;
}

async function showDiffs(ops) {
  for (const op of ops.slice(0, 6)) {
    const key = crypto.randomBytes(6).toString("hex");
    proposed.set(key, op.after ?? "");
    const right = vscode.Uri.parse(`adam-proposed:/${rel(op.uri)}?${key}`);
    const left = op.before === null ? vscode.Uri.parse("adam-proposed:/novo?empty") : op.uri;
    await vscode.commands.executeCommand("vscode.diff", left, right, `Adam ↔ ${rel(op.uri)}`, { preview: false, preserveFocus: true });
  }
}

async function closeDiffs() {
  const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.scheme === "adam-proposed");
  if (tabs.length) await vscode.window.tabGroups.close(tabs);
  proposed.clear();
}

async function writeText(uri, text) {
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (doc) {
    const we = new vscode.WorkspaceEdit();
    we.replace(uri, new vscode.Range(0, 0, doc.lineCount, 0), text);
    await vscode.workspace.applyEdit(we);
    await doc.save();
  } else {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(text, "utf8"));
  }
}

async function removeFile(uri) {
  try { await vscode.workspace.fs.delete(uri, { useTrash: false }); } catch {}
}

function saveCheckpoints() {
  if (checkpoints.length > MAX_CHECKPOINTS) checkpoints = checkpoints.slice(-MAX_CHECKPOINTS);
  H.ext.workspaceState.update("adam.checkpoints", checkpoints);
}

async function commit(ops, summary) {
  if (!ops.length) return { output: "Nenhuma mudança necessária (conteúdo idêntico)." };
  const lines = ops.map(lineStats);
  if (needsAsk("edit")) {
    await showDiffs(ops);
    const ok = await H.ask(summary, "Aplicar", lines.join("\n"));
    await closeDiffs();
    if (!ok) return { denied: true };
  }
  const commitId = crypto.randomBytes(4).toString("hex");
  for (const op of ops) {
    checkpoints.push({ task: taskId, commit: commitId, path: rel(op.uri), before: op.before !== null && op.before.length > 2e6 ? undefined : op.before });
    if (op.after === null) await removeFile(op.uri); else await writeText(op.uri, op.after);
  }
  saveCheckpoints();
  lines.forEach((l) => H.post({ type: "tool", text: l, ok: true, edit: true }));
  return { output: `Aplicado:\n${lines.join("\n")}` };
}

async function changeTool(items, summary) {
  let ops;
  try { ops = await buildOps(items); } catch (e) { return { error: `${e.message} Nada foi aplicado.` }; }
  return commit(ops, summary);
}

async function undo(a = {}) {
  const escopo = a.escopo || "ultima_tarefa";
  if (!checkpoints.length) return { output: "Não há alterações do Adam para desfazer." };
  const last = checkpoints[checkpoints.length - 1];
  const pick = escopo === "sessao" ? () => true : escopo === "ultima_alteracao" ? (c) => c.commit === last.commit : (c) => c.task === last.task;
  const target = checkpoints.filter(pick);
  const files = [...new Set(target.map((c) => c.path))];
  if (!a._direct && needsAsk("edit") && !(await H.ask(`Desfazer ${target.length} alteração(ões) do Adam em ${files.length} arquivo(s)?`, "Desfazer", files.join("\n")))) return { denied: true };
  for (const c of [...target].reverse()) {
    const uri = resolvePath(c.path);
    if (c.before === undefined) continue;
    if (c.before === null) await removeFile(uri); else await writeText(uri, c.before);
  }
  checkpoints = checkpoints.filter((c) => !pick(c));
  saveCheckpoints();
  H.post({ type: "tool", text: `Desfez alterações em ${files.length} arquivo(s)`, ok: true });
  return { output: `Desfeito (${escopo}): ${files.join(", ")}` };
}

// ---------- comandos e processos ----------
async function runCommand(a) {
  if (needsAsk("cmd") && !(await H.ask(`O Adam quer executar${a.segundo_plano ? " em segundo plano" : ""}:`, "Executar", a.comando))) return { denied: true };
  const cwd = a.pasta ? resolvePath(a.pasta).fsPath : root().fsPath;
  H.out.appendLine(`\n$ ${a.comando}`);
  if (a.segundo_plano) return startProcess(a.comando, cwd);
  const timeout = Math.min(Math.max(a.timeout_s || 300, 5), 1800) * 1000;
  return new Promise((res) => {
    cp.exec(a.comando, { cwd, timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (err.killed ? "tempo esgotado" : err.code ?? 1) : 0;
      H.out.append(stdout + stderr);
      H.post({ type: "tool", text: `Executou: ${a.comando} (saída ${code})`, ok: code === 0 });
      const both = `${stdout}\n${stderr}`;
      res({ output: `código de saída: ${code}\n${both.length > 20000 ? both.slice(0, 4000) + "\n…\n" + both.slice(-16000) : both}` });
    });
  });
}

function startProcess(cmd, cwd) {
  const id = `p${procs.size + 1}-${crypto.randomBytes(2).toString("hex")}`;
  const child = cp.spawn(cmd, { cwd, shell: true, detached: process.platform !== "win32", env: process.env });
  const p = { child, cmd, buf: "", code: null };
  const add = (d) => { const s = d.toString(); p.buf = (p.buf + s).slice(-60000); H.out.append(s); };
  child.stdout.on("data", add);
  child.stderr.on("data", add);
  child.on("exit", (c) => { p.code = c ?? "encerrado"; });
  procs.set(id, p);
  H.post({ type: "tool", text: `Iniciou em segundo plano: ${cmd} (${id})`, ok: true });
  return new Promise((res) => setTimeout(() => res({ output: `processo ${id} ${p.code === null ? "rodando" : `terminou (código ${p.code})`}\nsaída inicial:\n${p.buf.slice(-12000)}` }), 7000));
}

function readProcess(a) {
  const p = procs.get(a.id);
  if (!p) return { error: `Processo ${a.id} não encontrado. Ativos: ${[...procs.keys()].join(", ") || "nenhum"}` };
  return { output: `${a.id} (${p.cmd}): ${p.code === null ? "rodando" : `terminou (código ${p.code})`}\n${p.buf.slice(-15000)}` };
}

function kill(p) {
  if (p.code !== null) return;
  try {
    if (process.platform === "win32") cp.exec(`taskkill /pid ${p.child.pid} /T /F`);
    else process.kill(-p.child.pid, "SIGTERM");
  } catch { try { p.child.kill(); } catch {} }
}

function stopProcess(a) {
  const p = procs.get(a.id);
  if (!p) return { error: `Processo ${a.id} não encontrado.` };
  kill(p);
  procs.delete(a.id);
  return { output: `Processo ${a.id} encerrado.` };
}

const killAll = () => { for (const p of procs.values()) kill(p); procs.clear(); };

// ---------- banco de dados ----------
function dbCommand(tipo, url, banco, q) {
  if (tipo === "mongodb") {
    let u = url;
    try { const x = new URL(url); if (banco && (!x.pathname || x.pathname === "/")) { x.pathname = `/${banco}`; u = x.toString(); } } catch {}
    return ["mongosh", [u, "--quiet", "--eval", q]];
  }
  if (tipo === "postgres") return ["psql", [url, "-P", "pager=off", "-c", q]];
  if (tipo === "mysql") {
    const x = new URL(url);
    return ["mysql", ["-h", x.hostname, "-P", x.port || "3306", "-u", decodeURIComponent(x.username), `-p${decodeURIComponent(x.password)}`, banco || x.pathname.slice(1), "-e", q]];
  }
  if (tipo === "sqlite") return ["sqlite3", [resolvePath(url.replace(/^(sqlite|file):(\/\/)?/, "")).fsPath, q]];
  throw new Error("Tipo de banco não reconhecido. Informe tipo: mongodb | postgres | mysql | sqlite.");
}

async function dbQuery(a) {
  const env = await envVars();
  const url = a.url || env.MONGO_URL || env.MONGODB_URI || env.MONGO_URI || env.DATABASE_URL || env.POSTGRES_URL || env.MYSQL_URL || env.SQLITE_PATH;
  if (!url) return { error: "Não achei a URL do banco no .env. Passe o parâmetro url." };
  const banco = a.banco || env.DB_NAME || env.MONGO_DB || env.DATABASE_NAME;
  const tipo = a.tipo || (/^mongodb(\+srv)?:/.test(url) ? "mongodb" : /^postgres(ql)?:/.test(url) ? "postgres" : /^mysql/.test(url) ? "mysql" : "sqlite");
  let bin, args;
  try { [bin, args] = dbCommand(tipo, url, banco, a.consulta); } catch (e) { return { error: e.message }; }
  if (needsAsk("db") && !(await H.ask(`O Adam quer consultar o banco (${tipo}${banco ? ` · ${banco}` : ""}):`, "Executar", a.consulta))) return { denied: true };
  return new Promise((res) => {
    cp.execFile(bin, args, { cwd: root().fsPath, timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      H.post({ type: "tool", text: `Consultou o banco (${tipo})`, ok: !err });
      if (err?.code === "ENOENT") return res({ error: `O cliente ${bin} não está instalado. Instale-o ou escreva um script com o driver do projeto e rode com executar_comando.` });
      res({ output: clip(`${stdout}\n${stderr}`.trim() || "(sem saída)", 30000) });
    });
  });
}

// ---------- despacho ----------
const LABELS = {
  mapa_projeto: () => "Mapeando o projeto", listar_arquivos: (a) => `Listando ${a.pasta || "projeto"}`, ler_arquivo: (a) => `Lendo ${a.caminho}`,
  ler_arquivos: (a) => `Lendo ${(a.caminhos || []).length} arquivos`, buscar_texto: (a) => `Buscando “${a.padrao}”`, ler_diagnosticos: () => "Lendo erros do VS Code",
  ler_env: () => "Lendo .env", ler_processo: (a) => `Lendo saída de ${a.id}`,
};

async function execTool(name, args) {
  args = args || {};
  if (LABELS[name]) H.post({ type: "tool", text: LABELS[name](args) });
  try {
    switch (name) {
      case "mapa_projeto": return { output: await projectMap() };
      case "listar_arquivos": return { output: await listFiles(args) };
      case "ler_arquivo": return { output: await readFile(args) };
      case "ler_arquivos": return { output: await readFiles(args) };
      case "buscar_texto": return { output: await searchText(args) };
      case "ler_diagnosticos": return { output: diagnostics(args) };
      case "escrever_arquivo": return await changeTool([{ caminho: args.caminho, conteudo: args.conteudo || "" }], `O Adam quer escrever ${args.caminho}.`);
      case "editar_arquivo": {
        const edicoes = args.edicoes?.length ? args.edicoes : [{ procurar: args.procurar, substituir: args.substituir }];
        return await changeTool([{ caminho: args.caminho, edicoes }], `O Adam quer alterar ${args.caminho}. Veja a diferença no editor.`);
      }
      case "aplicar_alteracoes": return await changeTool(args.alteracoes || [], `O Adam quer aplicar: ${args.descricao || "alterações"} (${(args.alteracoes || []).length} arquivo(s)).`);
      case "excluir_arquivo": return await changeTool([{ caminho: args.caminho, excluir: true }], `O Adam quer excluir ${args.caminho}.`);
      case "renomear_arquivo": return await changeTool([{ caminho: args.de, novo_caminho: args.para }], `O Adam quer renomear ${args.de} → ${args.para}.`);
      case "desfazer": return await undo(args);
      case "ler_env": return await readEnv(args);
      case "executar_comando": return await runCommand(args);
      case "ler_processo": return readProcess(args);
      case "parar_processo": return stopProcess(args);
      case "consultar_banco": return await dbQuery(args);
      case "abrir_arquivo": {
        const doc = await vscode.workspace.openTextDocument(resolvePath(args.caminho));
        const pos = new vscode.Position(Math.max(0, (args.linha || 1) - 1), 0);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), preview: false });
        return { output: `Aberto ${args.caminho}` };
      }
      default: return { error: `Ferramenta desconhecida: ${name}` };
    }
  } catch (e) { return { error: e.message }; }
}

const proposedProvider = { provideTextDocumentContent: (u) => (u.query === "empty" ? "" : proposed.get(u.query) || "") };

module.exports = { init, beginTask, execTool, undo, projectMap, killAll, proposedProvider, SKIP, root, rel };
