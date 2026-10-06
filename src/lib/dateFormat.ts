import { format } from "date-fns";

export function formatDate(value: Date | string | number) {
  return format(new Date(value), "dd/MM/yyyy");
}

export function formatDateTime(value: Date | string | number) {
  return format(new Date(value), "dd/MM/yyyy 'at' HH:mm");
}

export function formatDateTimeWithSeconds(value: Date | string | number) {
  return format(new Date(value), "dd/MM/yyyy 'at' HH:mm:ss");
}
