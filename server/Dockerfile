# Bauen
FROM golang:1.27-alpine AS build

WORKDIR /app

# Erst die Manifeste: solange sich die Abhaengigkeiten nicht aendern, kommt
# dieser Schritt aus dem Cache.
COPY go.mod go.sum ./
RUN go mod download

COPY ./ ./

# CGO aus: erzeugt ein statisch gebundenes Programm, das ohne C-Bibliotheken
# laeuft - Voraussetzung fuer das distroless-Image unten.
RUN CGO_ENABLED=0 GOOS=linux go build -o ./server

# Ausliefern
#
# distroless/static statt base: das Programm ist statisch gebunden und braucht
# keine glibc. Fester Tag statt latest, damit ein Neubau reproduzierbar bleibt.
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=build /app/server /app/server
# Schriften und Logo fuer die PDF-Erzeugung. Werden zur Laufzeit gelesen.
COPY --from=build /app/ressources/ /app/ressources/

# Nicht als root, das Image bringt dafuer den Benutzer "nonroot" mit.
USER nonroot:nonroot

EXPOSE 8080

CMD ["./server"]
