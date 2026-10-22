// @vitest-environment jsdom

import type { ThreadActionRequestDto } from "@remote-codex/shared";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingRequestCard } from "./TimelineRequestCards";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    flushSync(() => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function renderPermission(onRespond = vi.fn()) {
  const request: ThreadActionRequestDto = {
    id: "perm-7",
    kind: "permissionRequest",
    title: "Run cargo test",
    description: "execute: cargo test",
    turnId: "turn-1",
    itemId: "call-1",
    createdAt: "2026-09-04T00:00:00Z",
    questions: [
      {
        id: "permission",
        header: "Permission",
        question: "Run cargo test",
        isOther: false,
        isSecret: false,
        options: [
          { label: "Allow once", description: "allow once" },
          { label: "Allow always", description: "allow always" },
          { label: "Reject", description: "reject once" },
        ],
      },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(
      <PendingRequestCard request={request} onRespond={onRespond} />,
    );
  });
  return { view: container, onRespond };
}

function renderOtherAnswer(onRespond = vi.fn(), multiSelect = false) {
  const request: ThreadActionRequestDto = {
    id: "input-7",
    kind: "requestUserInput",
    title: "Answer Required",
    description: null,
    turnId: "turn-1",
    itemId: "call-1",
    createdAt: "2026-09-04T00:00:00Z",
    questions: [
      {
        id: "limit",
        header: "行数上限",
        question: "行数上限",
        isOther: true,
        isSecret: false,
        multiSelect,
        options: [
          { label: "上限提到 55k", description: "raise limit" },
          { label: "保持 50k", description: "keep limit" },
        ],
      },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(
      <PendingRequestCard request={request} onRespond={onRespond} />,
    );
  });
  return { view: container, onRespond };
}

describe("PendingRequestCard permissions", () => {
  it("renders ACP choices as immediate permission actions", () => {
    const { view, onRespond } = renderPermission();

    expect(view.textContent).toContain("Permission required");
    expect(view.textContent).toContain("execute: cargo test");
    expect(view.textContent).not.toContain("Submit");

    const allowAlways = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Allow always",
    );
    flushSync(() => allowAlways?.click());

    expect(onRespond).toHaveBeenCalledWith("perm-7", {
      answers: {
        permission: { answers: ["Allow always"] },
      },
    });
  });
});

describe("PendingRequestCard custom answers", () => {
  it.each([false, true])("submits an option with an empty optional field (multiSelect=%s)", (multiSelect) => {
    const { view, onRespond } = renderOtherAnswer(vi.fn(), multiSelect);
    const option = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "上限提到 55k",
    );
    const submit = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Submit",
    );
    expect(submit?.disabled).toBe(true);
    flushSync(() => option?.click());
    expect(view.querySelector("input")?.value).toBe("");
    expect(submit?.disabled).toBe(false);
    flushSync(() => submit?.click());
    expect(onRespond).toHaveBeenCalledWith("input-7", {
      answers: { limit: { answers: ["上限提到 55k"] } },
    });
  });

  it("allows submitting a custom Other answer without selecting an option", () => {
    const { view, onRespond } = renderOtherAnswer();
    const input = view.querySelector<HTMLInputElement>(
      'input[aria-label="行数上限 custom answer"]',
    );
    expect(input).not.toBeNull();
    const submit = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Submit",
    );
    expect(submit?.disabled).toBe(true);

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    flushSync(() => {
      valueSetter?.call(input, "不限制仓库行数");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(submit?.disabled).toBe(false);
    flushSync(() => submit?.click());
    expect(onRespond).toHaveBeenCalledWith("input-7", {
      answers: { limit: { answers: ["不限制仓库行数"] } },
    });
  });
});
