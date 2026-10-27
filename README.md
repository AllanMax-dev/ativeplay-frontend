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