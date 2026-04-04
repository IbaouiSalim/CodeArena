FROM python:3.12-slim

RUN useradd -m -s /bin/bash runner && \
    mkdir -p /home/runner && \
    chown -R runner:runner /home/runner

USER runner
WORKDIR /home/runner

ENTRYPOINT ["python3"]
