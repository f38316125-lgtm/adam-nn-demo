(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  app.innerHTML = `
    <header>
      <span class="brand">Adam</span>
      <button id="undo" class="ghost" title="Desfazer as alterações da última tarefa">Desfazer</button>
      <button id="new" class="ghost" title="Nova conversa">Nova</button>
      <button id="cfg" class="ghost" title="Configurações">Ajustes</button>
    </header>
    <div class="bar">
      <select id="engine" title="Cérebro">
        <option value="auto">Adam Pro + Ollama reserva</option>
        <option value="pro">Somente Adam Pro</option>
        <option value="local">Somente Ollama local</option>
      </select>
      <select id="autonomia" title="Aprovações">
        <option value="perguntar">Pedir aprovação</option>
        <option value="edicoes">Aplicar edições sozinho</option>
        <option value="total">Autônomo total</option>
      </select>
    </div>
    <div id="keyWarn" class="warn hidden">Configure sua chave de API do Adam para usar o Adam Pro. <a id="setKey">Configurar chave</a></div>
    <main id="log"><div class="empty"><b>O que vamos construir?</b><br>“Implemente login com e-mail”, “Refaça o design da home”, “Corrija o erro do build”, “Quantos usuários tem no banco?”, “Desfaça a última mudança”.</div></main>
    <footer>
      <textarea id="input" rows="3" placeholder="Peça qualquer mudança no projeto (Enter envia, Shift+Enter quebra linha)"></textarea>
      <div class="row"><span id="status"></span><button id="stop" class="hidden">Parar</button><button id="send" class="primary">Enviar</button></div>
    </footer>`;
  const $ = (id) => document.getElementById(id);
  const log = $("log"), input = $("input");

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function md(text) {
    const parts = text.split(/```[\w-]*\n?/);
    return parts.map((p, i) => (i % 2 ? `<pre><code>${esc(p.replace(/\n$/, ""))}</code></pre>` :
      esc(p).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/^#{1,4} (.*)$/gm, "<b>$1</b>").replace(/^[-*] /gm, "• ").replace(/\n/g, "<br>"))).join("");
  }
  function add(cls, html) {
    log.querySelector(".empty")?.remove();
    const d = document.createElement("div");
    d.className = `msg ${cls}`;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function send() {
    const t = input.value.trim();
    if (!t) return;
    vscode.postMessage({ type: "task", text: t });
    input.value = "";
  }

  $("send").onclick = send;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  $("stop").onclick = () => vscode.postMessage({ type: "stop" });
  $("new").onclick = () => vscode.postMessage({ type: "new" });
  $("undo").onclick = () => vscode.postMessage({ type: "undo" });
  $("cfg").onclick = () => vscode.postMessage({ type: "settings" });
  $("setKey").onclick = () => vscode.postMessage({ type: "setKey" });
  $("engine").onchange = (e) => vscode.postMessage({ type: "engine", value: e.target.value });
  $("autonomia").onchange = (e) => vscode.postMessage({ type: "autonomia", value: e.target.value });

  window.addEventListener("message", ({ data: m }) => {
    if (m.type === "user") add("user", esc(m.text).replace(/\n/g, "<br>"));
    else if (m.type === "assistant") add("assistant", `<div class="who">${esc(m.engine || "Adam")}</div>${md(m.text)}`);
    else if (m.type === "tool") add(`tool ${m.ok === false ? "bad" : ""} ${m.edit ? "edit" : ""}`, esc(m.text));
    else if (m.type === "notice") add("notice", esc(m.text));
    else if (m.type === "error") add("error", esc(m.text));
    else if (m.type === "clear") log.innerHTML = "";
    else if (m.type === "busy") { $("stop").classList.toggle("hidden", !m.value); $("send").disabled = m.value; $("status").textContent = m.value ? "Trabalhando…" : ""; }
    else if (m.type === "state") { $("engine").value = m.engine; $("autonomia").value = m.autonomia || "perguntar"; $("keyWarn").classList.toggle("hidden", m.hasKey || m.engine === "local"); }
    else if (m.type === "ask") {
      const d = add("ask", `<div>${esc(m.text)}</div>${m.detail ? `<pre><code>${esc(m.detail)}</code></pre>` : ""}<div class="row"><button class="primary" data-ok="1">${esc(m.okLabel)}</button><button data-ok="0">Negar</button></div>`);
      d.id = `ask-${m.id}`;
      d.querySelectorAll("button").forEach((b) => (b.onclick = () => vscode.postMessage({ type: "answer", id: m.id, ok: b.dataset.ok === "1" })));
    } else if (m.type === "askDone") {
      const d = $(`ask-${m.id}`);
      if (d) d.querySelector(".row").outerHTML = `<div class="answered">${m.ok ? "Aprovado" : "Negado"}</div>`;
    }
  });
  vscode.postMessage({ type: "ready" });
})();
