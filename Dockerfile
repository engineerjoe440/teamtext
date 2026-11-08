# Build the frontend assets and Jinja template.
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

COPY frontend/ ./
WORKDIR /app
COPY teamtext/ ./teamtext/
WORKDIR /app/frontend
RUN yarn build

FROM python:3.15-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY teamtext/ ./teamtext/
COPY --from=frontend-builder /app/teamtext/static/frontend/ ./teamtext/static/frontend/
COPY --from=frontend-builder /app/teamtext/templates/index.html ./teamtext/templates/index.html

EXPOSE 80
CMD ["uvicorn", "teamtext.main:app", "--host", "0.0.0.0", "--port", "80", "--forwarded-allow-ips", "*"]
