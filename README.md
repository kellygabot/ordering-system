# QuickOrder

QuickOrder is a food ordering system built with Node.js, Express, and MySQL. It includes a customer-facing menu, an order form with live stock checks, and a statistics dashboard for sales insights.

## Features

- Browse products that are currently in stock.
- Search the product catalog.
- Place orders with customer details and multiple items.
- Automatically update an existing customer when the same email is used again.
- Decrease inventory safely when an order is placed.
- View sales totals, best sellers, and commonly bought-together products.

## Tech Stack

- Node.js 22+
- Express 5
- MySQL 8.4
- Vanilla HTML, CSS, and JavaScript

## Project Structure

- `server.js` - Express server and API routes.
- `db.js` - MySQL connection setup.
- `public/` - Frontend pages and styles.
- `Dockerfile` - Container image for the Node app.
- `compose.yaml` - Docker Compose setup for the app and database.
- `setup.sql` - MySQL schema and sample data for local Docker runs.

## Requirements

- Node.js 22 or newer
- npm
- Docker and Docker Compose if you want the containerized setup
- MySQL 8.4 if you want to run the app without Docker

## Environment Variables

The app reads database settings from environment variables:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT` (optional, defaults to `3000`)

Example local `.env` file:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ordering_system_db
PORT=3000
```

## Run With Docker

The easiest way to run the app is with Docker Compose:

```bash
docker compose up --build
```

This starts MySQL, loads the schema and sample products from `setup.sql`, then starts the Node server. The app will be available at `http://localhost:3000`.

If you want the containerized app to use your own database instead of the bundled MySQL service, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in your `.env` file. The server container will use those values when they are present.

## Run Locally

1. Install dependencies.

```bash
npm install
```

2. Make sure MySQL is running and the schema exists.

3. Start the app.

```bash
npm start
```

4. Open the app.

```text
http://localhost:3000
```

## API Endpoints

### `GET /products`

Returns all products with stock greater than zero.

### `POST /order`

Creates a new order or updates an existing customer by email.

Request body:

```json
{
	"full_name": "Juan Dela Cruz",
	"email": "juan@email.com",
	"phone": "09171234567",
	"address": "Manila",
	"items": [
		{
			"product_id": 1,
			"quantity": 2,
			"price": 120.00
		}
	]
}
```

### `GET /stats/overview`

Returns total orders, total revenue, and total customers.

### `GET /stats/bestsellers`

Returns the top-selling products.

### `GET /stats/pairings`

Returns products that are commonly bought together.

## Frontend Pages

- `index.html` - landing page.
- `products.html` - searchable menu view.
- `order.html` - order placement page.
- `statistics.html` - statistics dashboard.

## Notes

- The server listens on the port defined by `PORT`, or `3000` by default.
- Order placement fails if any selected item does not have enough stock.
- The Docker setup uses a named volume for MySQL data, so data persists between restarts.
