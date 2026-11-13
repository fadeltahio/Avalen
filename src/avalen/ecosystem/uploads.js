import { apiUrl, connection } from "./connection.js";
import { saveFile } from "../store.js";
export async function inspectVideo(file) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Choose a video smaller than 100 MB.");
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type))
    throw new Error("Choose MP4, MOV or WebM.");
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const timer = setTimeout(
        () =>
          reject(
            new Error("The video metadata could not be read. Try MP4 or MOV."),
          ),
        12000,
      );
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        if (
          !Number.isFinite(video.duration) ||
          video.duration <= 0 ||
          video.duration > 120
        )
          reject(new Error("Choose a playable video up to 120 seconds."));
        else
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        video.removeAttribute("src");
        video.load();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("This video cannot play in this browser. Try MP4."));
      };
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function uploadVideo(file, clientId, onProgress, signal) {
  const metadata = await inspectVideo(file);
  if (!connection()) {
    onProgress(50);
    const saved = await saveFile(file, { types: ["video/"], maxMB: 100 });
    onProgress(100);
    return { ...saved, ...metadata };
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/media"));
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Avalen", "1");
    xhr.setRequestHeader("X-Media-Purpose", "formlab");
    xhr.setRequestHeader("X-CSRF-Token", connection().csrf);
    xhr.setRequestHeader("X-Client-Id", clientId);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300)
          resolve({ ...result, ...metadata });
        else reject(new Error(result.error || "Upload failed. Please retry."));
      } catch {
        reject(
          new Error(
            "The upload service returned an invalid response. Please retry.",
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "The connection was interrupted. Your video has not been submitted. Try uploading again.",
        ),
      );
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
