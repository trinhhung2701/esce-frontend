FROM node:20 AS build
WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci --silent

# copy sources and build
COPY . ./
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
