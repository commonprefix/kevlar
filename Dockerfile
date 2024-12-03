FROM node:alpine

WORKDIR /workspace
COPY . /workspace

RUN npm ci && npm run build && npm i -g .

CMD [ "kevlar" ]
EXPOSE 8546
