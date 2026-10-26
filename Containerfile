# The image that serves the UI in production: nginx and the production build
# (docs/architecture.md, Packaging and Serving). scripts/image.sh builds it
# from the repository root after the production build; .dockerignore keeps
# everything but dist/ and nginx/ out of the build context. For a local
# preview, scripts/image.sh package builds it from a context that holds only
# a production build of a pull request and nginx/ of this checkout.

# The official unprivileged nginx image, pinned by version and digest and
# updated by Renovate.
FROM docker.io/nginx/nginx-unprivileged:1.31.8-alpine-slim@sha256:629d3227f39ec10201345e420e2d9d430e463a9893d374b515a8eb6541e71938

# The base image's default site and server give way to the build and to the
# server of nginx/default.conf. The build belongs to root, so the runtime user
# can read it but not change it.
USER root
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

# The base image's non-root user, declared numerically so that an orchestrator
# can verify that the container does not run as root.
USER 101:101
