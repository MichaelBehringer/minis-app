#!/bin/bash
certbot renew
cp -L /etc/letsencrypt/live/ministranten.dynv6.net/privkey.pem /home/ubuntu/minis-app/certs/privkey.pem
cp -L /etc/letsencrypt/live/ministranten.dynv6.net/fullchain.pem /home/ubuntu/minis-app/certs/fullchain.pem