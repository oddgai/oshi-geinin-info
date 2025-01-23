FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
ENV UV_PROJECT_ENVIRONMENT=/usr/local/

WORKDIR /app

# Copy uv.lock and install dependencies
COPY uv.lock .
COPY pyproject.toml .
RUN uv sync --frozen --no-cache

# Copy code
COPY . /app

CMD ["uv", "run", "streamlit", "run", "app.py", "--server.address", "0.0.0.0", "--server.port", "8501"]
