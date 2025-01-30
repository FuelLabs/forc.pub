pub mod api_token;
pub mod error;
pub mod package_dependency;
pub mod package_version;
pub mod upload;
mod user_session;

use self::error::DatabaseError;
use crate::util::load_env;
use crate::{api, models, schema};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
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

pub struct DbConn(DbConnection);
impl DbConn {
    pub fn inner(&mut self) -> &mut PgConnection {
        &mut self.0
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
        let mut connection = pool.get().expect("db connection");
        let migrations = connection
            .run_pending_migrations(MIGRATIONS)
            .expect("diesel migrations");
        info!("Ran {} migrations", migrations.len());

        Database { pool }
    }

    /// Get a connection from the pool.
    pub fn conn(&self) -> DbConn {
        DbConn(self.pool.get().expect("db connection"))
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
