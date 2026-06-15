#!/usr/bin/env bash
#
# Build the AgentArms tunnel-agent Docker image.
#
# Produces a small, self-contained image so the tunnel agent can run inside a
# private network with only Docker installed (no Python / pip required).
#
# Usage:
#   ./build.sh                 # build image tagged agentarms-tunnel-agent:latest
#   IMAGE_TAG=v1 ./build.sh    # custom tag
#   ./build.sh --save          # also export an offline tarball (docker save)
#
set -euo pipefail

: "${IMAGE_NAME:=agentarms-tunnel-agent}"
: "${IMAGE_TAG:=latest}"
: "${PLATFORM:=linux/amd64}"

IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SAVE=0
for arg in "$@"; do
  case "$arg" in
    --save) SAVE=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

echo "==> Building ${IMAGE} (${PLATFORM})"
docker build --platform "${PLATFORM}" -t "${IMAGE}" "${SCRIPT_DIR}"

echo "==> Built ${IMAGE}"
docker images "${IMAGE_NAME}" --format '    {{.Repository}}:{{.Tag}}  {{.Size}}'

if [[ "${SAVE}" -eq 1 ]]; then
  TARBALL="${SCRIPT_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar"
  echo "==> Exporting offline image to ${TARBALL}"
  docker save "${IMAGE}" -o "${TARBALL}"
  echo "    Load on the target host with: docker load -i $(basename "${TARBALL}")"
fi

cat <<EOF

==> Done. Run the tunnel agent (http-proxy mode for private ElasticSearch/OpenSearch):

  docker run --rm --name tunnel-agent ${IMAGE} \\
    --registry https://agent-arms.seanguo.people.aws.dev \\
    --token tnl_xxxxxxxx \\
    --mode http-proxy \\
    --local https://internal-es:9200 \\
    --es-user <user> --es-pass <pass> \\
    --no-verify-certs

For MCP servers (default mode):

  docker run --rm ${IMAGE} \\
    --registry https://agent-arms.seanguo.people.aws.dev \\
    --token tnl_xxxxxxxx \\
    --local http://host.docker.internal:8080/mcp

Note: to reach a service on the Docker host, use host.docker.internal
(add --add-host=host.docker.internal:host-gateway on Linux).
EOF
