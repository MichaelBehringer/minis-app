FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

# Erstellen Sie das endgültige Image auf Basis von Apache
FROM httpd:2.4-alpine

COPY --from=build /app/build/ /usr/local/apache2/htdocs/
