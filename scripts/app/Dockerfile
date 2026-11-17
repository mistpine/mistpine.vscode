# The environment pnpm verify and pnpm render run VS Code and Cursor in:
# Xvfb, the libraries Electron needs, JetBrains Mono, git and Node 24 (which
# drives the app through Playwright). The apps themselves are downloaded to
# .cache/ on the host and mounted, so the image doesn't change per version.
ARG BASE=ubuntu:24.04
FROM ${BASE}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      xvfb xauth dbus-x11 ca-certificates curl xz-utils git imagemagick \
      libnss3 libgtk-3-0t64 libgbm1 libasound2t64 libxkbfile1 libsecret-1-0 \
      libxshmfence1 libxss1 libdrm2 libatk-bridge2.0-0t64 libcups2t64 \
      fonts-jetbrains-mono fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*
ARG NODE=24.22.3
RUN curl -fsSL "https://nodejs.org/dist/v${NODE}/node-v${NODE}-linux-x64.tar.xz" \
  | tar -xJ -C /usr/local --strip-components=1 --exclude=CHANGELOG.md --exclude=README.md --exclude=LICENSE
# The containers run as the host's uid and gid (docker.ts). ubuntu images
# have uid 1000 already; a CI runner is 1001.
ARG UID=1000
ARG GID=1000
RUN getent group "$GID" >/dev/null || groupadd -g "$GID" mistpine \
 && { getent passwd "$UID" >/dev/null || useradd -u "$UID" -g "$GID" -M -d /tmp/home mistpine; }
