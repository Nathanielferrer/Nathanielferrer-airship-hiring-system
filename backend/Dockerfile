FROM php:8.2-apache

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache rewrite and headers modules
RUN a2enmod rewrite headers

# Allow .htaccess overrides in Apache document root
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Set working directory and copy backend code
WORKDIR /var/www/html
COPY . /var/www/html/

# Copy startup script, strip any Windows CRLF line endings, and make executable
COPY start.sh /usr/local/bin/start.sh
RUN tr -d '\r' < /usr/local/bin/start.sh > /usr/local/bin/start_clean.sh \
    && mv /usr/local/bin/start_clean.sh /usr/local/bin/start.sh \
    && chmod +x /usr/local/bin/start.sh

# Create required upload and private directories with proper permissions
RUN mkdir -p /var/www/html/uploads/templates \
    && mkdir -p /var/www/html/private/resumes \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/uploads \
    && chmod -R 775 /var/www/html/private

ENTRYPOINT ["/bin/bash", "/usr/local/bin/start.sh"]
