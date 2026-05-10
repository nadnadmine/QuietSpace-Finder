FROM php:8.2.12-apache

# Install required system packages and PHP extensions
RUN apt-get update && apt-get install -y \
    libicu-dev \
    libzip-dev \
    zip \
    unzip \
    git \
    && docker-php-ext-configure intl \
    && docker-php-ext-install intl pdo pdo_mysql mysqli zip sockets bcmath \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set DocumentRoot to public/ for CodeIgniter 4
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# We will copy composer.json and install dependencies
# Note: since we use volume mounting in dev, we should run composer install locally or on startup
COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-autoloader

COPY . .

RUN composer dump-autoload --optimize

# Make spark executable
RUN chmod +x spark
