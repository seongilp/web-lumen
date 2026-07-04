import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionBar } from "./SelectionBar";

function setup(overrides = {}) {
  const props = {
    count: 3,
    total: 10,
    collections: [{ id: "c1", name: "여름" }],
    tags: ["여행", "음식"],
    onSelectAll: vi.fn(),
    onAddToCollection: vi.fn(),
    onCreateAndAdd: vi.fn(),
    onAddTag: vi.fn(),
    onShare: vi.fn(),
    onFavorite: vi.fn(),
    onDelete: vi.fn(),
    onRestore: vi.fn(),
    onDeleteForever: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<SelectionBar {...props} />);
  return props;
}

describe("SelectionBar", () => {
  it("shows the selected count", () => {
    setup({ count: 5 });
    expect(screen.getByText("5개 선택")).toBeInTheDocument();
  });

  it("favorites the selection", () => {
    const { onFavorite } = setup();
    fireEvent.click(screen.getByRole("button", { name: /즐겨찾기/ }));
    expect(onFavorite).toHaveBeenCalled();
  });

  it("deletes the selection", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: /삭제/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("adds the selection to an existing collection", () => {
    const { onAddToCollection } = setup();
    fireEvent.click(screen.getByRole("button", { name: /컬렉션에 추가/ }));
    fireEvent.click(screen.getByText("여름"));
    expect(onAddToCollection).toHaveBeenCalledWith("c1");
  });

  it("creates a new collection and adds the selection", () => {
    const { onCreateAndAdd } = setup();
    fireEvent.click(screen.getByRole("button", { name: /컬렉션에 추가/ }));
    fireEvent.click(screen.getByText("새 컬렉션에 추가"));
    const input = screen.getByPlaceholderText("새 컬렉션 이름");
    fireEvent.change(input, { target: { value: "가을" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateAndAdd).toHaveBeenCalledWith("가을");
  });

  it("clears the selection", () => {
    const { onClear } = setup();
    fireEvent.click(screen.getByTitle("선택 해제 (Esc)"));
    expect(onClear).toHaveBeenCalled();
  });

  it("adds a tag to the selection", () => {
    const { onAddTag } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^태그$/ }));
    const input = screen.getByPlaceholderText("태그 입력 후 Enter");
    fireEvent.change(input, { target: { value: "여행" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddTag).toHaveBeenCalledWith("여행");
  });

  it("selects all", () => {
    const { onSelectAll } = setup({ count: 3, total: 10 });
    fireEvent.click(screen.getByRole("button", { name: /전체 선택/ }));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it("shows restore / delete-forever in trash mode", () => {
    const { onRestore, onDeleteForever } = setup({ trashMode: true });
    fireEvent.click(screen.getByRole("button", { name: /복구/ }));
    fireEvent.click(screen.getByRole("button", { name: /영구 삭제/ }));
    expect(onRestore).toHaveBeenCalled();
    expect(onDeleteForever).toHaveBeenCalled();
    // No 삭제(휴지통)/collection actions in trash mode.
    expect(screen.queryByRole("button", { name: /컬렉션에 추가/ })).toBeNull();
  });
});
