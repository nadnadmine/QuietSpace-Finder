FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua file
COPY . .

# Generate dataset dan train model saat build
RUN python dataset/generate_dataset.py && python train_model.py

EXPOSE 5001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5001"]