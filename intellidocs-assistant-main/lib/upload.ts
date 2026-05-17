export const UPLOAD_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

export function filterUploadFiles(files: File[]): File[] {
  return files.filter((f) => /\.(pdf|txt|md)$/i.test(f.name));
}
