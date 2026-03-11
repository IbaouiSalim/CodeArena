FROM rust:1.83-slim-bookworm

RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
