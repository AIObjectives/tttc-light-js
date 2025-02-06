FROM python:3.11-slim
WORKDIR /app
# Copy requirements and install dependencies
COPY pyserver/requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
# Copy application code
COPY pyserver/ .
EXPOSE $PORT
# Use shell form to allow environment variable expansion
CMD uvicorn main:app --host 0.0.0.0 --port $PORT