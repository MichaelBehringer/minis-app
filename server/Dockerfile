# Erstellen Sie ein temporäres Build-Image
FROM golang:1.25.3 AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY ./ ./

RUN CGO_ENABLED=0 GOOS=linux go build -o ./server

# Erstellen Sie das endgültige Image auf Basis von Distroless
FROM gcr.io/distroless/base

COPY --from=build /app/server /app/server
COPY --from=build /app/ressources/ /app/ressources/

WORKDIR /app

CMD ["./server"]
