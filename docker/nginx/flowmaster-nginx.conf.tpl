# HTTPS-шаблон для docker-compose.tls.yml (Let's Encrypt через nginx-certbot).
# Переменные: PROXY_DOMAIN

resolver 127.0.0.11 valid=10s ipv6=off;

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    server_name ${PROXY_DOMAIN};
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/${PROXY_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${PROXY_DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${PROXY_DOMAIN}/chain.pem;
    ssl_dhparam /etc/letsencrypt/dhparams/dhparam.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    client_max_body_size 500m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Port $server_port;

    large_client_header_buffers 4 16k;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    set $flowmaster_app http://app:3000;
    set $flowmaster_kong http://kong:8000;

    location /auth {
        proxy_pass $flowmaster_kong;
    }

    location /rest {
        proxy_pass $flowmaster_kong;
    }

    location /graphql {
        proxy_pass $flowmaster_kong;
    }

    location /realtime/ {
        proxy_pass $flowmaster_kong;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
    }

    location /storage/v1/ {
        proxy_pass $flowmaster_kong;
        proxy_buffering off;
        proxy_request_buffering off;
        chunked_transfer_encoding off;
        client_max_body_size 0;
    }

    location /functions {
        proxy_pass $flowmaster_kong;
    }

    location /mcp {
        proxy_pass $flowmaster_kong;
    }

    location /sso {
        proxy_pass $flowmaster_kong;
    }

    location / {
        proxy_pass $flowmaster_app;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
