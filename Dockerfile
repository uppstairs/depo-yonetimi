FROM python:3.12-slim

WORKDIR /app

COPY . .

EXPOSE 8787

CMD ["python3", "backend/server.py"]
