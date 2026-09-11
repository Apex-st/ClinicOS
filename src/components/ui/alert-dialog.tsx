import * as Alert from "@radix-ui/react-alert-dialog";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  danger = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Alert.Root open={open} onOpenChange={onOpenChange}>
      <Alert.Portal>
        <Alert.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Alert.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 shadow-[var(--shadow-lift)]">
          <Alert.Title className="font-display text-xl text-ink">{title}</Alert.Title>
          <Alert.Description className="mt-2 text-sm text-muted">{description}</Alert.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Alert.Cancel asChild>
              <Button type="button" variant="ghost">
                {cancelLabel}
              </Button>
            </Alert.Cancel>
            <Alert.Action asChild>
              <Button
                type="button"
                variant={danger ? "danger" : "default"}
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmLabel}
              </Button>
            </Alert.Action>
          </div>
        </Alert.Content>
      </Alert.Portal>
    </Alert.Root>
  );
}

