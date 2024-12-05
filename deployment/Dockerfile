# Stage 1: Build
FROM lukemathwalker/cargo-chef:latest-rust-1.79 as chef
WORKDIR /build/
# hadolint ignore=DL3008

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    lld \
    clang \
    libclang-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Build forc.pub
FROM chef as planner
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder

# Install the latest 20 versions of forc with cargo-binstall
RUN curl -L --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh | bash
RUN tags=$(curl -s "https://api.github.com/repos/FuelLabs/sway/tags?per_page=20" | grep '"name"' | sed -E 's/.*"name": "v?([^"]+)".*/\1/') && \
    echo "Tags fetched from the repository:" && \
    for tag in $tags; do \
      echo "Tag: $tag" && \
      cargo binstall --no-confirm --root "/usr/local/cargo/bin/forc-$tag" --pkg-url="https://github.com/FuelLabs/sway/releases/download/v$tag/forc-binaries-linux_arm64.tar.gz" --bin-dir="forc-binaries/forc" --pkg-fmt="tgz" forc; \
    done

ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
COPY --from=planner /build/recipe.json recipe.json
# Build our project dependecies, not our application!
RUN cargo chef cook --recipe-path recipe.json
# Up to this point, if our dependency tree stays the same,
# all layers should be cached.
COPY . .
RUN cargo build

# Stage 2: Run
FROM ubuntu:22.04 as run

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends ca-certificates curl git libpq5 \
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root/

COPY --from=builder /usr/local/cargo/bin/forc-* .
COPY --from=builder /build/target/debug/forc_pub .
COPY --from=builder /build/target/debug/forc_pub.d .
COPY --from=builder /build/Rocket.toml .

EXPOSE 8080

CMD ["./forc_pub"]
