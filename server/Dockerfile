FROM node:slim AS frontend-build

WORKDIR /app

COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# -------------------------
FROM node:slim AS server-build

WORKDIR /app
COPY server/ ./server/
RUN cd server && npm ci && npx tsc

FROM node:slim

# Create app directory
WORKDIR /app

ENV TZ Europe/Lisbon


RUN apt update
RUN apt install -y ca-certificates
COPY server/metrolisboa.crt /usr/local/share/ca-certificates/sectigo.crt
COPY server/package*.json /app/server/

# build Node CA bundle explicitly
RUN cat /etc/ssl/certs/ca-certificates.crt \
/usr/local/share/ca-certificates/sectigo.crt \
> /etc/ssl/certs/node-extra-ca.pem

RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/node-extra-ca.pem

COPY --from=frontend-build /app/frontend/dist frontend
COPY --from=server-build /app/server/dist server



WORKDIR /app/server
RUN npm ci --omit=dev

EXPOSE 3069
CMD [ "node", "server.js" ]

