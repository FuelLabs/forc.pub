# Working with the Database for Forc.pub

This guide will help you set up and interact with the database.

## Installing Diesel

To use Diesel, you need the Diesel CLI and the Rust library.

```sh
# Mac only
brew install libpq

# Ubuntu only
apt-get install libpq5

# Install diesel CLI
cargo install diesel_cli --no-default-features --features postgres

# On macOS-arm64, you may need additional rust flags:
RUSTFLAGS='-L /opt/homebrew/opt/libpq/lib' cargo install diesel_cli --no-default-features --features postgres
```

The environment variables for connecting to the local database are set in `.env`.

## Creating a Table

1. **Generate a migration:**
   Run the following Diesel CLI command to create a new migration:
   ```bash
   diesel migration generate create_users
   ```
   This creates two files under `migrations/<timestamp>_create_users/`:
   - `up.sql`: Commands to apply the migration
   - `down.sql`: Commands to undo the migration

2. **Define the table in the `up.sql` file:**
   ```sql
    CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR NOT NULL,
        github_login VARCHAR NOT NULL UNIQUE,
        github_url VARCHAR NOT NULL,
        avatar_url VARCHAR,
        email VARCHAR,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
   ```

3. **Define the rollback in the `down.sql` file:**
   ```sql
   DROP TABLE users;
   ```

4. **Run the migration:**
   Execute the migration to apply the changes to your database:
   ```bash
   diesel migration run
   ```

## Viewing the Generated Schema

Diesel generates a Rust representation of your database schema in `src/schema.rs`.

The file will contain Rust definitions for your tables, like this:
```rust
diesel::table! {
    users (id) {
        id -> Uuid,
        full_name -> Varchar,
        github_login -> Varchar,
        github_url -> Varchar,
        avatar_url -> Nullable<Varchar>,
        email -> Nullable<Varchar>,
        is_admin -> Bool,
        created_at -> Timestamp,
    }
}
```

This schema is used in Diesel queries to ensure type safety.

## Using a Database Client

For easier database management and visualization, you can use a database client such as DBeaver.

1. **Install DBeaver:**
   Download and install DBeaver from [dbeaver.io](https://dbeaver.io/).

2. **Connect to your database:**
   - Open DBeaver and create a new database connection.
   - Select your database type (e.g., PostgreSQL).
   - Provide your database URL, username, and password (as specified in the `.env` file).

3. **Explore the database:**
   - View and edit tables, run SQL queries, and inspect relationships between tables.
   - This tool can be especially helpful for debugging and testing your database setup.

## Organizing Feature-Specific Modules

To keep the project modular and maintainable, create separate modules for each feature in `src/db`.

Multiple tables can be used for a single feature.
