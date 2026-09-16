/** Shared display formatters (IST-agnostic; browser locale en-IN). */
export const formatTime = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
export const formatDateTime = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
export const ageInMinutes = (value?: string) => value ? Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)) : 0;
export const maskedPhone = (phone: string) => phone.length > 6 ? `${phone.slice(0, 3)} ${phone.slice(3, 5)}*** **${phone.slice(-3)}` : "Recipient not configured";
