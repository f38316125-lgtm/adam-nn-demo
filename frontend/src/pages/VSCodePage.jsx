import { Bug, Database, Download, FileSearch, Palette, RotateCcw, ShieldCheck, SquareTerminal, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { BACKEND_URL, errMsg, useApi } from "@/lib/api";
import PageHeader from "@/components/adam/PageHeader";

const STEPS = [
  <>Baixe o arquivo <code className="text-zinc-100">adam-vscode.vsix</code> no botão acima.</>,
  <>No VS Code, abra a aba Extensões (Ctrl+Shift+X), clique em <b>⋯</b> → <b>Instalar do VSIX…</b> e escolha o arquivo.</>,
  <>Em <Link to="/api" className="text-zinc-100 underline">API & Chaves</Link>, gere uma chave. No VS Code, rode o comando <b>Adam: Configurar chave de API</b> (Ctrl+Shift+P) e cole a chave.</>,
  <>Abra seu projeto, clique no ícone do Adam na barra lateral e peça o que quiser.</>,
  <>Ollama de reserva: deixe o <code className="text-zinc-100">ollama serve</code> rodando com <code className="text-zinc-100">qwen2.5</code> em <code className="text-zinc-100">http://localhost:11434</code>. Se o Adam Pro não responder, a extensão passa para ele sozinha. Dá para trocar em Configurações → Adam.</>,
];

const CAPS = [
  { icon: FileSearch, t: "Entende o projeto", d: "Mapeia a árvore, manifests, .env e git antes de agir." },
  { icon: Wand2, t: "Implementa", d: "De pequenas edições a funcionalidades inteiras em vários arquivos." },
  { icon: Bug, t: "Corrige bugs", d: "Lê erros, logs e diagnósticos e acha a causa raiz." },
  { icon: Palette, t: "Design e UI/UX", d: "Refaz telas, estilos e componentes seguindo o projeto." },
  { icon: SquareTerminal, t: "Roda código", d: "Build, testes, scripts e servidores em segundo plano." },
  { icon: Database, t: "Banco e .env", d: "Consulta MongoDB, Postgres, MySQL e SQLite e lê credenciais." },
  { icon: RotateCcw, t: "Desfaz", d: "Cada mudança vira um ponto de restauração." },
  { icon: ShieldCheck, t: "Você decide", d: "Pedir aprovação, aplicar edições sozinho ou autônomo total." },
];

export default function VSCodePage() {
  const api = useApi();
  const download = async () => {
    try {
      const r = await api.get("/vscode/download", { params: { server: BACKEND_URL }, responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data);
      a.download = "adam-vscode.vsix";
      a.click();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="flex-1 overflow-y-auto scroll-thin">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <PageHeader eyebrow="Code Agent · VS Code" title="O Adam dentro do seu editor"
          subtitle="Um agente completo dentro do VS Code: lê e entende o projeto inteiro, implementa, corrige, redesenha, roda código, acessa o banco e desfaz alterações.">
          <button onClick={download} data-testid="vscode-download-button"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">
            <Download className="w-4 h-4" /> Baixar extensão (.vsix)
          </button>
        </PageHeader>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
          {CAPS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="p-5 rounded-xl bg-[#2A2A2A] border border-white/[0.06]">
              <Icon className="w-5 h-5 text-zinc-100 mb-3" />
              <p className="font-display">{t}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <h2 className="font-display text-xl mb-5">Como instalar</h2>
        <ol className="space-y-3" data-testid="vscode-steps">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4 p-4 rounded-xl bg-[#2A2A2A] border border-white/[0.07]">
              <span className="font-mono text-sm text-zinc-100 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm text-zinc-300">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-zinc-500 mt-6">Já tem a versão antiga? Baixe e instale de novo para receber a versão 2.0. Exemplos: “Corrija o erro que aparece no build” · “Adicione paginação na lista de produtos” · “Refaça o design da home” · “Quantos usuários existem no banco?” · “Desfaça a última tarefa”. Clique com o botão direito no código para “Explicar / revisar a seleção” ou “Corrigir erros do arquivo aberto”.</p>
      </div>
    </div>
  );
}
