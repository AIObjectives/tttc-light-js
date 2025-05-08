
FROM python:3.11-slim
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy all code
COPY . .

EXPOSE $PORT
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
