import { toast as sonnerToast } from "sonner";

type ToastType = "error" | "success" | "info" | "warning";

export function toast(message: string, type: ToastType = "error") {
  switch (type) {
    case "success":
      sonnerToast.success(message);
      break;
    case "info":
      sonnerToast.info(message);
      break;
    case "warning":
      sonnerToast.warning(message);
      break;
    case "error":
    default:
      sonnerToast.error(message);
      break;
  }
}

export function toastWithUndo(message: string, onUndo: () => void) {
  let remaining = 30;
  const toastId = `undo-${Date.now()}`;

  const show = () => {
    sonnerToast(message, {
      id: toastId,
      duration: remaining * 1000,
      action: {
        label: `撤销 (${remaining}s)`,
        onClick: () => {
          clearInterval(timer);
          onUndo();
        },
      },
    });
  };

  show();
  const timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timer);
      return;
    }
    show();
  }, 1000);
}
