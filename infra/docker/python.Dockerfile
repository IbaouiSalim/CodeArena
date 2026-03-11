FROM python:3.12-slim

RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
