<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="LocalSlides" width="96" />

  # LocalSlides

  **Editor de apresentações 100% offline — canvas posicional, sem nuvem, sem telemetria.**
</div>

---

LocalSlides é um editor de apresentações (estilo PowerPoint/Impress) focado em privacidade e
simplicidade. Diferente de um editor de texto, cada slide é um **canvas**: cada elemento
(texto, imagem, vídeo, forma, tabela) tem posição e tamanho absolutos e você arrasta livremente.
App irmão do [LocalOffice](https://github.com/Anon5T4R/LocalOffice) (documentos),
[LocalSheets](https://github.com/Anon5T4R/LocalSheets) (planilhas) e
[LocalCode](https://github.com/Anon5T4R/LocalCode) (código).

## ✨ Recursos

- **Canvas posicional** com mover, redimensionar (Shift mantém proporção), rotacionar e **snapping** com guias de alinhamento.
- **Texto rico** (TipTap/ProseMirror) dentro das caixas, com barra de formatação flutuante.
- **Elementos**: caixas de texto livres, **imagens** (incl. arrastar-e-soltar do sistema), **vídeos** (tocam na apresentação), **formas** (SVG) e **tabelas**.
- **Organização**: camadas (z-order), opacidade, contorno, agrupar/desagrupar, alinhar e distribuir.
- **Apresentação**: tela cheia com **transições** entre slides e **animações** de entrada dos elementos.
- **Formato nativo `.tslides`** (zip: `deck.json` + `media/`), autosave e desfazer/refazer ilimitado.
- **Tema** claro/escuro. Tudo na sua máquina, **zero telemetria**.

## 🧱 Stack

- **Tauri 2** (Rust) — shell nativo leve
- **React 19 + TypeScript + Vite** — interface
- **Zustand + immer** — estado central com histórico (undo/redo via snapshots)
- **TipTap** — texto rico dentro das caixas
- **JSZip** — empacotamento do `.tslides`

## 🚀 Rodando em desenvolvimento

Pré-requisitos: **Rust** (toolchain MSVC no Windows), **Node 18+**, e as
[dependências do Tauri](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

Para gerar o instalável:

```bash
npm run tauri build   # Windows: instalador NSIS em src-tauri/target/release/bundle/nsis
```

Releases automáticas para **Windows (instalador) + Linux (AppImage)** saem via GitHub Actions
(`.github/workflows/release.yml`) ao publicar uma tag `v*`.

## 💡 Filosofia

Todo o software é **open-source** (MIT). A monetização não é o software (livre para todos),
e sim a instalação facilitada e modelos GGUF próprios para a IA local que está a caminho.

## 📄 Licença

Código sob licença **MIT** (veja [LICENSE](LICENSE)).
