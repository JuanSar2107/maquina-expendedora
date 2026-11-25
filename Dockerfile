# Una sola imagen base con dos destinos:
#   - cadena: el nodo Hardhat (chainId 31337) con las cuentas de prueba desbloqueadas.
#   - pagina: el frontend compilado, servido por nginx, que reenvía /rpc a la cadena.

FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# ---------- Cadena ----------
FROM dependencias AS cadena
ENV HARDHAT_DISABLE_TELEMETRY_PROMPT=true
EXPOSE 8545
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0", "--port", "8545"]

# ---------- Página ----------
FROM dependencias AS compilacion
# Ruta relativa: la página habla con el mismo dominio que la sirve, y nginx la reenvía a la cadena.
ARG VITE_RPC_URL=/rpc
ENV VITE_RPC_URL=$VITE_RPC_URL
RUN npm run build

FROM nginx:1.27-alpine AS pagina
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 80
