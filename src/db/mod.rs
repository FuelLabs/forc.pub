pub mod api_token;
pub mod error;
pub mod package_category_keyword;
pub mod package_dependency;
pub mod package_version;
pub mod upload;
mod user_session;

use self::error::DatabaseError;
use crate::util::load_env;
use crate::{api, models, schema};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel::Connection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use std::env;
use tracing::info;
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

/// Wrapper for a database connection that provides a more convenient interface
/// for database operations.
pub struct DbConn<'a>(&'a mut DbConnection);

impl<'a> DbConn<'a> {
    pub fn new(conn: &'a mut DbConnection) -> Self {
        DbConn(conn)
    }

    pub fn inner(&mut self) -> &mut DbConnection {
        self.0
    }
}

impl Database {
    pub fn new() -> Self {
        // Create a connection pool
        let pool = Pool::builder()
            .build(ConnectionManager::<PgConnection>::new(db_url()))
            .expect("db connection pool");

        // Run migrations
        const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
        let mut conn = pool.get().expect("db connection");
        let migrations = conn
            .run_pending_migrations(MIGRATIONS)
            .expect("diesel migrations");
        info!("Ran {} migrations", migrations.len());

        Database { pool }
    }

    pub fn transaction<F, T, E>(&self, f: F) -> Result<T, E>
    where
        F: FnOnce(&mut DbConn<'_>) -> Result<T, E>,
        E: std::convert::From<diesel::result::Error>,
    {
        let mut conn = self.pool.get().expect("db connection");
        conn.transaction(|conn| f(&mut DbConn::new(conn)))
    }
}

pub(crate) fn string_to_uuid(s: String) -> Result<Uuid, DatabaseError> {
    Uuid::parse_str(s.as_str()).map_err(|_| DatabaseError::InvalidUuid(s))
}

fn db_url() -> String {
    load_env();
    let user = env::var("POSTGRES_USER").expect("POSTGRES_USER must be set");
    let password = env::var("POSTGRES_PASSWORD").expect("POSTGRES_PASSWORD must be set");
    let uri = env::var("POSTGRES_URI").expect("POSTGRES_URI must be set");
    let db_name = env::var("POSTGRES_DB_NAME").expect("POSTGRES_DB_NAME must be set");
    format!("postgres://{user}:{password}@{uri}/{db_name}")
}
