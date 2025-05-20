import { formatTimeAgo } from "./date";

describe("formatTimeAgo", () => {
  // Mock the current date to ensure consistent test results
  const NOW = new Date("2025-05-20T10:27:15-04:00");
  let originalDate: typeof Date;

  beforeAll(() => {
    originalDate = global.Date;
    global.Date = class extends Date {
      constructor() {
        super();
        return NOW;
      }
      static now() {
        return NOW.getTime();
      }
    } as typeof Date;
  });

  afterAll(() => {
    global.Date = originalDate;
  });

  test("formats years ago", () => {
    const date = new Date("2023-05-20T10:27:15-04:00");
    expect(formatTimeAgo(date)).toBe("2 years ago");

    const dateOneYear = new Date("2024-05-20T10:27:15-04:00");
    expect(formatTimeAgo(dateOneYear)).toBe("1 year ago");
  });

  test("formats months ago", () => {
    const date = new Date("2025-02-20T10:27:15-04:00");
    expect(formatTimeAgo(date)).toBe("3 months ago");

    const dateOneMonth = new Date("2025-04-20T10:27:15-04:00");
    expect(formatTimeAgo(dateOneMonth)).toBe("1 month ago");
  });

  test("formats days ago", () => {
    const date = new Date("2025-05-17T10:27:15-04:00");
    expect(formatTimeAgo(date)).toBe("3 days ago");

    const dateOneDay = new Date("2025-05-19T10:27:15-04:00");
    expect(formatTimeAgo(dateOneDay)).toBe("1 day ago");
  });

  test("formats hours ago", () => {
    const date = new Date("2025-05-20T07:27:15-04:00");
    expect(formatTimeAgo(date)).toBe("3 hours ago");

    const dateOneHour = new Date("2025-05-20T09:27:15-04:00");
    expect(formatTimeAgo(dateOneHour)).toBe("1 hour ago");
  });

  test("formats minutes ago", () => {
    const date = new Date("2025-05-20T10:24:15-04:00");
    expect(formatTimeAgo(date)).toBe("3 minutes ago");

    const dateOneMinute = new Date("2025-05-20T10:26:15-04:00");
    expect(formatTimeAgo(dateOneMinute)).toBe("1 minute ago");
  });

  test("handles string dates", () => {
    expect(formatTimeAgo("2024-05-20T10:27:15-04:00")).toBe("1 year ago");
  });

  test("handles invalid dates", () => {
    expect(() => formatTimeAgo("invalid-date")).toThrow();
  });
});
