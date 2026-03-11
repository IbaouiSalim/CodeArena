FROM gcc:13

RUN useradd -m -s /bin/bash runner
USER runner
WORKDIR /home/runner
