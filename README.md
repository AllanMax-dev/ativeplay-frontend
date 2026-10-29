# ativeplay-frontend

## Rodar localmente

Requisitos: Node.js LTS e Docker (para o banco e a API do backend).

1. Suba o backend (repositório `ativeplay-backend`): o Postgres no Docker e a API em http://localhost:8080.

   ```bash
   cd ../ativeplay-backend
   cp .env.example .env                                          # só na primeira vez
   docker compose up -d db
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev,seed    # no Windows: mvnw.cmd
   ```

   O perfil `seed` carrega os dados de demonstração e recria o escritório demo a cada inicialização. Nas próximas vezes, `./mvnw spring-boot:run` basta, mas o `seed` só recarrega os dados se você incluí-lo.

2. Crie o `.env.local` na raiz deste repositório (o `.env.example` tem o mesmo valor):

   ```bash
   cp .env.example .env.local
   ```

   ```text
   NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
   ```

3. Instale as dependências e rode o front:

   ```bash
   npm ci
   npm run dev
   ```

4. Abra http://localhost:5173 (porta definida no script `dev`) e entre com `admin@ativeplay.dev` / `Ativeplay@123` (dados do seed local).

A origem `http://localhost:5173` precisa estar em `CORS_ORIGINS` do backend, o que já vem por padrão no `.env.example`. A API de produção não aceita `localhost` no CORS, de propósito: para desenvolver, use sempre o backend local, que não toca no banco de produção.

## Área do cliente (Tarefas do dia)

- **Filtro por empresa:** em Tarefas do dia, escolha um cliente da sua carteira (Usuários → Carteira de empresas). ADMIN e GESTOR veem todas e podem marcar "Somente minha carteira". Cada opção mostra tarefas abertas/total, atrasadas e pendências de checklist (`GET /tarefas/ocorrencias/empresas`).
- **Contador geral:** ao entrar em um cliente (pelo filtro, pelo botão "Abrir" em Empresas ou ao iniciar uma tarefa dele) o contador geral começa; trocar de empresa mostra o aviso "Continuar com a empresa atual / Finalizar atual e abrir próxima". O contador fica no topo de todas as telas com o botão Finalizar. Os cronômetros por tarefa continuam iguais (`/sessoes/iniciar`, `/sessoes/encerrar`, `/sessoes/resumo`).
- **Checklist:** aba do cliente com itens de observação pontual (prazo, responsável, prioridade, sub-itens e observações), abas Pendentes/Concluídos.
- **Senhas salvas:** aba do cliente com acessos (bancos, certificado, portais…), clique para copiar usuário/senha, revelar por 20 s, link de acesso. Controlada pelo módulo "Senhas salvas" em Permissões.
- **Painel:** ADMIN/GESTOR veem "Tempo por cliente × honorário" (últimos 30 dias, `/sessoes/rentabilidade`).

A URL guarda o cliente e a aba: `/tarefas?empresa=<id>&aba=checklist|senhas`.
