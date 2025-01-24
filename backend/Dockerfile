FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
ENV UV_PROJECT_ENVIRONMENT=/usr/local/
EXPOSE 8000

# set workdir
WORKDIR /app

# Copy uv.lock and install dependencies
COPY uv.lock .
COPY pyproject.toml .
RUN uv sync --frozen --no-cache

# Copy code
COPY . /app

# start uvicorn
CMD ["uv", "run", "uvicorn", "main:app", "--port", "8000", "--host", "0.0.0.0"]
