FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# We will use nodemon for development or just node for production
# Install nodemon globally for easier dev experience
RUN npm install -g nodemon

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
