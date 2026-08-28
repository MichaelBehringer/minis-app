# Bauen
FROM node:24-alpine AS build

WORKDIR /app

# Erst die Manifeste, dann der Rest: solange sich die Abhaengigkeiten nicht
# aendern, kommt dieser Schritt aus dem Cache.
COPY package.json package-lock.json ./
# npm ci statt npm install: installiert genau die Versionen aus dem Lockfile
# und schlaegt fehl, wenn es nicht dazu passt. npm install haette den Lockfile
# im Build stillschweigend veraendert.
RUN npm ci

COPY . .
RUN npm run build

# Ausliefern
#
# nginx statt httpd: nur damit gibt es Kompression und Cache-Header. Der
# Startpfad geht dadurch von rund 900 kB auf etwa 300 kB ueber die Leitung.
FROM nginx:1.30-alpine

COPY ui-nginx.conf /etc/nginx/conf.d/default.conf
# Vite schreibt nach dist/, react-scripts hat nach build/ geschrieben.
COPY --from=build /app/dist/ /usr/share/nginx/html/
