FROM rust:1.83-slim-bookworm

RUN useradd -m -s /bin/bash runner && \
    mkdir -p /home/runner && \
    chown -R runner:runner /home/runner

USER runner
WORKDIR /home/runner

ENTRYPOINT ["cargo", "run", "--"]
