ARG BUILD_FROM
FROM ${BUILD_FROM}
RUN apk add --no-cache python3 openssl tzdata
WORKDIR /app
COPY server.py /app/server.py
COPY run.sh /run.sh
COPY login.html login.css login.js /app/www/
COPY www/ /app/www/
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
