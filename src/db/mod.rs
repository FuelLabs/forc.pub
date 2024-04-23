mod error;
mod user_session;

use self::error::DatabaseError;
use crate::{api, models, schema};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use dotenvy::dotenv;
use std::env;
use uuid::Uuid;

pub type DbPool = Pool<ConnectionManager<PgConnection>>;
pub type DbConnection = PooledConnection<ConnectionManager<PgConnection>>;

/// The representation of a SQL database connection pool and its operations.
pub struct Database {
    pub pool: DbPool,
}

impl Default for Database {
    fn default() -> Self {
        Database::new()
    }
}

impl Database {
    pub fn new() -> Self {
        // Create a connection pool
        dotenv().ok();
        let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
        let pool = Pool::builder()
            .build(ConnectionManager::<PgConnection>::new(database_url))
            .expect("db connection pool");

        // Run migrations
        const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
        let mut connection = pool.get().expect("db connection");
        let migrations = connection
            .run_pending_migrations(MIGRATIONS)
            .expect("diesel migrations");
        println!("Ran {} migrations", migrations.len());

        Database { pool }
    }

    /// Get a connection from the pool.
    pub fn connection(&self) -> DbConnection {
        self.pool.get().expect("db connection")
    }
}

pub(crate) fn string_to_uuid(s: String) -> Result<Uuid, DatabaseError> {
    Uuid::parse_str(s.as_str()).map_err(|_| DatabaseError::InvalidUuid(s))
}
