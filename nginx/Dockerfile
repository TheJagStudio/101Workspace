FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY workspace.conf /etc/nginx/conf.d/workspace.conf

# Create SSL directory (certificates must be mounted or copied in)
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
