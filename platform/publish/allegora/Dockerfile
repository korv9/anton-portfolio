# Allegora's index job (sfs_index.py) and search service (search_service.py), one image.
# deploy.sh builds it from a staging folder with these files and chunking.py at ingest/sfs/.
FROM python:3.12-slim
RUN pip install --no-cache-dir numpy==2.4.2
WORKDIR /app
COPY ingest/sfs/chunking.py ingest/sfs/chunking.py
COPY publish/allegora/vertex.py publish/allegora/sfs_index.py publish/allegora/search_service.py publish/allegora/
ENV PYTHONUNBUFFERED=1
CMD ["python", "publish/allegora/search_service.py"]
