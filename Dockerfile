# Build Stage ---
#
# Use the official lightweight Node.js 10 image.
# https://hub.docker.com/_/node
FROM node:10 AS build

ENV NODE_OPTIONS=--max-old-space-size=768

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy local code to the container image.
COPY . ./

# build the app.
RUN ./node_modules/gulp/bin/gulp.js production


# Release Stage ---
#
FROM node:10-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

COPY --from=build /usr/src/app ./

# suppress Error: ENOENT in log output
RUN touch .env

ENV NODE_ENV production

# Run the web service on container startup.
CMD [ "npm", "start" ]


###
#
#  Docker build with
#  $ docker build -t mcbapp:latest ./
#
#  Start container with
#  $ docker run -p 3000:3000 --env-file .env -e 'MONGOLAB_URI=mongodb://mcb_user:88ilikecats88@172.17.0.1/mcb_test' mcbapp:latest
#
###
