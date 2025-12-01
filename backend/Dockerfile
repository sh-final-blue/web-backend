# Base image: Python 3.12 slim
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# System packages including Node.js
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    git \
    vim \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Google Generative AI Python client
RUN pip install --no-cache-dir google-generativeai

# Install CLIs (Node.js)
RUN npm install -g @google/gemini-cli
RUN npm install -g @openai/codex

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
