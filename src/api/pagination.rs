use rocket::FromForm;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, FromForm, Clone, Debug)]
pub struct Pagination {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl Pagination {
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1)
    }

    pub fn limit(&self) -> i64 {
        self.per_page.unwrap_or(10).max(1) // Default to 10 per page
    }

    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.limit()
    }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total_count: i64,
    pub total_pages: i64,
    pub current_page: i64,
    pub per_page: i64,
}
