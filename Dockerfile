FROM node:18-alpine

# Pre-baked Version
# ARG VERSION
# LABEL version ${VERSION}

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3001

CMD ["npm", "start"]