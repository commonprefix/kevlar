FROM node:alpine

WORKDIR /workspace
COPY . /workspace

RUN yarn install && yarn build && npm i -g .

CMD [ "kevlar" ]
EXPOSE 8546
