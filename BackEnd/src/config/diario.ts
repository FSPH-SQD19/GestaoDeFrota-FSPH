import { getWorkerRuntime } from "./runtime";
export function diarioConfig() {
  const runtime = getWorkerRuntime();
  return {
    enabled: (runtime?.driverPwaEnabled ?? process.env.DRIVER_PWA_ENABLED) === "true",
    osrmUrl: runtime?.osrmUrl ?? process.env.OSRM_URL,
    osrmToken: runtime?.osrmToken ?? process.env.OSRM_TOKEN,
  };
}
