FROM alpine:3.24.2 AS apk-tools

FROM n8nio/n8n:2.41.3

USER root

COPY --from=apk-tools /sbin/apk /sbin/apk
RUN apk add --no-cache nmap udev chromium harfbuzz freetype font-freefont nss && \
    rm /sbin/apk

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER node
