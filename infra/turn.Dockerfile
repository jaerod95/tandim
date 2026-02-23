FROM coturn/coturn:latest

EXPOSE 3478/udp
EXPOSE 3478/tcp

CMD ["--no-cli", "--fingerprint", "--lt-cred-mech", "--realm=tandim.local", "--listening-port=3478", "--min-port=49152", "--max-port=49200"]
