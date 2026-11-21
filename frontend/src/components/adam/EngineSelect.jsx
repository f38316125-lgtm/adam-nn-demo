import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ENGINES } from "@/lib/api";
import { useAdam } from "@/lib/adamContext";

export default function EngineSelect() {
  const { engine, setEngine } = useAdam();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="engine-selector-dropdown"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[15px] font-medium text-zinc-100 hover:bg-white/[0.06] outline-none transition-colors">
        {ENGINES[engine].label}
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 bg-[#2F2F2F] border-white/10 p-1.5 rounded-xl shadow-xl">
        {Object.entries(ENGINES).map(([key, e]) => (
          <DropdownMenuItem key={key} data-testid={`engine-option-${key}`} onClick={() => setEngine(key)}
            className="flex items-start gap-3 p-3 rounded-lg cursor-pointer focus:bg-white/[0.06]">
            <div className="flex-1">
              <p className="text-sm text-zinc-100">{e.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{e.sub}</p>
            </div>
            {engine === key && <Check className="w-4 h-4 text-zinc-100 mt-0.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
