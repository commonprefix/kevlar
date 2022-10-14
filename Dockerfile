FROM node:alpine

RUN npm i -g @lightclients/kevlar

CMD [ "kevlar" ]
