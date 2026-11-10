import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingForm } from "@/components/ListingForm";
import { emptyForm } from "@/lib/listing-form";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (x: string) => x, pick: (x: { key?: string; type?: string }) => x.key ?? x.type ?? "hero" }) }));
vi.mock("@/lib/listings", () => ({ BUCKET: "listing-images", useImageUrls: () => ({ data: [] }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
afterEach(cleanup);
describe("independent hero inputs", () => {
  for (const [field, suffix] of [["crescents", "c"], ["red_crescents", "r"]] as const) {
    it(`${field}: edits existing values, clears to blank and saves numeric zero without altering siblings`, async () => {
      const submit = vi.fn().mockResolvedValue(undefined);
      const initial = { ...emptyForm(), castle_level: 30, power: 500, price: 10, server: "1", whatsapp: "12345678", heroes: [
        { hero_key: "saladin", crescents: 4, red_crescents: 2 },
        { hero_key: "qutuz", crescents: 7, red_crescents: 3 },
      ] };
      const { container } = render(<ListingForm initial={initial} userId="test" submitLabel="save" onSubmit={submit} />);
      const input = container.querySelector<HTMLInputElement>(`#saladin-${suffix}`);
      if (!input) throw new Error("Missing hero input");
      expect(input.value).toBe(String(initial.heroes[0][field]));
      fireEvent.change(input, { target: { value: "9" } });
      expect(input.value).toBe("9");
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
      const form = container.querySelector("form");
      if (!form) throw new Error("Missing form");
      fireEvent.submit(form);
      await waitFor(() => expect(submit).toHaveBeenCalledOnce());
      expect(submit.mock.calls[0][0].heroes).toEqual([{ ...initial.heroes[0], [field]: 0 }, initial.heroes[1]]);
    });
  }
});