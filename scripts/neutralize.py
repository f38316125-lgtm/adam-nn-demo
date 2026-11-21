import re, pathlib

ROOT = pathlib.Path("/app/frontend/src")
FILES = [p for p in ROOT.rglob("*.js*") if "/ui/" not in str(p)]

LIT = [
    ("bg-gradient-to-r from-[#F4A261] to-[#E07A5F] text-white", "bg-white text-black"),
    ("bg-gradient-to-r from-[#F4A261] to-[#E07A5F]", "bg-white text-black"),
    ("bg-gradient-to-t from-[#090A0F] via-[#090A0F] to-transparent", "bg-[#212121]"),
    ("bg-gradient-to-r from-[#090A0F] to-transparent", "bg-[#212121]/85"),
    ("bg-gradient-to-t from-[#090A0F] via-[#090A0F]/70 to-transparent", "bg-[#171717]/80"),
    ("bg-gradient-to-br from-white/5 to-white/[0.02]", "bg-white/5"),
    ("bg-gradient-to-t from-black/80 to-transparent", "bg-black/70"),
    (" pulse-node", ""),
]
HEX = {"#090A0F": "#212121", "#0D0E15": "#171717", "#12141D": "#2A2A2A", "#181A26": "#303030",
       "#0c0d14": "#0D0D0D", "#0B0C12": "#171717", "#06070B": "#171717"}
ACC = r"(?:F4A261|E07A5F|2A9D8F|8338EC|3A86FF)"
HUE = r"(?:emerald|orange|amber|purple|sky|blue|violet|teal|cyan|indigo|pink|fuchsia|green|yellow|lime)"


def tint(prefix, kind, solid):
    if kind == "text":
        return f"{prefix}text-zinc-100"
    if kind == "bg":
        return f"{prefix}bg-zinc-200" if solid else f"{prefix}bg-white/[0.06]"
    if kind in ("border", "ring"):
        return f"{prefix}{kind}-white/20"
    if kind == "accent":
        return f"{prefix}accent-zinc-200"
    return f"{prefix}{kind}-zinc-300"


def sub_classes(s):
    s = re.sub(r"((?:[a-z-]+:)*)(text|bg|border|ring|accent|from|to|via)-\[#" + ACC + r"\](/[\d.\[\]]+)?",
               lambda m: tint(m.group(1), m.group(2), not m.group(3)), s)
    s = re.sub(r"((?:[a-z-]+:)*)(text|bg|border|ring|accent)-" + HUE + r"-(\d{2,3})(/[\d.\[\]]+)?",
               lambda m: tint(m.group(1), m.group(2), not m.group(4)) if m.group(2) != "text" or int(m.group(3)) < 400
               else f"{m.group(1)}text-zinc-300", s)
    return s


for p in FILES:
    s = o = p.read_text()
    for a, b in LIT:
        s = s.replace(a, b)
    s = re.sub(r'<span className="adam-gradient-text">([^<]+)</span>', r"\1", s)
    s = re.sub(r'\s*<span className="w-2(?:\.5)? h-2(?:\.5)? rounded-full bg-\[#F4A261\]" />', "", s)
    s = sub_classes(s)
    for a, b in HEX.items():
        s = s.replace(a, b)
    s = re.sub(r'"#(?:F4A261|E07A5F|8338EC|2A9D8F)"', '"#ECECEC"', s)
    s = s.replace("bg-white text-black text-white", "bg-white text-black")
    if s != o:
        p.write_text(s)
        print("updated", p.relative_to(ROOT))
