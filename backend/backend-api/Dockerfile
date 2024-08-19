# Use the official Node.js image as the base image
FROM node:20-alpine3.19

# Create and set the working directory
WORKDIR /usr/src/app

# Copying the NestJS application
COPY backend/backend-api nestjs-ecs-cdk/backend/backend-api

# Copy the backend project and the root's package.json and package-lock.json
WORKDIR /usr/src/app/nestjs-ecs-cdk
COPY package*.json ./
COPY turbo.json ./

# Install dependencies
RUN npm install

# Build the NestJS application
RUN npm run build -- --filter=@nestjs-ecs-cdk/backend-api

# Expose the port the application runs on
EXPOSE 3001
# Define the command to run the application
CMD ["npm", "run", "start:prod", "--", "--filter=@nestjs-ecs-cdk/backend-api"]