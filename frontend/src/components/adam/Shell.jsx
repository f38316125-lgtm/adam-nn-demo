import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Sidebar from "@/components/adam/Sidebar";

export default function Shell() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <div className="h-[100dvh] flex bg-[#212121] text-zinc-100 overflow-hidden">
      <aside className="hidden md:flex w-[268px] shrink-0 bg-[#171717]">
        <Sidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-[#171717] border-white/10">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <button data-testid="mobile-menu-button" onClick={() => setOpen(true)}
          className="md:hidden absolute top-3 left-3 z-50 p-2 rounded-lg bg-white/5 border border-white/10">
          <Menu className="w-4 h-4" />
        </button>
        <Outlet key={loc.pathname.startsWith("/chat") || loc.pathname === "/" ? "chat" : loc.pathname} />
      </div>
    </div>
  );
}
