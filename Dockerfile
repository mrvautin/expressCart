FROM mhart/alpine-node:8

ENV NODE_VERSION 8.9.4

WORKDIR /var/expressCart

COPY bin/ /var/expressCart/bin/
COPY config/ /var/expressCart/config/
COPY public/ /var/expressCart/public/
COPY routes/ /var/expressCart/routes/
COPY views/ /var/expressCart/views/

COPY app.js /var/expressCart/
COPY package.json /var/expressCart/
COPY gulpfile.js /var/expressCart/

RUN npm install

VOLUME /var/expressCart/data

EXPOSE 1111
ENTRYPOINT ["npm", "start"]