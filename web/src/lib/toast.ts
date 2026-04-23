import { toast as sonnerToast } from "sonner";

type ToastType = "error" | "success" | "info";

export function toast(message: string, type: ToastType = "error") {
  switch (type) {
    case "success":
      sonnerToast.success(message);
      break;
    case "info":
      sonnerToast.info(message);
      break;
    case "error":
    default:
      sonnerToast.error(message);
      break;
  }
}
