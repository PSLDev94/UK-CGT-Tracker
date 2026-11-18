"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./primitives";

export function useModal(
  ref: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>("[data-modal-cancel]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (open && previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}

export function useNavigationGuard(dirty: boolean, busy: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const navigating = useRef(false);
  const request = useCallback(
    (action: () => void) => {
      if (busy) return;
      if (dirty) setPending(() => action);
      else action();
    },
    [dirty, busy],
  );

  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!navigating.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.getAttribute("href")?.startsWith("#")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) anchor.focus({ preventScroll: true });
      request(() => {
        navigating.current = true;
        window.location.assign(anchor.href);
      });
    };
    const restore = () => {
      navigating.current = false;
    };
    document.addEventListener("click", followLink, true);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("pageshow", restore);
    return () => {
      document.removeEventListener("click", followLink, true);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("pageshow", restore);
    };
  }, [dirty, busy, request]);

  return {
    open: !!pending,
    request,
    stay: () => setPending(null),
    leave: () => {
      setPending(null);
      pending?.();
    },
  };
}

export function LeaveDialog({
  guard,
  title,
  confirm,
  children,
}: {
  guard: ReturnType<typeof useNavigationGuard>;
  title: string;
  confirm: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useModal(ref, guard.open);
  return (
    <dialog ref={ref} aria-labelledby={heading} onCancel={guard.stay}>
      <h2 id={heading}>{title}</h2>
      <p>{children}</p>
      <div className="actions">
        <Button
          variant="secondary"
          autoFocus
          data-modal-cancel
          onClick={guard.stay}
        >
          Stay here
        </Button>
        <Button onClick={guard.leave}>{confirm}</Button>
      </div>
    </dialog>
  );
}
