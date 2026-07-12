#!/usr/bin/env bash
# Renews the Let's Encrypt certificate via the HTTP-01 webroot challenge and
# reloads nginx in-place (no downtime) if a new certificate was issued.
set -euo pipefail

REPO_ROOT="${WALP_REPO_ROOT:-/opt/walp-tabletop}"
WEBROOT="$REPO_ROOT/certbot-webroot"

certbot renew --webroot -w "$WEBROOT" --quiet --deploy-hook \
  "docker exec walp-nginx nginx -s reload"
