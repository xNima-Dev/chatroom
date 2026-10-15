FROM node:20-alpine

WORKDIR /app

# Install dependencies first for cached layers
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose backend port
EXPOSE 5001

ENV NODE_ENV=production
ENV PORT=5001

CMD ["npm", "start"]
