# Node Monitor

Seus processos Node.js e portas TCP, em uma janela só. Encontre o que está rodando, descubra quem está usando uma porta e encerre processos com confirmação.

## Instalação

Baixe a versão para **Linux** ou **Windows** na página de [releases](https://github.com/brunofunnie/node-monitor/releases). No Linux, torne o AppImage executável (`chmod +x *.AppImage`) e abra-o. No Windows, execute o instalador.

## Desenvolvimento

Instale o Node.js (versão 22 ou superior) e execute:

```sh
npm ci
npm start
```

Para rodar os testes:

```sh
npm test
```

Para gerar um pacote no sistema atual:

```sh
npm run dist
```

## O que você pode fazer

- Buscar por processo, PID, comando ou porta; pressione `/` para focar a busca.
- Ver processos Node, memória residente, portas TCP em escuta e processos pais. A lista é atualizada a cada cinco segundos.
- Consultar todas as portas TCP em escuta na aba **Portas**; somente processos Node podem ser encerrados.
- Identificar comandos MCP e alguns harnesses de IA, incluindo Claude Code, Codex e Gemini CLI. A identificação depende dos caminhos e comandos reconhecidos.
- Agrupar processos por diretório, encerrar um grupo com confirmação e manter o aplicativo na bandeja do sistema.
- Ativar detalhes adicionais e inicialização automática nas configurações.

No Windows, o diretório de trabalho de outros processos não está disponível e, por isso, eles não são agrupados por diretório. Permissões do sistema podem limitar as informações ou impedir o encerramento. O encerramento não inclui automaticamente processos filhos; no Linux ele envia SIGTERM. Portas UDP não são exibidas.

Os ícones dos harnesses são carregados da internet; os nomes continuam disponíveis sem conexão.
