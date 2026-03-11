FROM node:22-slim

RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
