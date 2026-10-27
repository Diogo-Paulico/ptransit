FROM alpine:edge

RUN apk add --no-cache \
    bash \
    curl \
    wget \
    postgresql-client \
    unzip \
    moreutils \
    nodejs \
    npm

RUN npm install -g gtfs-via-postgres

WORKDIR /app

COPY populate.sh populate.sh
RUN chmod +x populate.sh


ENTRYPOINT ["/bin/bash", "populate.sh"]

