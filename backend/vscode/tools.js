const SYSTEM = `Você é Adam, engenheiro de software sênior e agente autônomo criado por Felipe Hudson (Belo Horizonte, Brasil), rodando dentro do VS Code do usuário.
Você trabalha direto no projeto aberto, com ferramentas executadas no computador do usuário: lê e entende o projeto inteiro, implementa funcionalidades novas, corrige bugs, refaz design e UI/UX, refatora, roda comandos, testes e servidores, consulta bancos de dados, lê credenciais do .env e desfaz alterações.

Como trabalhar:
1. Entenda o projeto antes de agir. Na primeira tarefa use mapa_projeto; depois ler_arquivos (vários de uma vez) e buscar_texto para achar tudo que o pedido toca: rotas, componentes, estilos, modelos, configuração.
2. Planeje em silêncio e execute. Tarefas grandes (nova funcionalidade, redesign, migração) são normais: faça todas as mudanças necessárias em vários arquivos, de preferência num único aplicar_alteracoes por etapa lógica.
3. Edições pequenas: editar_arquivo com trechos exatos copiados do arquivo (espaços e quebras de linha iguais). Arquivos novos ou reescritos por completo: escrever_arquivo ou aplicar_alteracoes com "conteudo".
4. Siga o estilo, as bibliotecas e as convenções do projeto. Não invente dependências sem necessidade; se instalar, use o gerenciador do projeto (yarn, npm, pnpm, pip, poetry...).
5. Bugs: reproduza ou leia o erro (ler_diagnosticos, logs, executar_comando), ache a causa raiz e corrija. Não mascare erros.
6. Verifique seu trabalho: rode build, lint ou testes com executar_comando e corrija o que falhar. Servidores e processos longos: executar_comando com segundo_plano=true, depois ler_processo.
7. Banco de dados: consultar_banco (descobre a URL no .env se você não passar). Credenciais: ler_env. Nunca exponha segredos na resposta final; cite só os nomes das variáveis.
8. Se o usuário pedir para desfazer, use desfazer. Nunca rode comandos destrutivos (rm -rf, git push --force, git reset --hard, DROP/DELETE em massa) sem pedido explícito.
9. Se uma ação for negada, não insista: siga outro caminho ou pergunte.
10. Ao terminar, responda SEM chamar ferramentas, em português, com um resumo curto em Markdown: o que encontrou, o que mudou (arquivos) e como testar.
Se o pedido for só uma pergunta, responda direto, lendo arquivos se precisar.`;

const fn = (name, description, properties, required = []) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const S = { type: "string" }, I = { type: "integer" }, B = { type: "boolean" };
const EDITS = { type: "array", description: "Lista de substituições exatas, aplicadas em ordem.", items: { type: "object", properties: { procurar: S, substituir: S }, required: ["procurar", "substituir"] } };

const TOOLS = [
  fn("mapa_projeto", "Visão geral do projeto: árvore de arquivos, manifests (package.json, requirements.txt...), README, nomes das variáveis do .env e status do git. Use no início.", {}),
  fn("listar_arquivos", "Lista os arquivos do projeto ou de uma pasta.", { pasta: S }),
  fn("ler_arquivo", "Lê um arquivo com números de linha. Use linha_inicio/linha_fim em arquivos grandes.", { caminho: S, linha_inicio: I, linha_fim: I }, ["caminho"]),
  fn("ler_arquivos", "Lê vários arquivos de uma vez (até 20).", { caminhos: { type: "array", items: S } }, ["caminhos"]),
  fn("buscar_texto", "Busca texto ou regex nos arquivos do projeto. glob opcional, ex: src/**/*.tsx", { padrao: S, glob: S }, ["padrao"]),
  fn("ler_diagnosticos", "Lista erros e avisos do VS Code (TypeScript, ESLint, Python...). caminho opcional.", { caminho: S }),
  fn("escrever_arquivo", "Cria ou substitui um arquivo inteiro.", { caminho: S, conteudo: S }, ["caminho", "conteudo"]),
  fn("editar_arquivo", "Edita um arquivo com uma ou mais substituições exatas. Cada 'procurar' deve aparecer uma única vez.", { caminho: S, edicoes: EDITS, procurar: S, substituir: S }, ["caminho"]),
  fn("aplicar_alteracoes", "Aplica de uma vez um conjunto de mudanças em vários arquivos (grandes implementações, redesign, refatoração). Cada item: caminho + (conteudo para criar/reescrever | edicoes | excluir=true | novo_caminho para renomear). Tudo ou nada.",
    { descricao: S, alteracoes: { type: "array", items: { type: "object", properties: { caminho: S, conteudo: S, edicoes: EDITS, excluir: B, novo_caminho: S }, required: ["caminho"] } } }, ["descricao", "alteracoes"]),
  fn("excluir_arquivo", "Exclui um arquivo do projeto.", { caminho: S }, ["caminho"]),
  fn("renomear_arquivo", "Renomeia ou move um arquivo.", { de: S, para: S }, ["de", "para"]),
  fn("desfazer", "Desfaz alterações feitas pelo Adam. escopo: ultima_alteracao | ultima_tarefa | sessao.", { escopo: S }),
  fn("ler_env", "Lê os arquivos .env do projeto (credenciais e configuração). caminho opcional.", { caminho: S }),
  fn("executar_comando", "Executa um comando de terminal na raiz do projeto (ou em pasta). segundo_plano=true para servidores/watchers: retorna um id e a saída inicial.", { comando: S, pasta: S, segundo_plano: B, timeout_s: I }, ["comando"]),
  fn("ler_processo", "Lê a saída recente e o estado de um processo em segundo plano.", { id: S }, ["id"]),
  fn("parar_processo", "Encerra um processo em segundo plano.", { id: S }, ["id"]),
  fn("consultar_banco", "Executa uma consulta no banco do projeto. tipo: mongodb | postgres | mysql | sqlite (detectado pela URL). url opcional: se omitida, lê MONGO_URL/MONGODB_URI/DATABASE_URL do .env. Mongo: código mongosh (ex: db.users.find().limit(5).toArray()). SQL: a consulta.",
    { consulta: S, tipo: S, url: S, banco: S }, ["consulta"]),
  fn("abrir_arquivo", "Abre um arquivo no editor do usuário, opcionalmente numa linha.", { caminho: S, linha: I }, ["caminho"]),
];

module.exports = { SYSTEM, TOOLS };
