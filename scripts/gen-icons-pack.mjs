// Gera src/model/iconsPack.ts a partir do @mdi/js (Material Design Icons,
// Apache-2.0 — paths de 24x24 preenchidos, mesmo contrato do icons.ts).
// Rodar: node scripts/gen-icons-pack.mjs
//
// O pack sai num módulo próprio importado dinamicamente (aba Ícones), então o
// tamanho dele não pesa no carregamento inicial do app.

import * as mdi from "@mdi/js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Traduções PT-BR para os tokens mais comuns do nome — viram tags de busca.
const PT = {
  account: "conta pessoa", alert: "alerta atenção", arrow: "seta", bag: "bolsa",
  bank: "banco", battery: "bateria", beach: "praia", bell: "sino", bike: "bicicleta",
  book: "livro", bookmark: "favorito", box: "caixa", brain: "cérebro", bridge: "ponte",
  briefcase: "maleta trabalho", brush: "pincel", bug: "inseto erro", bus: "ônibus",
  cake: "bolo", calculator: "calculadora", calendar: "calendário agenda",
  camera: "câmera foto", car: "carro", card: "cartão", cart: "carrinho compras",
  cash: "dinheiro", cat: "gato", chart: "gráfico", chat: "conversa mensagem",
  check: "confirmar ok", chevron: "seta", church: "igreja", circle: "círculo",
  city: "cidade", clipboard: "prancheta", clock: "relógio hora", close: "fechar x",
  cloud: "nuvem", coffee: "café", cog: "engrenagem configurações", comment: "comentário",
  compass: "bússola", cow: "vaca", credit: "crédito cartão", crown: "coroa",
  cup: "copo xícara", currency: "moeda dinheiro", delete: "apagar lixeira",
  diamond: "diamante", dice: "dado", dog: "cachorro", dolphin: "golfinho",
  door: "porta", download: "baixar", earth: "mundo terra planeta", egg: "ovo",
  email: "email correio", emoticon: "emoji rosto", eye: "olho ver", face: "rosto",
  factory: "fábrica", file: "arquivo documento", film: "filme", filter: "filtro",
  finance: "finanças", fire: "fogo chama", fish: "peixe", flag: "bandeira meta",
  flash: "raio", flask: "frasco química", flower: "flor", folder: "pasta",
  food: "comida", forest: "floresta", fridge: "geladeira", gamepad: "videogame jogo",
  gas: "combustível", gift: "presente", glass: "copo taça", glasses: "óculos",
  gold: "ouro", golf: "golfe", guitar: "violão guitarra", hammer: "martelo",
  hand: "mão", hanger: "cabide", head: "cabeça", headphones: "fone", heart: "coração amor",
  help: "ajuda dúvida", home: "casa início", horse: "cavalo", hospital: "hospital",
  hourglass: "ampulheta", human: "pessoa", image: "imagem foto", information: "informação",
  key: "chave", keyboard: "teclado", knife: "faca", label: "etiqueta", ladder: "escada",
  lamp: "luminária", laptop: "notebook", leaf: "folha natureza", library: "biblioteca",
  lightbulb: "lâmpada ideia", lightning: "raio", link: "link corrente", lock: "cadeado senha",
  magnify: "lupa buscar pesquisar", mail: "correio email", map: "mapa", marker: "marcador",
  medal: "medalha prêmio", medical: "médico saúde", menu: "menu", message: "mensagem",
  microphone: "microfone", minus: "menos", monitor: "monitor tela", moon: "lua",
  mouse: "mouse rato", movie: "filme cinema", music: "música", nature: "natureza",
  needle: "agulha", newspaper: "jornal notícia", note: "nota anotação", nut: "porca parafuso",
  office: "escritório", oil: "óleo", package: "pacote caixa", palette: "paleta cores",
  panda: "panda", paper: "papel", paw: "pata", pen: "caneta", pencil: "lápis editar",
  phone: "telefone", piano: "piano", pig: "porco", pill: "remédio", pine: "pinheiro",
  pizza: "pizza", play: "reproduzir play", plus: "mais adicionar", pot: "panela",
  power: "energia ligar", printer: "impressora", puzzle: "quebra-cabeça", rabbit: "coelho",
  radio: "rádio", rocket: "foguete lançamento", ruler: "régua", run: "correr",
  sale: "promoção venda", school: "escola educação", scissors: "tesoura",
  screwdriver: "chave de fenda", seal: "selo foca", send: "enviar", server: "servidor",
  share: "compartilhar", shield: "escudo proteção segurança", ship: "navio",
  shoe: "sapato tênis", shopping: "compras", shovel: "pá", silverware: "talheres comida",
  sitemap: "organograma", sleep: "dormir", snowflake: "neve floco", soccer: "futebol",
  sofa: "sofá", speaker: "caixa de som", star: "estrela favorito", store: "loja",
  sun: "sol", sword: "espada", sync: "sincronizar", table: "tabela mesa", tag: "etiqueta",
  target: "alvo meta", taxi: "táxi", tea: "chá", television: "televisão tv",
  temperature: "temperatura", tennis: "tênis", tent: "barraca", thermometer: "termômetro",
  thumb: "polegar curtir", ticket: "ingresso", timer: "cronômetro tempo",
  tools: "ferramentas", tooth: "dente", tortoise: "tartaruga", train: "trem",
  tree: "árvore natureza", trophy: "troféu prêmio", truck: "caminhão entrega",
  umbrella: "guarda-chuva", update: "atualizar", upload: "enviar subir", video: "vídeo",
  view: "visualizar", wallet: "carteira", watch: "relógio pulso", water: "água",
  weather: "clima tempo", web: "internet rede", weight: "peso academia",
  wheelchair: "cadeira de rodas acessibilidade", wifi: "wifi internet", window: "janela",
  wrench: "chave inglesa ferramenta", account_group: "equipe time",
};

// Nomes já cobertos pelo pack core (src/model/icons.ts) — evita duplicata visual.
const CORE = new Set([
  "star", "heart", "check", "bolt", "bell", "home", "user", "info", "warning",
  "location", "mail", "phone", "clock", "cloud", "camera", "thumbup", "lock",
  "gift", "search", "settings", "close", "add", "remove", "arrowforward",
  "arrowback", "download", "upload", "share", "calendar", "cart", "play",
  "pause", "volumeup", "wifi", "flag", "book", "school", "work", "restaurant",
  "flight", "car", "musicnote", "headset", "videocam", "mic", "print", "folder",
  "document", "link", "code", "build", "lightbulb", "send", "target", "sunny",
  "umbrella",
]);

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function humanize(name) {
  const words = kebab(name).split("-");
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const entries = [];
for (const [exportName, path] of Object.entries(mdi)) {
  if (!exportName.startsWith("mdi") || typeof path !== "string") continue;
  const name = exportName.slice(3); // "mdiAccountGroup" -> "AccountGroup"
  if (CORE.has(name.toLowerCase())) continue;
  const words = kebab(name).split("-");
  const pt = new Set();
  for (const w of words) {
    if (PT[w]) for (const t of PT[w].split(" ")) pt.add(t);
  }
  const label = humanize(name);
  // Tupla compacta: [nome, label, tagsPT, path] — o módulo expande em IconDef.
  entries.push([kebab(name), label, [...pt].join(" "), path]);
}

entries.sort((a, b) => a[0].localeCompare(b[0]));

const header = `// GERADO por scripts/gen-icons-pack.mjs — não editar à mão.
// Fonte: @mdi/js (Material Design Icons, licença Apache-2.0 / Pictogrammers).
// Importado APENAS via import() dinâmico (aba Ícones) para não pesar o bundle inicial.

import type { IconDef } from "./icons";

// [name, label, tagsPT (separadas por espaço), path]
type Row = [string, string, string, string];

const ROWS: Row[] = `;

const footer = `;

export const ICONS_PACK: IconDef[] = ROWS.map(([name, label, tags, path]) => ({
  name: \`mdi-\${name}\`,
  label,
  path,
  tags: tags ? tags.split(" ") : undefined,
}));
`;

const out = header + JSON.stringify(entries) + footer;
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "model", "iconsPack.ts");
writeFileSync(dest, out, "utf8");
console.log(`iconsPack.ts: ${entries.length} ícones, ${(out.length / 1024 / 1024).toFixed(2)} MB`);
