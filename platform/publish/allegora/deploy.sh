#!/usr/bin/env bash
# Allegora's whole-SFS search on Google Cloud (docs/allegora-gcp.md). Run from the repository root.
#
#   bash platform/publish/allegora/deploy.sh setup    # once, by the project owner: accounts, roles, key
#   bash platform/publish/allegora/deploy.sh raw      # warehouse/raw/sfs -> gs://<bucket>/raw/sfs
#   bash platform/publish/allegora/deploy.sh build    # the image, with Cloud Build
#   bash platform/publish/allegora/deploy.sh index    # the Cloud Run job: chunk and embed, about an hour
#   bash platform/publish/allegora/deploy.sh serve    # the Cloud Run service, which reads the new index
#
# Everything is in europe-west4, next to the bucket. The job runs as allegora-batch (Vertex AI user,
# object admin on the bucket); the service as allegora-search (Vertex AI user, object viewer, the
# key's secret accessor). The service skips Cloud Run's IAM check and checks X-Allegora-Key instead,
# which only the Worker holds (Cloudflare secret ALLEGORA_SEARCH_KEY). No key file exists.
set -euo pipefail
# Git Bash on Windows would rewrite the /data in these arguments to a Windows path.
export MSYS2_ARG_CONV_EXCL="volume=;publish/"
PROJECT=allegora-513419
REGION=europe-west4
BUCKET=allegora-513419-batch
IMAGE=${IMAGE:-$REGION-docker.pkg.dev/$PROJECT/allegora/allegora:$(git rev-parse --short HEAD)}
BATCH=allegora-batch@$PROJECT.iam.gserviceaccount.com
SEARCH=allegora-search@$PROJECT.iam.gserviceaccount.com
VOLUME=(--add-volume "name=data,type=cloud-storage,bucket=$BUCKET"
        --add-volume-mount "volume=data,mount-path=/data")
gc() { gcloud --project "$PROJECT" "$@"; }

case "${1:-}" in
  setup)
    gc services enable run.googleapis.com cloudbuild.googleapis.com \
      artifactregistry.googleapis.com secretmanager.googleapis.com
    gc artifacts repositories create allegora --repository-format=docker --location="$REGION" || true
    gc iam service-accounts create allegora-search --display-name "Allegora search" || true
    gc projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SEARCH" \
      --role roles/aiplatform.user --condition=None --format=none
    gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SEARCH" \
      --role roles/storage.objectViewer --format=none
    gc secrets describe allegora-search-key >/dev/null 2>&1 ||
      gc secrets create allegora-search-key --replication-policy=user-managed --locations="$REGION"
    if ! gc secrets versions describe latest --secret allegora-search-key >/dev/null 2>&1; then
      openssl rand -base64 32 | tr -d '\r\n' | gc secrets versions add allegora-search-key --data-file=-
    fi
    gc secrets add-iam-policy-binding allegora-search-key --member "serviceAccount:$SEARCH" \
      --role roles/secretmanager.secretAccessor --format=none
    # The job runs as allegora-batch, so whoever deploys it must be able to act as it.
    gc iam service-accounts add-iam-policy-binding "$BATCH" \
      --member "user:$(gcloud config get-value account)" --role roles/iam.serviceAccountUser --format=none
    ;;
  raw)
    gcloud storage rsync -r warehouse/raw/sfs "gs://$BUCKET/raw/sfs"
    ;;
  build)
    stage=$(mktemp -d)
    mkdir -p "$stage/ingest/sfs" "$stage/publish/allegora"
    cp platform/ingest/sfs/chunking.py "$stage/ingest/sfs/"
    cp platform/publish/allegora/{Dockerfile,vertex.py,sfs_index.py,search_service.py,retrieval.py} \
      "$stage/publish/allegora/"
    mv "$stage/publish/allegora/Dockerfile" "$stage/"
    gc builds submit "$stage" --region "$REGION" --tag "$IMAGE"
    ;;
  index)
    gc run jobs deploy allegora-index --region "$REGION" --image "$IMAGE" \
      --service-account "$BATCH" --cpu 2 --memory 4Gi --task-timeout 3h --max-retries 0 \
      "${VOLUME[@]}" --command python \
      --args publish/allegora/sfs_index.py,--raw,/data/raw/sfs,--out,/data/index
    gc run jobs execute allegora-index --region "$REGION" --wait
    ;;
  serve)
    gc run deploy allegora-search --region "$REGION" --image "$IMAGE" \
      --service-account "$SEARCH" --cpu 1 --memory 2Gi --min-instances 0 --max-instances 1 \
      --concurrency 20 --timeout 60 --cpu-boost --no-invoker-iam-check \
      "${VOLUME[@]}" --set-secrets ALLEGORA_KEY=allegora-search-key:latest
    ;;
  *)
    sed -n '3,8p' "$0"
    exit 2
    ;;
esac
