FROM python:3.9-slim

WORKDIR /app/Workspace101

# Install PostgreSQL client libraries for psycopg2
RUN apt-get update && \
    apt-get install -y libpq-dev gcc && \
    apt-get clean

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /app/Workspace101

EXPOSE 9876

CMD ["python", "manage.py", "runserver", "0.0.0.0:9876"]