import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Activity, BookOpen, Brain, Chrome, Code, Cpu, FolderOpen, KeyRound, LogOut, Plus, Search, SlidersHorizontal, SquarePen, SquareTerminal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAdam } from "@/lib/adamContext";
import { ENGINES, useApi } from "@/lib/api";

const NAV = [
  { to: "/memoria", label: "Memória", icon: Brain, id: "memory" },
  { to: "/conhecimento", label: "Base de Conhecimento", icon: BookOpen, id: "knowledge" },
  { to: "/arquivos", label: "Arquivos e Sites", icon: FolderOpen, id: "files" },
  { to: "/laboratorio", label: "Laboratório Neural", icon: Activity, id: "lab" },
];
const MORE = [
  { to: "/vscode", label: "Extensão VS Code", icon: SquareTerminal, id: "vscode" },
  { to: "/extensao", label: "Extensão Chrome", icon: Chrome, id: "extension" },
  { to: "/widget", label: "Widget para Sites", icon: Code, id: "widget" },
  { to: "/api", label: "API & Chaves", icon: KeyRound, id: "api" },
  { to: "/configuracoes", label: "Configurações", icon: Cpu, id: "settings" },
];
const PERIODS = [["all", "Tudo"], ["1d", "24h"], ["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"]];

function groupOf(iso) {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return "Últimos 7 dias";
  if (days < 30) return "Últimos 30 dias";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function Highlight({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="bg-white/[0.06] text-zinc-100 rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function ConversationItem({ c, active, onNavigate, q }) {
  const api = useApi();
  const { refresh } = useAdam();
  const navigate = useNavigate();
  const del = async (e) => {
    e.preventDefault();
    await api.delete(`/conversations/${c.id}`);
    toast.success("Conversa excluída");
    refresh();
    if (active) navigate("/");
  };
  return (
    <Link to={`/chat/${c.id}`} onClick={onNavigate} data-testid={`conversation-item-${c.id}`}
      className={`group flex items-start gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-[#2F2F2F] text-white" : "text-zinc-300 hover:bg-[#262626] hover:text-white"}`}>
      <span className="flex-1 min-w-0">
        <span className="block truncate"><Highlight text={c.title} q={q} /></span>
        {c.snippet && <span className="block text-[11px] text-zinc-500 line-clamp-2 mt-0.5"><Highlight text={c.snippet} q={q} /></span>}
      </span>
      <button onClick={del} data-testid={`conversation-delete-${c.id}`} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity mt-0.5">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </Link>
  );
}

function Filters({ f, setF }) {
  const chip = (on) => `px-2 py-1 rounded-md text-[11px] border transition-colors ${on ? "border-white/20 bg-white/[0.06] text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`;
  return (
    <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3 rise" data-testid="history-filters">
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-1.5">Período</p>
        <div className="flex flex-wrap gap-1">{PERIODS.map(([k, l]) => <button key={k} onClick={() => setF({ ...f, period: k })} data-testid={`history-period-${k}`} className={chip(f.period === k)}>{l}</button>)}</div>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-1.5">Motor</p>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setF({ ...f, engine: "" })} data-testid="history-engine-all" className={chip(!f.engine)}>Todos</button>
          {Object.entries(ENGINES).map(([k, e]) => <button key={k} onClick={() => setF({ ...f, engine: k })} data-testid={`history-engine-${k}`} className={chip(f.engine === k)}>{e.label}</button>)}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={f.scope === "all"} onChange={(e) => setF({ ...f, scope: e.target.checked ? "all" : "title" })} data-testid="history-scope-checkbox" />
        Buscar também dentro das mensagens
      </label>
    </div>
  );
}

function History({ onNavigate }) {
  const api = useApi();
  const { conversations } = useAdam();
  const { id } = useParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ period: "all", engine: "", scope: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState(null);
  const active = q.trim() || f.period !== "all" || f.engine;

  useEffect(() => {
    if (!active) return setResults(null);
    const t = setTimeout(() => {
      api.get("/conversations/search", { params: { q: q.trim(), ...f } }).then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, f, active, api, conversations]);

  const list = results ?? conversations;
  const groups = useMemo(() => {
    const g = [];
    for (const c of list) {
      const k = groupOf(c.updated_at);
      if (!g.length || g[g.length - 1][0] !== k) g.push([k, []]);
      g[g.length - 1][1].push(c);
    }
    return g;
  }, [list]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 pt-4">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-xs font-medium text-zinc-500">Histórico</p>
          <span className="text-xs text-zinc-600" data-testid="history-count">{active ? `${list.length} resultado(s)` : conversations.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#212121] border border-white/[0.08] focus-within:border-white/20">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversas…" data-testid="history-search-input"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-zinc-600" />
            {q && <button onClick={() => setQ("")} data-testid="history-search-clear" className="text-zinc-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} data-testid="history-filters-toggle" title="Busca avançada"
            className={`p-2 rounded-lg border transition-colors ${showFilters || f.period !== "all" || f.engine ? "border-white/20 text-zinc-100 bg-white/[0.06]" : "border-white/10 text-zinc-400 hover:text-white"}`}>
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        {showFilters && <Filters f={f} setF={setF} />}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-history px-2 pt-2 pb-3" data-testid="conversation-list">
        {list.length === 0 && <p className="px-3 py-4 text-xs text-zinc-600">{active ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}</p>}
        {groups.map(([label, items]) => (
          <div key={label} className="mb-2">
            <p className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-500 first-letter:uppercase">{label}</p>
            <div className="space-y-0.5">{items.map((c) => <ConversationItem key={c.id} c={c} active={c.id === id} onNavigate={onNavigate} q={q.trim()} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, id, onNavigate }) {
  return (
    <NavLink to={to} onClick={onNavigate} data-testid={`sidebar-${id}-link`}
      className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-[#2F2F2F] text-white" : "text-zinc-300 hover:bg-[#262626] hover:text-white"}`}>
      <Icon className="w-4 h-4 text-zinc-400" /> {label}
    </NavLink>
  );
}

function UserFooter({ onNavigate }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress;
  const logout = () => signOut({ redirectUrl: "/sign-in" });
  return (
    <div className="p-2 border-t border-white/[0.06]" data-testid="sidebar-user">
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="sidebar-user-menu" className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#262626] outline-none transition-colors text-left">
          {user?.imageUrl ? <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full" /> : <span className="w-8 h-8 rounded-full bg-[#2F2F2F]" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm truncate">{name}</span>
            <span className="block text-xs text-zinc-500 truncate">{user?.fullName ? user?.primaryEmailAddress?.emailAddress : "Conta Adam"}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64 bg-[#2F2F2F] border-white/10 rounded-xl p-1.5">
          {MORE.map(({ to, label, icon: Icon, id }) => (
            <DropdownMenuItem key={to} data-testid={`sidebar-${id}-link`} onClick={() => { navigate(to); onNavigate?.(); }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-zinc-200 focus:bg-white/[0.06]">
              <Icon className="w-4 h-4 text-zinc-400" /> {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={logout} data-testid="sidebar-logout-menu-item" className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-zinc-200 focus:bg-white/[0.06]">
            <LogOut className="w-4 h-4 text-zinc-400" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button onClick={logout} data-testid="sidebar-logout-button"
        className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-[#262626] hover:text-white transition-colors">
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </div>
  );
}

export default function Sidebar({ onNavigate }) {
  return (
    <div className="flex flex-col w-full h-full">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <Link to="/" onClick={onNavigate} className="px-2 py-1.5 text-[17px] font-semibold tracking-tight" data-testid="sidebar-logo">Adam</Link>
        <Link to="/" onClick={onNavigate} title="Nova conversa" data-testid="new-chat-icon-button" className="p-2 rounded-lg text-zinc-400 hover:bg-[#262626] hover:text-white transition-colors">
          <SquarePen className="w-[18px] h-[18px]" />
        </Link>
      </div>
      <nav className="px-2 mt-1 space-y-0.5" data-testid="sidebar-nav">
        <Link to="/" onClick={onNavigate} data-testid="new-chat-button" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-[#262626] hover:text-white transition-colors">
          <Plus className="w-4 h-4 text-zinc-400" /> Nova conversa
        </Link>
        {NAV.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}
      </nav>
      <History onNavigate={onNavigate} />
      <UserFooter onNavigate={onNavigate} />
    </div>
  );
}
