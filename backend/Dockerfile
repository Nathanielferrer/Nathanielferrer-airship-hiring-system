FROM php:8.2-apache

# Fix Apache MPM conflict (ensures only mpm_prefork is loaded)
RUN a2dismod mpm_event || true \
    && a2dismod mpm_worker || true \
    && a2enmod mpm_prefork

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache rewrite and headers modules
RUN a2enmod rewrite headers

# Allow .htaccess overrides in Apache document root
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Set working directory and copy backend code
WORKDIR /var/www/html
COPY . /var/www/html/

# Create required upload and private directories with proper permissions
RUN mkdir -p /var/www/html/uploads/templates \
    && mkdir -p /var/www/html/private/resumes \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/uploads \
    && chmod -R 775 /var/www/html/private

# Configure Apache to listen on Railway's dynamic PORT environment variable
CMD sed -i "s/Listen 80/Listen ${PORT:-80}/g" /etc/apache2/ports.conf \
    && sed -i "s/:80/:${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf \
    && apache2-foreground
