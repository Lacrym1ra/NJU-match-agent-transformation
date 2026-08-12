FROM mcr.microsoft.com/devcontainers/universal:2

USER root

# The focal-based universal image still carries an expired Yarn APT key.
# Docker-in-Docker refreshes APT metadata during Feature installation, so
# remove the unused repository before the Feature layer is built.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    /etc/apt/sources.list.d/yarn.sources
