FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies for audiowmark and Node.js
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libfftw3-dev \
    libsndfile1-dev \
    libgcrypt20-dev \
    libzita-resampler-dev \
    libmpg123-dev \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build audiowmark from source
RUN git clone https://github.com/swesterfeld/audiowmark.git /tmp/audiowmark \
    && cd /tmp/audiowmark \
    && mkdir build && cd build \
    && cmake .. \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && rm -rf /tmp/audiowmark

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY index.js .

EXPOSE 3000

CMD ["node", "index.js"]
