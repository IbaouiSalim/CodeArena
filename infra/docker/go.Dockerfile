FROM golang:1.23-bookworm

RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
