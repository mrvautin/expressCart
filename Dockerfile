FROM node:16.13.0

ENV NODE_VERSION 16.13.0

RUN apk add --no-cache make gcc g++ python bash

WORKDIR /var/expressCart

COPY lib/ /var/expressCart/lib/
COPY bin/ /var/expressCart/bin/
COPY config/ /var/expressCart/config/
COPY public/ /var/expressCart/public/
COPY routes/ /var/expressCart/routes/
COPY views/ /var/expressCart/views/
COPY locales/ /var/expressCart/locales/

COPY app.js /var/expressCart/
COPY package.json /var/expressCart/
COPY deploy.js /var/expressCart/

RUN npm install

VOLUME /var/expressCart/data

EXPOSE 1111
ENTRYPOINT ["npm", "start"]
