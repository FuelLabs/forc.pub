export function reportWebVitals(metric: {
  id: string;
  name: string;
  label: string;
  value: number;
  startTime: number;
  duration: number;
}) {
  if (metric.label === "web-vital") {
    console.log(metric);
  }
}
