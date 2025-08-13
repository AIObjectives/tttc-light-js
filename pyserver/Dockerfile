FROM python:3.11-slim
WORKDIR /app

COPY pyserver/requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

RUN useradd --no-create-home appuser
COPY --chown=appuser pyserver/ .

ENV PORT=8000
EXPOSE $PORT

USER appuser

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
