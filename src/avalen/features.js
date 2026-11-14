// What the iPhone app shows during the pilot. Integrations that the iPhone app doesn't
// support yet stay in the code but are hidden there:
//   - wearable connections and automatic sync (Apple Health, Health Connect, WHOOP,
//     Google Health). Readings entered by hand still work.
//   - online payment through Paymob. Payment requests and payments recorded by the
//     coach still work.
// A later iPhone build can switch either back on with VITE_AVALEN_WEARABLE_SYNC=on or
// VITE_AVALEN_ONLINE_PAYMENTS=on. The web app is unchanged.

// Capacitor defines window.Capacitor inside the iPhone app; a browser never has it.
export const inNativeApp = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());

export const wearableSync = () => !inNativeApp() || import.meta.env?.VITE_AVALEN_WEARABLE_SYNC === "on";
export const onlinePayments = () => !inNativeApp() || import.meta.env?.VITE_AVALEN_ONLINE_PAYMENTS === "on";
