# Aplicativo desktop

[Read this README in English](README.md)

A interface desktop é desenvolvida com React, TypeScript, Vite+ e Tauri.

Na raiz do repositório, inicie a interface ou o aplicativo desktop com:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop dev
pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev
```

Use `tauri dev` para executar o fluxo integrado. O comando `dev` inicia apenas a interface no navegador; nesse modo, não há seleção nativa de pastas nem execução da CLI.

Quando aberta em um navegador comum, a interface carrega encontros fictícios e claramente identificados para permitir o desenvolvimento dos resultados, mapa, detalhes, filtros, paginação e exportação sem APIs nativas. O aplicativo Tauri não carrega esses dados simulados: ele inicia vazio e exibe somente resultados retornados pela CLI.

No navegador, inicie a análise de demonstração para ver a saída no estilo da CLI aparecer conforme cada conjunto de dados de exemplo é concluído. Os resumos seguem o formato da CLI, mas usam métricas sintéticas e não executam a CLI.

O primeiro fluxo desktop usa o processamento paralelo da CLI para cada arquivo `.txt` na pasta de entrada e grava arquivos JSON na pasta de saída. A ordenação externa em disco é usada como alternativa somente quando um conjunto de dados contém timestamps fora de ordem. As pastas padrão são `datasets/inputs` e `datasets/outputs`; ambas podem ser alteradas pelo seletor nativo de pastas. A aba da CLI exibe o estado inicial e o progresso à medida que cada conjunto começa e termina, além de eventuais erros de execução. O workspace mostra os encontros analisados em uma tabela com pesquisa, filtros e paginação; selecionar uma linha abre os detalhes, e o mapa exibe localmente as coordenadas do encontro com cores por tipo, legenda, resumo da seleção e controles de zoom. A exportação baixa todos os resultados em JSON. A janela Tauri usa controles personalizados para minimizar, maximizar/restaurar e fechar; arraste o cabeçalho para movê-la.

Os scripts do desktop compilam o motor e a CLI antes de iniciar a interface ou gerar a compilação do frontend. O desenvolvimento local usa o runtime Node.js instalado. Os instaladores de produção incluem a CLI, o runtime Node.js usado na compilação e, quando fornecida pelo ambiente de build, sua licença; assim, os usuários não precisam instalar Node.js nem obter o código-fonte. As pastas padrão de entrada e saída são criadas no diretório de dados do aplicativo do usuário no sistema operacional.

Compile o frontend desktop com:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop build
```

A interface desktop usa Fluent UI React v9 (`@fluentui/react-components`) e Fluent System Icons (`@fluentui/react-icons`). O dashboard é dividido em componentes independentes em `src/components/`, com estilos de layout compartilhados em `src/styles/`.

A interface usa o logotipo oficial da Spacecom, disponível em [spacecom.com.br](https://www.spacecom.com.br/imgs/logo-spc.svg), e um tema claro com as cores da marca.

A interface está disponível em espanhol, inglês e português brasileiro. O seletor de idioma fica no cabeçalho do aplicativo; a seleção é lembrada e, na primeira inicialização, o idioma do sistema é usado quando é inglês ou português. Nos demais casos, o padrão é espanhol.

## Releases

Envie uma tag `vX.Y.Z` após definir a mesma versão no `package.json`, em `src-tauri/tauri.conf.json` e em `src-tauri/Cargo.toml`. O workflow **Desktop release** do GitHub Actions compila instaladores para Windows x64, macOS Intel, macOS Apple silicon e Linux x64, e cria um rascunho de GitHub Release com os arquivos. Publique o rascunho após revisá-lo. Os instaladores do Windows não têm assinatura e podem exibir avisos do SmartScreen.

O workflow assina e notariza os DMGs do macOS quando estes secrets do repositório GitHub estão configurados: `APPLE_CERTIFICATE` (arquivo `.p12` de Developer ID Application codificado em base64), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (uma senha específica de app) e `APPLE_TEAM_ID`. Sem eles, os DMGs são gerados sem assinatura e notarização; o Gatekeeper pode bloquear o aplicativo, portanto não os publique como downloads prontos para produção.

## Configuração recomendada do IDE

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
