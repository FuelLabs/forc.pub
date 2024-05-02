use std::time::SystemTime;

pub fn sys_time_to_epoch(sys_time: SystemTime) -> u64 {
    sys_time
        .duration_since(SystemTime::UNIX_EPOCH)
        .expect("convert time to epoch")
        .as_secs()
        * 1000
}
