export default function AuthLayout({ children }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#212121]">
      <header className="px-6 py-5">
        <span className="text-[17px] font-semibold tracking-tight" data-testid="auth-logo">Adam</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="text-center mb-8 rise">
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Bem-vindo ao Adam</h1>
          <p className="text-sm text-zinc-400 mt-2">Converse, crie arquivos, sites, código e imagens.</p>
        </div>
        <div data-testid="auth-container">{children}</div>
      </main>
      <footer className="pb-6 text-center text-xs text-zinc-600">Criado por Felipe Hudson · Belo Horizonte</footer>
    </div>
  );
}
