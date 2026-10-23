# The image that serves the UI in production: nginx and the production build
# (docs/architecture.md, Packaging and Serving). scripts/image.sh builds it
# from the repository root after the production build; .containerignore keeps
# everything but dist/ and nginx/ out of the build context.

# The official unprivileged nginx image, pinned by version and digest and
# updated by Renovate.
FROM docker.io/nginxinc/nginx-unprivileged:1.31.7-alpine-slim@sha256:a8cb0f33d51fa107c96fd2bd3a71aaf564ec131e9d2bdf8700944f0ed8b170d7

# The base image's default site and server give way to the build and to the
# server of nginx/default.conf. The files belong to root, so the runtime user
# can read them but not change them.
USER root
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

# The base image's non-root user, declared numerically so that an orchestrator
# can verify that the container does not run as root.
USER 101:101
