FROM golang:1.23-bookworm

RUN useradd -m -s /bin/bash runner && \
    mkdir -p /home/runner && \
    chown -R runner:runner /home/runner

USER runner
WORKDIR /home/runner
